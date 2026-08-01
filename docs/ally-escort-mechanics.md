# 游戏机制修正设计：队友掩护推进 · 开镜交互 · 敌人行为合理化

## 问题背景
3D 版可玩后暴露三类机制缺陷：
1. **队友与玩家零互动**：`allies.js` 每帧无条件朝 `goalX` 匀速前进，推进与清敌完全解耦，掩护玩法不成立。
2. **开镜交互反直觉**：`input.js` 右键 mousedown/mouseup 直接读写 `zoom`（长按语义），且 Shift 键是第二个写入者，状态冲突。
3. **敌人行为不合理**：
   - `levels.js` 全部巡逻兵传了 `range`，但 `enemies.js` 构造函数从未读取（存量 bug，巡逻范围配置失效）；
   - 敌人移动时零四肢动画（滑行感）；
   - 冲锋兵贴脸后无任何攻击手段（威胁为零）；
   - 敌弹速度 = 距离 × 0.5，飞行时间恒 2 秒，近慢远快不真实。

## 达成目标
- 队友推进必须由玩家清敌驱动：前方有存活敌人 → 队友推进至安全线停等；清空 → 自动继续前进。
- 右键点击切换开/关镜，鼠标移动调整瞄准（开镜灵敏度随 FOV 缩放），左键射击。
- 敌人移动路线配置生效、移动有行走动画、冲锋兵有近战威胁、敌弹固定弹速。

## 功能规格
| ID | 规格 | 优先级 |
|----|------|--------|
| R-001 | 右键 mousedown 切换 `zoom` 布尔（toggle）；移除 Shift 写入；新增 `resetZoom()` | P0 |
| R-002 | 开镜状态鼠标灵敏度 × (当前FOV/默认FOV)，平滑过渡 | P1 |
| R-003 | loadLevel / win / lose 时复位 zoom 与镜内 UI | P0 |
| R-004 | 纯函数 `computeAllyAdvance(allyX, goalX, threatXs)`：最近前方威胁决定保持线 `threatX - 7`；不倒退、不越终点；终点外/身后敌人不挡路 | P0 |
| R-005 | 队友停等时四肢复位 + 呼吸浮动待机；移动时保留行走摆动 | P1 |
| R-006 | HUD 显示「⚠ 队友等待掩护」 | P1 |
| R-007 | `cfg.range` → `minX/maxX = x ± range`（显式 minX/maxX 优先） | P0 |
| R-008 | patrol/charger 移动时四肢摆动，停止复位 | P0 |
| R-009 | 冲锋兵贴脸（\|dx\|≤2.5）自爆：自身死亡 + 队友扣 25 血 + 爆炸粒子 | P0 |
| R-010 | 敌弹朝队友方向固定弹速 10，寿命 = 距离/弹速 + 0.6s | P1 |
| R-011 | 操作提示文案更新为「右键开/关镜」 | P2 |

## 实现方案
- **新模块 `js/ally-logic.js`**：无 three 依赖纯函数，供 main.js 每帧调用，node 可直接单测。
- `allies.js`：`update(dt, targetX, waiting)` 由调用方传入推进目标；`reached` 仅在 `x >= this.goalX` 时成立。
- `input.js`：右键 toggle；删 Shift 绑定；`resetZoom()`。
- `camera-controls.js`：`rotate()` 灵敏度随 `_smoothFov` 比例缩放。
- `enemies.js`：构造器读 `range`；`moveUpdate` 记录 moving 并驱动四肢摆动；`update` 内冲锋兵近战判定返回 `{killed, melee}`。
- `main.js`：阻挡计算接入 ally.update；melee 扣血；`spawnEnemyBullet` 固定弹速；loadLevel/winLevel/loseLevel 复位 zoom + 镜内 UI；HUD 传 `allyWaiting`。
- `hud.js` / `index.html`：新增 `#hudAllyWait` 提示位 + 文案。

## 开发执行计划（todolist）
- [x] 1. 新建 `js/ally-logic.js` + `test-ally-logic.mjs`，测试全绿（15 断言）
- [x] 2. `input.js` 右键 toggle + resetZoom
- [x] 3. `camera-controls.js` 开镜灵敏度缩放
- [x] 4. `allies.js` 停等/待机姿态
- [x] 5. `enemies.js` range 修复 + 行走动画 + 冲锋自爆
- [x] 6. `main.js` 阻挡联动 + 近战伤害 + 弹速 + zoom 复位 + HUD 数据
- [x] 7. `hud.js` + `index.html` 等待提示与文案
- [x] 8. 全量语法检查 + 单测 + 服务器 200 验证（全绿）
- [x] 9. git 归档
