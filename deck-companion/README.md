# MoodWave Deck Companion

Steam Deck 游戏模式中的 MoodWave AI DJ 电台插件。

## 职责

- 显示 AI Radio 和 AI 寻歌入口。
- 调用本机或局域网 MoodWave API。
- 显示当前播放和 AI DJ 文案。
- 提供播放、暂停、下一首、换个氛围。

## 不负责

- 不保存第三方 API Key。
- 不做音频解码。
- 不管理音乐库。
- 不做 AI 推理或 TTS 生成。

默认 API Base 是 `http://127.0.0.1:38765`，可在插件里改为树莓派地址。
