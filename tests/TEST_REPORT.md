# MoodWave 测试报告

**生成时间**: 2026-05-25  |  **Node**: v25.9.0  |  **平台**: macOS arm64

---

## 单元测试 (12 文件)

```
ℹ tests 71  pass 71  fail 0  duration_ms ~1100ms
```

全部通过 ✅

## 集成测试

```
✔ GET /api/health
✔ GET /api/status
✔ GET /api/mood
✔ PUT /api/mood
✔ GET /api/now
✔ GET /api/taste
✔ PUT /api/taste
✔ GET /api/voice
✔ GET /api/special-dates
✔ GET /api/plan/today
✔ GET /api/profile/music-dna
✔ GET /api/profile/music-dna/history
✔ POST /api/switch-mode
✔ WebSocket /ws/stream upgrades
ℹ tests 14  pass 14  fail 0
```

## Deck Companion 插件

```
Ran 9 tests in ~2.7s  OK
```

---

## 统计

| 层 | ✅ Pass | ❌ Fail | 耗时 |
|-----|---------|---------|------|
| 单元测试 | 71 | 0 | ~1s |
| 集成测试 | 14 | 0 | ~12s |
| Deck Companion | 9 | 0 | ~3s |
| **合计** | **94** | **0** | ~16s |

## 已知问题

无。

## 运行命令

```bash
npm run test:unit           # 单元测试 <2s
npm run test:integration    # 集成测试 ~12s（需 19876/19880 端口空闲）
npm test                    # 全部
cd deck-companion && python3 test_main.py   # 插件
bash scripts/test-report.sh # 生成完整报告
```
