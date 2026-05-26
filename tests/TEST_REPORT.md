# MoodWave 测试报告

**生成时间**: 2026-05-26  |  **Node**: v25.9.0  |  **平台**: macOS arm64

---

## 单元测试 (13 文件)

```
ℹ tests 87  pass 87  fail 0  duration_ms ~1500ms
```

全部通过 ✅

### 模块覆盖

| 模块 | 文件 | 用例数 |
|------|------|--------|
| 状态存储 | state.test.js | 8 |
| 熔断器 | circuit-breaker.test.js | 6 |
| 播放器 | player.test.js | 4 |
| 调度器 | scheduler.test.js | 20 |
| DJ 上下文 | context.test.js | 8 |
| 音乐处理 | music.test.js | 7 |
| 情绪系统 | mood.test.js | 4 |
| AI 输出 | openai.test.js | 6 |
| 投屏 URL | cast-url.test.js | 3 |
| UPnP 解析 | cast.test.js | 2 |
| 语音 TTS | voice.test.js | 1 |
| 特殊日期 | special-dates.test.js | 5 |
| **游戏预设** 🆕 | **game-presets.test.js** | **18** |

## 集成测试

```
ℹ tests 20  pass 20  fail 0
```

| 端点 | 状态 |
|------|------|
| GET /api/health | ✅ |
| GET /api/status | ✅ |
| GET /api/mood | ✅ |
| PUT /api/mood | ✅ |
| GET /api/now | ✅ |
| GET /api/taste | ✅ |
| PUT /api/taste | ✅ |
| GET /api/voice | ✅ |
| GET /api/special-dates | ✅ |
| GET /api/plan/today | ✅ |
| GET /api/profile/music-dna | ✅ |
| GET /api/profile/music-dna/history | ✅ |
| POST /api/switch-mode | ✅ |
| WebSocket /ws/stream | ✅ |
| **GET /api/game/preset** 🆕 | ✅ |
| **GET /api/game/presets** 🆕 | ✅ |
| **社区预设 CRUD** 🆕 | ✅ |
| **社区预设内置保护** 🆕 | ✅ |
| **POST /api/game/presets/reload** 🆕 | ✅ |

## Deck Companion 插件

```
Ran 9 tests in ~5s  OK
```

---

## 统计

| 层 | ✅ Pass | ❌ Fail | 耗时 |
|-----|---------|---------|------|
| 单元测试 | 87 | 0 | ~1.5s |
| 集成测试 | 20 | 0 | ~13s |
| Deck Companion | 9 | 0 | ~5s |
| **合计** | **116** | **0** | ~20s |

## 已知问题

无。

## 运行命令

```bash
npm run test:unit           # 单元测试 <2s
npm run test:integration    # 集成测试 ~13s（需 19876/19880 端口空闲）
npm test                    # 全部
cd deck-companion && python3 test_main.py   # 插件
bash scripts/test-report.sh # 生成完整报告
```
