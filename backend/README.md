# WolfCha AI API

为 WolfCha 网页版提供 Kimi/Moonshot 服务端代理。API Key 只从服务端环境变量读取。

## 本地启动

```bash
cp .env.example .env
# 编辑 .env，填写 KIMI_API_KEY
set -a && source .env && set +a
./venv/bin/uvicorn main:app --reload --port 8000
```

接口：

- `GET /health`
- `POST /api/kimi-chat`
- `GET /api/docs`

## 环境变量

- `KIMI_API_KEY`：必填，Moonshot API Key。
- `KIMI_MODEL`：可选，默认 `moonshot-v1-32k`。
- `KIMI_API_URL`：可选，默认 Moonshot Chat Completions 地址。
- `KIMI_TIMEOUT_SECONDS`：可选，默认 30 秒。
- `ALLOWED_ORIGINS`：逗号分隔的网页来源；生产环境应设置为实际前端域名。

服务带有基础请求体限制和按来源 IP 的内存限流。生产环境若面向公网，仍建议在网关增加配额、鉴权与监控。
