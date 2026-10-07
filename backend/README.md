# WolfCha AI API

为 WolfCha 网页版提供阿里云百炼 Qwen 服务端代理。API Key 只从服务端环境变量读取。

## 本地启动

```bash
cp .env.example .env
# 编辑 .env，填写 DASHSCOPE_API_KEY
set -a && source .env && set +a
./venv/bin/uvicorn main:app --reload --port 8000
```

接口：

- `GET /health`
- `POST /api/ai-chat`
- `GET /api/docs`

## 环境变量

- `DASHSCOPE_API_KEY`：必填，阿里云百炼 API Key；也兼容变量名 `QWEN_API_KEY`。
- `QWEN_MODEL`：可选，默认 `qwen-plus`。
- `QWEN_API_URL`：可选，默认百炼中国内地 OpenAI 兼容 Chat Completions 地址；其他地域可覆盖此变量。
- `QWEN_TIMEOUT_SECONDS`：可选，默认 30 秒。
- `ALLOWED_ORIGINS`：逗号分隔的网页来源；生产环境应设置为实际前端域名。

接口格式参考[阿里云百炼 OpenAI 兼容文档](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)。

服务带有基础请求体限制和按来源 IP 的内存限流。生产环境若面向公网，仍建议在网关增加配额、鉴权与监控。
