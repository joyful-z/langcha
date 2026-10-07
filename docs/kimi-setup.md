# Kimi 接入配置

当前项目已经支持让 Kimi 统一模拟所有 AI 玩家发言。

## 已完成

- 前端通过 `src/services/ai.ts` 请求 AI 发言。
- 微信小程序环境会调用云函数 `kimiChat`。
- H5 环境会优先调用 `backend/` 的 Kimi 代理；未配置后端或调用失败时使用 `src/data/kimiChat.ts` 的 mock 数据。
- 云函数从环境变量读取密钥，不从代码或前端读取密钥。

## 云函数环境变量

部署 `cloudfunctions/kimiChat` 后，需要给该云函数配置环境变量：

```bash
KIMI_API_KEY=<your-kimi-api-key>
```

也兼容备用变量名：

```bash
MOONSHOT_API_KEY=<your-kimi-api-key>
```

不要把真实密钥写入代码、Markdown、截图或前端配置。

## CloudBase 部署后还需要做

1. 部署 `kimiChat` 云函数。
2. 在云函数环境变量中设置 `KIMI_API_KEY`。
3. 获取 CloudBase 环境 ID。
4. 将 `src/app.tsx` 中的 `Taro.cloud.init({ env: '' })` 替换为真实环境 ID。
5. 重新刷新预览并在微信小程序环境验证。

## 当前降级逻辑

网页端在代理未配置、密钥缺失或 Kimi API 返回异常时，会自动降级到本地 mock 发言，保证对局页面可继续使用。微信小程序端仍以 CloudBase 云函数返回为准。

## 网页端配置

后端只从服务端环境变量读取 `KIMI_API_KEY`，具体启动方式见 `backend/README.md`。构建或启动 H5 时配置后端地址：

```bash
WOLFCHA_API_BASE_URL=http://127.0.0.1:8000 npm run start:web
```

生产构建时将该值替换为已部署的 HTTPS 后端地址。
