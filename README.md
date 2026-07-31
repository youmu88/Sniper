# 🔭 狙击手掩护行动 · Sniper Cover Duty

一款纯前端（HTML5 Canvas）的狙击掩护战术小游戏。

## 玩法
你是隐藏在制高点的狙击手，用瞄准镜清除战场威胁，掩护卡通队友持续推进完成任务。难度逐关递增，最终是终极 Boss 战。

## 操作
- **移动鼠标**：瞄准
- **点击左键**：射击
- **按住右键 / Shift**：开镜（精确瞄准，弱点伤害翻倍）

## 运行方式
无需安装，直接用浏览器打开 `index.html` 即可游玩。
（或 `python3 -m http.server` 后访问 http://localhost:8000 ）

## 关卡（8关，难度循序渐进）
1. 初出茅庐 —— 教学关，固定静止靶
2. 稳步推进 —— 引入移动兵
3. 火力集结 —— 火力密度增加
4. 夜色迷踪 —— 掩体探头兵
5. 敌后穿插 —— 冲锋兵
6. 火力压制 —— 高强度混合火力
7. 铁血长廊 —— 敌方狙击手反击
8. 终极 Boss —— 巨型机甲多阶段战

## 敌方兵种
静止兵 / 巡逻兵 / 冲锋兵 / 掩体探头兵 / 重甲兵 / 敌方狙击手 / 终极Boss机甲

## 技术架构
```
index.html           页面骨架 + HUD + 菜单/选关/结算
css/style.css        样式（主样式内联保证单文件可运行）
js/sprites.js        程序化像素卡通形象生成器
js/levels.js         8 关数据 + 掩体配置
js/input.js          鼠标/键盘输入管理
js/allies.js         队友推进 + HP
js/enemies.js        敌方 AI（多兵种）
js/game.js           核心引擎（状态机、射击、碰撞、Boss战、胜负判定）
js/main.js           主入口、菜单、HUD、主循环、通关流程
smoke-test.js        Node 冒烟测试（模块加载/初始化/击杀）
integrated-test.js   胜负循环集成测试
```
全部为原生 JS，无任何框架与外部依赖，可直接打开运行。

## 测试
```
node smoke-test.js
node integrated-test.js
```

## 设计文档
见 `docs/game-design.md`。
