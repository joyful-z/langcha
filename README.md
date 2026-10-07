# WolfCha 狼茶

AI 狼人杀陪练，支持微信小程序和网页版。项目面向狼人杀新手，解决真人局门槛高、等待时间长、复盘成本高的问题，提供一个可以随时开局、低压力练习发言和站边判断的 AI 对局环境。

## 项目特点

- 9 人局配置：3 平民、3 狼人、1 预言家、1 女巫、1 猎人。
- 支持身份选择、夜间行动、顺序发言、投票结算、遗言和复盘。
- AI 玩家按座位顺序依次发言，后置 AI 会基于前置位发言继续推理。
- 网页版接入阿里云百炼 Qwen API 生成 AI 发言，服务异常时自动切换本地兜底，避免整局中断。
- 基于真实狼人杀对局语料提炼 prompt 规则，覆盖预言家报验、女巫刀口/银水、狼人悍跳/倒钩、平民表水等场景。
- 对局中支持给其他玩家添加个人身份标记，方便记录自己的判断。

## 技术栈

- 前端框架：Taro + React
- 开发语言：TypeScript
- 样式方案：SCSS Modules
- 小程序平台：微信小程序
- 云端能力：微信云开发 CloudBase 云函数
- AI 能力：网页版使用 Qwen API；微信小程序沿用 Kimi/Moonshot 云函数
- AI 工程机制：Prompt Engineering、Role-based Agent、Context Injection、Structured JSON Output、Token 控制、批量发言生成

## 目录结构

```text
.
├── cloudfunctions/
│   └── kimiChat/          # Kimi 发言生成云函数
├── config/                # Taro 构建配置
├── docs/                  # 项目说明文档
├── src/
│   ├── assets/            # 品牌图、tabBar 图标
│   ├── data/              # 角色、AI 玩家、引导卡片等静态数据
│   ├── pages/             # 首页、对局页、模型页、复盘页
│   ├── services/          # 云函数调用和 AI 请求封装
│   ├── styles/            # 全局样式变量
│   ├── types/             # 游戏类型定义
│   └── utils/             # 游戏引擎和规则逻辑
├── package.json
└── project.config.json
```

## AI 发言实现

前端在白天发言阶段收集当前局势，包括玩家身份、存活状态、发言顺序、夜晚事件、查验结果、票型和历史发言。网页版调用 `backend/` 的 Qwen 服务端代理，微信小程序调用现有 `kimiChat` 云函数。

服务端会把局势数据组装为结构化 prompt，并要求模型返回严格 JSON：

```json
{
  "speeches": [
    {
      "playerId": "doubao",
      "content": "公开发言内容"
    }
  ]
}
```

为了降低 API 限流风险，连续 AI 发言采用批量生成：一次请求生成从当前 AI 到轮到真人玩家之前的多段发言。prompt 会要求后面的 AI 把前面刚生成的内容视为已公开前置位发言，从而保留桌游里的顺序推理感。

## 运行网页版

要求：Node.js 18+、npm 9+。

```bash
git clone https://github.com/joyful-z/langcha.git
cd langcha
npm install
npm run start:web
```

终端会显示本地访问地址，默认通常是 `http://localhost:10086/`。浏览器打开后即可体验首页、身份选择、对局、历史复盘和模型介绍。

网页端会优先调用 `backend/` 中的服务端代理生成真实 Qwen 发言；服务不可用时自动使用本地演示发言，保证对局不中断。

启动真实 AI 后端：

```bash
cd backend
cp .env.example .env
# 编辑 .env，只在服务端填写 DASHSCOPE_API_KEY
set -a && source .env && set +a
./venv/bin/uvicorn main:app --reload --port 8000
```

另开一个终端启动网页，并指向后端：

```bash
cd langcha
WOLFCHA_API_BASE_URL=http://127.0.0.1:8000 npm run start:web
```

不要把 `DASHSCOPE_API_KEY` 写进前端环境变量或源码。

生产构建：

```bash
npm run build:web
```

静态文件输出到 `dist/`，可部署到任意静态网站服务。项目使用 Hash 路由和相对资源路径，支持部署到子目录。

## 运行微信小程序

安装依赖：

```bash
npm install
```

构建微信小程序：

```bash
npm run build:weapp
```

使用微信开发者工具打开克隆后的项目根目录，并按下文配置、部署 `kimiChat` 云函数。

## 云函数配置

`kimiChat` 云函数需要配置 Kimi/Moonshot API Key。推荐使用微信云函数环境变量：

```text
KIMI_API_KEY=你的 Kimi/Moonshot API Key
```

如果环境变量配置不方便，也可以在云函数目录创建本地密钥文件：

```text
cloudfunctions/kimiChat/secret.js
```

内容参考：

```js
module.exports = {
  KIMI_API_KEY: 'replace-with-your-kimi-api-key',
}
```

注意：`secret.js` 已被 `.gitignore` 排除，不能提交到 GitHub。

部署云函数：

```text
微信开发者工具 -> cloudfunctions/kimiChat -> 上传并部署：云端安装依赖
```

建议云函数配置：

- 超时时间：30 秒
- 内存：256MB 或 512MB

健康检查参数：

```json
{ "action": "ping" }
```

成功时返回中应包含：

```json
{
  "source": "kimi",
  "health": "ok"
}
```

## 当前状态

项目已完成可运行 Demo：微信小程序端通过云函数接入 Kimi，网页版通过 FastAPI 服务端代理接入 Qwen，并在服务异常时自动使用本地演示发言。后续可继续优化多模型角色绑定、长期记忆、复盘评分、发言质量评测和真实玩家数据闭环。
