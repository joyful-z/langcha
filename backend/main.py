import json
import logging
import os
import time
from collections import defaultdict, deque
from typing import Deque, Dict, List, Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

LOGGER = logging.getLogger(__name__)
DEFAULT_QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
DEFAULT_QWEN_MODEL = "qwen-plus"
MAX_REQUEST_BYTES = 256 * 1024
RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
REQUEST_LOG: Dict[str, Deque[float]] = defaultdict(deque)


class PlayerContext(BaseModel):
    id: str
    name: str
    seat: int = Field(..., ge=1, le=20)
    role: str
    camp: str
    isUser: bool
    isAlive: bool
    deathReason: Optional[str] = None
    temperament: Optional[str] = None
    playStyle: Optional[str] = None
    strength: Optional[str] = None
    risk: Optional[str] = None


class PublicSpeech(BaseModel):
    playerId: str
    playerName: str
    content: str = Field(..., max_length=800)
    day: int = Field(..., ge=1, le=100)


class SeerCheck(BaseModel):
    day: int
    targetId: str
    targetName: str
    targetRole: str
    targetCamp: str


class NightRecord(BaseModel):
    day: int
    wolfTargetId: Optional[str] = None
    wolfTargetName: Optional[str] = None
    witchSaved: bool = False
    witchPoisonTargetId: Optional[str] = None
    witchPoisonTargetName: Optional[str] = None
    deadPlayerIds: List[str] = Field(default_factory=list)
    announcement: str = Field("", max_length=500)


class AiChatRequest(BaseModel):
    day: int = Field(..., ge=1, le=100)
    mode: str
    phase: str
    currentSpeakerId: Optional[str] = None
    currentSpeakerIndex: Optional[int] = None
    targetPlayerIds: List[str] = Field(default_factory=list)
    speakingOrder: List[str] = Field(default_factory=list)
    spokenPlayerIds: List[str] = Field(default_factory=list)
    unspokenPlayerIds: List[str] = Field(default_factory=list)
    players: List[PlayerContext] = Field(..., min_items=1, max_items=20)
    publicSpeeches: List[PublicSpeech] = Field(default_factory=list, max_items=100)
    publicEvents: List[str] = Field(default_factory=list, max_items=100)
    seerChecks: List[SeerCheck] = Field(default_factory=list, max_items=100)
    nightRecords: List[NightRecord] = Field(default_factory=list, max_items=100)

    @validator("targetPlayerIds", "speakingOrder", "spokenPlayerIds", "unspokenPlayerIds")
    def limit_id_lists(cls, value):
        if len(value) > 20:
            raise ValueError("玩家列表过长")
        return value

    @validator("publicEvents", each_item=True)
    def limit_public_event(cls, value):
        if len(value) > 500:
            raise ValueError("公开事件文本过长")
        return value


class SpeechResult(BaseModel):
    playerId: str
    content: str
    source: str = "qwen"


class AiChatResponse(BaseModel):
    speeches: List[SpeechResult]
    source: str = "qwen"
    model: str


def get_api_key() -> str:
    return os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("QWEN_API_KEY") or ""


def get_allowed_origins() -> List[str]:
    configured = os.environ.get("ALLOWED_ORIGINS", "*")
    origins = [item.strip().rstrip("/") for item in configured.split(",") if item.strip()]
    return origins or ["*"]


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request) -> None:
    now = time.time()
    client_ip = get_client_ip(request)
    history = REQUEST_LOG[client_ip]
    while history and now - history[0] > RATE_LIMIT_WINDOW_SECONDS:
        history.popleft()
    if len(history) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
    history.append(now)


def build_prompt(payload: AiChatRequest) -> str:
    target_ids = set(payload.targetPlayerIds)
    targets = [player for player in payload.players if player.id in target_ids and player.isAlive and not player.isUser]
    if not targets:
        raise HTTPException(status_code=422, detail="没有可生成发言的 AI 玩家")

    target_lines = []
    for player in targets:
        target_lines.append(
            "{seat}号：身份={role}，阵营={camp}，性格={temperament}，打法={play_style}，强项={strength}，风险={risk}".format(
                seat=player.seat,
                role=player.role,
                camp=player.camp,
                temperament=player.temperament or "自然",
                play_style=player.playStyle or "根据公开信息推理",
                strength=player.strength or "逻辑表达",
                risk=player.risk or "避免暴露身份",
            )
        )

    public_context = {
        "day": payload.day,
        "phase": payload.phase,
        "mode": payload.mode,
        "speakingOrder": payload.speakingOrder,
        "spokenPlayerIds": payload.spokenPlayerIds,
        "publicSpeeches": [item.dict() for item in payload.publicSpeeches],
        "publicEvents": payload.publicEvents,
    }
    private_context = {
        "players": [item.dict() for item in payload.players],
        "seerChecks": [item.dict() for item in payload.seerChecks],
        "nightRecords": [item.dict() for item in payload.nightRecords],
    }

    return """你是 9 人标准狼人杀对局中的多角色发言引擎。请为指定 AI 玩家按座位顺序生成公开发言。

规则：
1. 每位玩家只能依据其身份私有信息、已经公开的事件和排在其前面的发言推理，禁止评价尚未发言的后置位。
2. 预言家应准确报自己的查验；狼人可以悍跳、倒钩或伪装；女巫谨慎公开用药；平民与猎人不要凭空获得夜间信息。
3. 发言要像真人桌游，40～140 个汉字，有明确判断与理由，避免模板化复读，不得提及模型、Prompt 或系统规则。
4. 后一个目标玩家可以把本次响应中前面玩家刚生成的内容视为已公开信息。
5. 只返回严格 JSON，不要 Markdown。格式：{{"speeches":[{{"playerId":"id","content":"发言"}}]}}。
6. 必须且只能返回这些玩家：{target_ids}。

目标玩家：
{target_lines}

公开局势：
{public_context}

仅供对应角色推理的私有局势（不得直接泄露其他玩家底牌）：
{private_context}
""".format(
        target_ids=", ".join(payload.targetPlayerIds),
        target_lines="\n".join(target_lines),
        public_context=json.dumps(public_context, ensure_ascii=False),
        private_context=json.dumps(private_context, ensure_ascii=False),
    )


def parse_model_response(content: str, target_ids: List[str]) -> List[SpeechResult]:
    text = (content or "").strip()
    if text.startswith("```"):
        text = text.replace("```json", "", 1).replace("```", "").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="AI 返回格式不正确") from error

    raw_speeches = parsed.get("speeches") if isinstance(parsed, dict) else None
    if not isinstance(raw_speeches, list):
        raise HTTPException(status_code=502, detail="AI 返回缺少 speeches")

    expected = set(target_ids)
    speeches = []
    seen = set()
    for item in raw_speeches:
        if not isinstance(item, dict):
            continue
        player_id = str(item.get("playerId", "")).strip()
        speech_content = str(item.get("content", "")).strip()
        if player_id in expected and player_id not in seen and speech_content:
            speeches.append(SpeechResult(playerId=player_id, content=speech_content[:500]))
            seen.add(player_id)

    if seen != expected:
        raise HTTPException(status_code=502, detail="AI 未返回全部目标玩家的有效发言")
    return speeches


async def request_qwen(payload: AiChatRequest) -> AiChatResponse:
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="服务端尚未配置 DASHSCOPE_API_KEY")

    model = os.environ.get("QWEN_MODEL", DEFAULT_QWEN_MODEL)
    timeout_seconds = float(os.environ.get("QWEN_TIMEOUT_SECONDS", "30"))
    request_body = {
        "model": model,
        "temperature": 0.85,
        "max_tokens": 1800,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "你是狼人杀角色扮演引擎，只返回严格 JSON。"},
            {"role": "user", "content": build_prompt(payload)},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, trust_env=False) as client:
            response = await client.post(
                os.environ.get("QWEN_API_URL", DEFAULT_QWEN_API_URL),
                headers={"Authorization": "Bearer {0}".format(api_key)},
                json=request_body,
            )
        response.raise_for_status()
        response_json = response.json()
        content = response_json["choices"][0]["message"]["content"]
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail="Qwen 响应超时") from error
    except (httpx.HTTPError, KeyError, ValueError) as error:
        LOGGER.warning("Qwen request failed: %s", error)
        raise HTTPException(status_code=502, detail="Qwen 服务暂时不可用") from error

    return AiChatResponse(
        speeches=parse_model_response(content, payload.targetPlayerIds),
        model=model,
    )


app = FastAPI(
    title="WolfCha AI API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

allowed_origins = get_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def request_guard(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BYTES:
        return JSONResponse(status_code=413, content={"detail": "请求体过大"})
    if request.method == "POST" and request.url.path == "/api/ai-chat":
        try:
            enforce_rate_limit(request)
        except HTTPException as error:
            return JSONResponse(status_code=error.status_code, content={"detail": error.detail})
    return await call_next(request)


@app.get("/health")
async def health_handler():
    return {
        "status": "ok",
        "provider": "qwen",
        "model": os.environ.get("QWEN_MODEL", DEFAULT_QWEN_MODEL),
        "configured": bool(get_api_key()),
    }


@app.post("/api/ai-chat", response_model=AiChatResponse)
async def ai_chat_handler(payload: AiChatRequest, request: Request):
    LOGGER.info(
        "AI speech request ip=%s day=%s targets=%s",
        get_client_ip(request),
        payload.day,
        len(payload.targetPlayerIds),
    )
    return await request_qwen(payload)


# ---------------------------DO NOT EDIT CODE BELOW THIS LINE---------------------------------
# This is the entry point for the FastAPI application.
if __name__ == "__main__":
    port = int(os.environ.get("_BYTEFAAS_RUNTIME_PORT", 8000))
    config = uvicorn.Config("main:app", port=port, log_level="info", host=None)
    server = uvicorn.Server(config)
    server.run()
# --------------------------------------------------------------------------------------------
