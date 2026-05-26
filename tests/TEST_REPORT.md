# MoodWave 测试报告

**生成时间**: 2026-05-26  |  **Node**: v25.9.0  |  **平台**: macOS arm64

---

## 单元测试 (16 文件)

```
ℹ tests 113  pass 113  fail 0  duration_ms ~1500ms
```

全部通过 ✅

### 模块覆盖

| 模块 | 文件 | 用例数 | 状态 |
|------|------|--------|------|
| 状态存储 | state.test.js | 8 | ✅ |
| 调度器 | scheduler.test.js | 20 | ✅ |
| 游戏预设 | game-presets.test.js | 18 | ✅ |
| 音乐处理 | music.test.js | 12 | ✅ 🆕+5 |
| DJ 上下文 | context.test.js | 8 | ✅ |
| **游戏理解** 🆕 | **game-understanding.test.js** | **8** | ✅ |
| **DNA 系统** 🆕 | **profile.test.js** | **8** | ✅ |
| 熔断器 | circuit-breaker.test.js | 6 | ✅ |
| AI 输出 | openai.test.js | 6 | ✅ |
| 特殊日期 | special-dates.test.js | 5 | ✅ |
| 情绪系统 | mood.test.js | 4 | ✅ |
| 播放器 | player.test.js | 4 | ✅ |
| **语音 TTS** | **voice.test.js** | **4** | ✅ 🆕+3 |
| 投屏 URL | cast-url.test.js | 3 | ✅ |
| UPnP 解析 | cast.test.js | 2 | ✅ |

## 集成测试

```
ℹ tests 20  pass 20  fail 0
```

14 个核心 API + 6 个游戏预设 API，全部通过。

## Deck Companion 插件

```
Ran 9 tests in ~5s  OK
```

---

## 统计

| 层 | ✅ Pass | ❌ Fail | 耗时 |
|-----|---------|---------|------|
| 单元测试 | 113 | 0 | ~1.5s |
| 集成测试 | 20 | 0 | ~13s |
| Deck Companion | 9 | 0 | ~5s |
| **合计** | **142** | **0** | ~20s |

## 未覆盖模块（需外部依赖）

| 模块 | 原因 |
|------|------|
| netease-auth.js | 网易云 API 强依赖 |
| providers/netease.js | 同上 |
| weather.js | 单函数，集成测试间接覆盖 |
| config.js / defaults.js | 纯常量 |

## 运行命令

```bash
npm run test:unit           # 单元测试 <2s
npm run test:integration    # 集成测试 ~13s
npm test                    # 全部
cd deck-companion && python3 test_main.py   # 插件
```
