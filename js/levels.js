/* ============================================================
 * levels.js — 8 关关卡数据定义
 * 难度循序渐进，最后为 Boss 战
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  // 关卡内部坐标系：逻辑宽 1000，高 600（会被相机缩放适配）
  const LEVELS = [
    // L1 教学关：仅静止靶
    {
      id: 1, name: '初出茅庐', stars: 1,
      terrain: '草原',
      groundH: 40,
      objective: '清除战场上的固定威胁，掩护队友抵达终点！',
      allies: [{ x: 120, hp: 100, speed: 34 }],
      goalX: 880,
      spawn: { type: 'scripted', waves: null },
      initially: [
        { kind: 'stationary', x: 620, y: 0, hp: 1, fireRate: 0 },
        { kind: 'stationary', x: 760, y: 0, hp: 1, fireRate: 0 },
        { kind: 'stationary', x: 520, y: 0, hp: 1, fireRate: 0 },
      ],
      maxSimultaneous: 3,
    },
    // L2 引入移动兵
    {
      id: 2, name: '稳步推进', stars: 2,
      terrain: '草原',
      objective: '敌人开始移动，注意预判提前量！',
      allies: [{ x: 120, hp: 100, speed: 36 }],
      goalX: 880,
      barriers: [{ x: 500, lift: 0 }, { x: 680, lift: 0 }],
      initially: [
        { kind: 'stationary', x: 600, y: 0, hp: 1, fireRate: 0.8 },
        { kind: 'patrol', x: 720, y: 0, hp: 1, fireRate: 0.5, range: 120, speed: 22 },
        { kind: 'stationary', x: 800, y: 0, hp: 1, fireRate: 0 },
      ],
      maxSimultaneous: 4,
    },
    // L3 火力集结
    {
      id: 3, name: '火力集结', stars: 2,
      terrain: '城镇',
      objective: '敌方火力密集，优先清除高威胁目标！',
      allies: [{ x: 110, hp: 120, speed: 32 }],
      goalX: 880,
      barriers: [{ x: 520 }, { x: 680 }, { x: 780 }, { x: 460 }],
      initially: [
        { kind: 'stationary', x: 540, y: 0, hp: 1, fireRate: 1.2 },
        { kind: 'stationary', x: 620, y: 0, hp: 2, fireRate: 0 }, // 重甲静止
        { kind: 'patrol', x: 700, y: 0, hp: 1, fireRate: 0.8, range: 100, speed: 24 },
        { kind: 'patrol', x: 790, y: 0, hp: 1, fireRate: 0.6, range: 90, speed: 26 },
      ],
      maxSimultaneous: 5,
    },
    // L4 夜色迷踪：掩体后，探头
    {
      id: 4, name: '夜色迷踪', stars: 3,
      terrain: '城镇夜',
      objective: '敌人会躲在掩体后探头，找机会狙杀！',
      allies: [{ x: 110, hp: 120, speed: 30 }],
      goalX: 870,
      barriers: [{ x: 560 }, { x: 800 }, { x: 640 }],
      initially: [],
      waves: [
        // 掩体兵：平时隐匿，周期性探头
        { kind: 'crouch', x: 560, y: 0, hp: 2, peekInterval: 1.6, peekDur: 1.0 },
        { kind: 'stationary', x: 660, y: 0, hp: 1, fireRate: 1.0 },
        { kind: 'patrol', x: 720, y: 0, hp: 1, fireRate: 0.7, range: 80, speed: 20 },
        { kind: 'crouch', x: 800, y: 0, hp: 2, peekInterval: 1.2, peekDur: 0.9 },
      ],
      maxSimultaneous: 4,
    },
    // L5 敌后穿插：冲锋兵
    {
      id: 5, name: '敌后穿插', stars: 3,
      terrain: '沙漠',
      objective: '有快速冲锋兵直扑队友！必须第一时间解决！',
      allies: [{ x: 100, hp: 140, speed: 34 }],
      goalX: 880,
      barriers: [{ x: 620 }, { x: 720 }, { x: 500 }],
      waves: [
        { kind: 'stationary', x: 560, y: 0, hp: 1, fireRate: 1.0 },
        { kind: 'charger', x: 700, y: 0, hp: 3, speed: 80, fireRate: 0 },     // 冲锋兵
        { kind: 'patrol', x: 640, y: 0, hp: 1, fireRate: 0.9, range: 70, speed: 22 },
        { kind: 'crouch', x: 820, y: 0, hp: 2, peekInterval: 1.4, peekDur: 0.8 },
        // 中途再刷一个冲锋兵
        { kind: 'charger', x: 780, y: 0, hp: 3, speed: 85, fireRate: 0, delay: 6 },
        { kind: 'stationary', x: 500, y: 0, hp: 2, fireRate: 1.2 },
      ],
      maxSimultaneous: 4,
    },
    // L6 火力压制
    {
      id: 6, name: '火力压制', stars: 4,
      terrain: '废墟',
      objective: '高强度火力！迅速歼灭所有外部威胁！',
      allies: [{ x: 100, hp: 150, speed: 30 }],
      goalX: 870,
      barriers: [{ x: 500 }, { x: 600 }, { x: 760 }, { x: 690 }],
      waves: [
        { kind: 'stationary', x: 520, y: 0, hp: 1, fireRate: 1.4 },
        { kind: 'stationary', x: 580, y: 0, hp: 2, fireRate: 1.0 },
        { kind: 'patrol', x: 650, y: 0, hp: 1, fireRate: 1.0, range: 90, speed: 24 },
        { kind: 'charger', x: 720, y: 0, hp: 3, speed: 78, fireRate: 0 },
        { kind: 'heavy', x: 800, y: 0, hp: 6, fireRate: 1.2 },   // 重甲
        { kind: 'crouch', x: 760, y: 0, hp: 2, peekInterval: 1.2, peekDur: 0.8 },
        { kind: 'stationary', x: 470, y: 0, hp: 1, fireRate: 1.6 },
        { kind: 'charger', x: 660, y: 0, hp: 3, speed: 82, fireRate: 0, delay: 5 },
      ],
      maxSimultaneous: 5,
    },
    // L7 铁血长廊：敌方狙击手反击
    {
      id: 7, name: '铁血长廊', stars: 4,
      terrain: '雪原',
      objective: '敌方狙击手会反击！用掩体规避，找准时机开枪！',
      allies: [{ x: 110, hp: 160, speed: 32 }],
      goalX: 880,
      barriers: [{ x: 520 }, { x: 655 }, { x: 770 }],
      waves: [
        { kind: 'stationary', x: 540, y: 0, hp: 1, fireRate: 1.2 },
        { kind: 'sniper', xMd: 650, x: 800, y: 0, hp: 4, fireRate: 1.1, aimTime: 1.4 }, // 敌方狙击手
        { kind: 'charger', x: 700, y: 0, hp: 3, speed: 76, fireRate: 0 },
        { kind: 'patrol', x: 600, y: 0, hp: 1, fireRate: 0.9, range: 80, speed: 24 },
        { kind: 'heavy', x: 760, y: 0, hp: 6, fireRate: 1.0 },
        { kind: 'stationary', x: 500, y: 0, hp: 2, fireRate: 1.3 },
        { kind: 'sniper', x: 850, y: 0, hp: 4, fireRate: 1.2, aimTime: 1.2, delay: 8 },
      ],
      maxSimultaneous: 5,
    },
    // L8 终极 Boss
    {
      id: 8, name: '终极 Boss', stars: 5,
      terrain: '机甲基地',
      objective: '最终Boss机甲！攻击其能量核心弱点以击败它！',
      allies: [{ x: 90, hp: 200, speed: 26 }],
      goalX: 500,
      barriers: [{ x: 460 }, { x: 640 }, { x: 500 }],
      initially: [
        { kind: 'stationary', x: 560, y: 0, hp: 1, fireRate: 1.2 },
        { kind: 'patrol', x: 650, y: 0, hp: 1, fireRate: 0.9, range: 70, speed: 22 },
        { kind: 'heavy', x: 750, y: 0, hp: 5, fireRate: 1.0 },
      ],
      boss: { x: 760, hp: 40, fireRate: 1.3, phaseAt: 20, coreVulnerable: false },
      maxSimultaneous: 4,
    },
  ];

  // 供其他模块使用的查找/接口
  S.levels = {
    all: LEVELS,
    get(id) { return LEVELS.find(l => l.id === id) || LEVELS[0]; },
    count: LEVELS.length,
  };
})(typeof window !== 'undefined' ? window : this);
