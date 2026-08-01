# 可玩性全面增强 · 设计文档

## 背景
游戏为 Three.js 3D 低多边形狙击手游。现状问题：
- 瞄准镜固定单倍率（FOV 8），无法看更远/搜索隐蔽目标
- 敌人分布集中（x∈[-12,12]、z∈[-18,-28]），无隐蔽敌人，缺乏"搜索-发现-猎杀"流程
- 布景虽有地形差异，但每关雷同，缺专属装饰
- 无高清精灵图素材，纯几何体观感单一

## 目标
1. **多倍率瞄准镜**：开镜后滚轮 4x/8x/12x 跳档，HUD 显示当前倍率；倍率越高看得越远越清
2. **敌人分散 + 隐蔽机制**：新增 `hidden` 敌人（狙击手/侦察兵远距隐蔽，不开镜不可见；开镜后按倍率逐级揭示），敌人分布拉散至 z∈[-18,-42]
3. **每关差异化布景**：createProps 增加每关专属装饰（旗帜/霓虹/涂鸦/警示灯/训练靶）
4. **高清精灵图**：优先从 CC0 素材源下载，不可达则程序化 Canvas 生成高清贴图（旗帜/警示牌/弹药箱），提升观感

## 实现方案

### A. 多倍率瞄准镜
- `camera-controls.js`：`SCOPE_LEVELS=[20,12,7]`（对应约 3.2x/5.3x/9x），`scopeLevel` 索引；`setZoom(active)` 保持，新增 `cycleScope(delta)` 滚轮跳档；update 中 `targetFov = SCOPE_LEVELS[scopeLevel]`
- `input.js`：wheel 事件（pointerLocked 时）→ `onScopeDelta` 回调 + `scopeDelta` 缓冲
- `main.js`：每帧消费滚轮缓冲 → `fpsCam.cycleScope(delta)`；镜内显示倍率 `SCOPE x.x`；倍率联动敌人揭示
- `index.html`：镜内新增倍率读数（`.scope-zoom`）

### B. 敌人分散 + 隐蔽
- `levels.js`：敌人 z 扩展至 -18~-42；新增 `hidden:true` 的狙击手/侦察兵（远距隐蔽）
- `enemies.js`：构造支持 `cfg.hidden`；新增 `setReveal(active, level)`：
  - hidden 敌人：不开镜 `mesh.visible=false`；开镜后 `revealLevel = cfg.revealLevel || 1`，当前倍率 ≥ revealLevel 才可见
  - 普通敌人：始终可见（保持既有行为，回归安全）
  - 隐蔽敌人不开镜时不计入射击目标（命中判定跳过隐藏 mesh）——通过 `isVisible()` 语义：隐蔽未揭示时 `isVisible=false`（射击/受击均跳过）
- `main.js`：每帧 `enemies.forEach(e => e.setReveal(input.zoom, scopeLevel+1))`，并显示隐蔽提示「🔍 高倍率可发现隐蔽目标」

### C. 每关差异化布景
- `terrain.js` `createProps(levelDef)` 增加 `levelDef.id` 专属装饰：
  - L1 草原：训练靶 + 信号旗
  - L2 草原：弹药箱堆 + 战壕
  - L3 城镇：涂鸦墙 + 电线杆
  - L4 城镇夜：霓虹灯牌 + 路灯加密
  - L5 沙漠：风化石柱 + 驼队遗骸
  - L6 废墟：烧毁车 + 残垣
  - L7 雪原：松林 + 雪堆
  - L8 机甲基地：警示灯柱 + 能量罐
- 现有公共布景（沙袋/铁丝网/木箱）保留

### D. 高清精灵图
- 尝试下载 CC0 素材（OpenGameArt 镜像/GitHub raw）；403/404 不可达时用 Canvas 程序化生成高清贴图（`assets/` 目录），用于布景 Sprite（旗帜/警示牌），加载失败静默回退几何体

## 回归保护
- `test-wind-logic.mjs`、`test-ally-logic.mjs`、`headless-screenshot-test.js` 全绿
- hidden 敌人：普通敌人可见性路径不变；headless 探针新增"隐蔽敌人未开镜不可见"断言
- 多倍率：cycleScope 边界钳制（0..2），FOV 平滑过渡逻辑复用
