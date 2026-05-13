# 十三哥的音乐之声（mark radio）

局域网私人 AI 电台。前端是高保真 PWA 播放器，后端是树莓派上的 Node.js 本地中枢，负责 GPT-5.5、网易云、Fish Audio、天气、心情和重要日期。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev:api
```

另开一个终端：

```bash
npm run dev:web
```

开发访问：`http://localhost:8080`。

## 树莓派部署

目标地址：

- PWA：`http://192.168.2.33:8080`
- API：`http://192.168.2.33:8765`

步骤：

```bash
npm install
cp .env.example .env
npm run build
npm start
```

`.env` 里只填写本机密钥，不要提交：

- `OPENAI_API_KEY`
- `FISH_AUDIO_API_KEY`
- `FISH_AUDIO_VOICE_ID`
- `OPENWEATHER_API_KEY`
- `NETEASE_API_BASE`

## 已实现接口

- `GET /api/status`
- `GET /api/now`
- `GET /api/mood` / `PUT /api/mood`
- `GET /api/taste` / `PUT /api/taste`
- `GET /api/voice` / `PUT /api/voice`
- `POST /api/voice/preview`
- `GET /api/special-dates` / `PUT /api/special-dates`
- `GET /api/plan/today` / `POST /api/plan/today`
- `POST /api/chat`
- `POST /api/playback/:action`
- `GET /ws/stream`

## 重要日期

内置：

- `05-14`：我的生日
- `05-12`：特别重要人生日
- `01-01`：元旦
- 二十四节气
- 春节/农历新年，本地年份表覆盖 2026-2035

## 安全边界

- OpenAI/Fish/网易云/天气密钥只放树莓派 `.env`。
- 前端不暴露第三方密钥。
- Fish Audio 只用于授权音色。
- 未配置密钥时进入 Demo 模式，UI 和流程仍可体验。
