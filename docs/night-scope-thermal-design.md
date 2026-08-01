# 夜景红外狙击 · 设计文档

## 背景
当前游戏为白天 3D 狙击，敌人始终清晰可见，缺少"侦察-瞄准-猎杀"的狙击手感；镜头 FOV 偏小、敌人移动偏快、瞄准镜标线简易。本轮围绕"夜景红外透视"重构狙击体验。

## 目标
1. 夜景化战场，敌人不开镜时融入夜色（暗红模糊轮廓），只有开启瞄准镜（红外热成像）才能清晰锁定。
2. 十字瞄准镜精细升级。
3. 镜头拉远（FOV 放大）。
4. 敌人移动减速。
5. 举一反三优化视觉与手感。

## 实现方案

### 1. 夜景化（scene-setup.js / terrain.js / main.js）
- 场景背景与雾改为夜色 `0x070b14`，雾范围拉长（更幽深）。
- 环境光降至 ~0.28、半球光降档，新增一束蓝紫冷月光 Fill 光烘托夜色氛围。
- 地面/建筑基色整体压暗统一为夜色调。
- 关卡专用雾色映射统一改为夜色系。

### 2. 红外热成像（enemies.js 核心机制）
- `Enemy3D` 构造时 `_collectMaterials()` 遍历收集所有含 `emissive` 的材质引用。
- 新增 `setThermal(active)`：
  - 关镜（false）：`emissive=暗红 0x8a1a0a, intensity=0.35`（夜色中暗红轮廓，肉眼难辨方向）。
  - 开镜（true）：`emissive=橙红 0xff5324, intensity=1.7`（白热核心 + 红晕的热成像观感）。
- Boss 的 core/eye 原发光在热成像下进一步拉亮。
- **同步修复**：`takeDamage` 受伤闪烁后恢复 emissive 会覆盖红外状态——恢复时读取 `this._thermal` 状态重置对应发热值，避免开镜下闪烁后敌人"消失"。

### 3. 开镜状态驱动（main.js / camera-controls.js）
- `camera-controls.js` `DEFAULT_FOV` 50 → 65（镜头拉远、视野开阔）。SCOPE_FOV 8 不变。
- camera 固定位 `(0,3.8,15)` 微调为 `(0,4.2,16)` 让视角更舒展。
- main.js update 循环在 `fpsCam.setZoom(input.zoom)` 时对所有敌人批量 `setThermal(input.zoom)`，形成红外联动。

### 4. 敌人减速（enemies.js）
- patrol speed 18 → 11；charger speed 55 → 32；Boss phase 阶段 8 → 5。
- 行走动画摆动频率同步微降，观感更沉稳。

### 5. 十字瞄准镜（index.html / style.css）
- 保留环形镜片，新增：中心细点、四向精细密位刻度线、顶部距离标尺文字、镜片内红外暗红背景氛围。
- 开镜时镜片外圈加暗色晕影，强化"夜视仪"聚焦感。

## 简化度
系统新增一组"红外发光状态"，逻辑集中在 `enemies.setThermal`，无分支爆炸；不做弹道改动，不触碰已封板的胜负/存档链路。
