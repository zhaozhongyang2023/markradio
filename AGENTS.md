# MoodWave 项目约定

## 改动原则
- 改动要小，方便审查
- 动手前先说文件和计划
- 不胡编路径和配置
- 不要泄露密钥和敏感信息
- 行为变化尽量补测试
- 默认中文，表达简洁，可复制

## Git 分支

### 当前结构
```
main          ← 唯一主干
moodwave/v6   ← v6 功能分支
```

### 命名规范
- 前缀统一：`moodwave/<功能名>`
- 示例：`moodwave/v6`、`moodwave/switch-companion`
- 合入 main 后及时删除远程分支

### 历史变更（2026-05-22）
| 动作 | 旧分支 | 新分支 |
|------|--------|--------|
| 删除 | `codex/moodwave-v5` | —（已合入 main） |
| 删除 | `codex/switch-companion` | —（内容已在 main） |
| 删除 | `V6` | —（与 v6-prompt-opt 重复） |
| 重命名 | `codex/v6-prompt-optimize` | `moodwave/v6` |

### 新线程同步
```bash
git fetch --prune
git remote prune origin
```
