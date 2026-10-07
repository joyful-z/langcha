# Kimi 接入配置

当前项目已经支持让 Kimi 统一模拟所有 AI 玩家发言。

## 已完成

- 前端通过 `src/services/ai.ts` 请求 AI 发言。
- 微信小程序环境会调用云函数 `kimiChat`。
- H5/预览环境会自动使用 `src/data/kimiChat.ts` 的 mock 数据。
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

如果云函数未部署、密钥未配置、Kimi API 返回异常，前端会自动降级到本地 mock 发言，保证对局页面可继续使用。
