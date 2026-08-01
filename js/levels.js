/* ============================================================
 * levels.js — 3D 关卡数据定义 (8关)
 * 3D坐标: x=左右, y=上下, z=前后(远离玩家为负)
 * ============================================================ */
import * as THREE from 'three';

const LEVELS = [
  // L1 教学关：仅静止靶
  {
    id: 1, name: '初出茅庐', stars: 1,
    terrain: '草原',
    objective: '清除战场上的固定威胁，掩护队友抵达终点！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 5,
    allyHp: 100,
    barriers: [{ x: -5, z: -12 }, { x: 0, z: -14 }, { x: 5, z: -12 }],
    enemies: [
      { kind: 'stationary', x: -8, z: -20, hp: 1, fireRate: 0 },
      { kind: 'stationary', x: 0, z: -25, hp: 1, fireRate: 0 },
      { kind: 'stationary', x: 8, z: -18, hp: 1, fireRate: 0 },
    ],
  },
  // L2 引入移动兵
  {
    id: 2, name: '稳步推进', stars: 2,
    terrain: '草原',
    objective: '敌人开始移动，注意预判提前量！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 5.5,
    allyHp: 100,
    barriers: [{ x: -4, z: -12 }, { x: 4, z: -14 }, { x: 8, z: -12 }],
    enemies: [
      { kind: 'stationary', x: -6, z: -20, hp: 1, fireRate: 0.8 },
      { kind: 'patrol', x: 2, z: -22, hp: 1, fireRate: 0.5, range: 6, speed: 3 },
      { kind: 'stationary', x: 10, z: -18, hp: 1, fireRate: 0 },
    ],
  },
  // L3 火力集结
  {
    id: 3, name: '火力集结', stars: 2,
    terrain: '城镇',
    objective: '敌方火力密集，优先清除高威胁目标！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 5,
    allyHp: 120,
    barriers: [{ x: -6, z: -12 }, { x: 0, z: -13 }, { x: 6, z: -12 }, { x: 10, z: -14 }],
    enemies: [
      { kind: 'stationary', x: -8, z: -22, hp: 1, fireRate: 1.2 },
      { kind: 'stationary', x: 0, z: -25, hp: 2, fireRate: 0 },
      { kind: 'patrol', x: 4, z: -20, hp: 1, fireRate: 0.8, range: 5, speed: 3.5 },
      { kind: 'patrol', x: 10, z: -22, hp: 1, fireRate: 0.6, range: 4, speed: 3 },
    ],
  },
  // L4 夜色迷踪
  {
    id: 4, name: '夜色迷踪', stars: 3,
    terrain: '城镇夜',
    objective: '敌人会躲在掩体后探头，找机会狙杀！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 4.5,
    allyHp: 120,
    barriers: [{ x: -4, z: -12 }, { x: 4, z: -13 }, { x: 8, z: -12 }],
    enemies: [
      { kind: 'crouch', x: -4, z: -20, hp: 2, peekInterval: 2.5, peekDur: 1.5 },
      { kind: 'stationary', x: 0, z: -24, hp: 1, fireRate: 1.0 },
      { kind: 'patrol', x: 4, z: -22, hp: 1, fireRate: 0.7, range: 4, speed: 3 },
      { kind: 'crouch', x: 10, z: -20, hp: 2, peekInterval: 2.0, peekDur: 1.2 },
    ],
  },
  // L5 敌后穿插
  {
    id: 5, name: '敌后穿插', stars: 3,
    terrain: '沙漠',
    objective: '有快速冲锋兵直扑队友！必须第一时间解决！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 5,
    allyHp: 140,
    barriers: [{ x: -4, z: -12 }, { x: 2, z: -13 }, { x: 8, z: -12 }],
    enemies: [
      { kind: 'stationary', x: -6, z: -22, hp: 1, fireRate: 1.0 },
      { kind: 'charger', x: 4, z: -24, hp: 3, speed: 12, fireRate: 0 },
      { kind: 'patrol', x: 2, z: -20, hp: 1, fireRate: 0.9, range: 4, speed: 3 },
      { kind: 'crouch', x: 12, z: -20, hp: 2, peekInterval: 2.0, peekDur: 1.0 },
      { kind: 'charger', x: 8, z: -26, hp: 3, speed: 13, fireRate: 0, delay: 6 },
    ],
  },
  // L6 火力压制
  {
    id: 6, name: '火力压制', stars: 4,
    terrain: '废墟',
    objective: '高强度火力！迅速歼灭所有外部威胁！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 4.5,
    allyHp: 150,
    barriers: [{ x: -6, z: -12 }, { x: 0, z: -13 }, { x: 6, z: -12 }, { x: 10, z: -14 }],
    enemies: [
      { kind: 'stationary', x: -8, z: -22, hp: 1, fireRate: 1.4 },
      { kind: 'stationary', x: -2, z: -25, hp: 2, fireRate: 1.0 },
      { kind: 'patrol', x: 2, z: -22, hp: 1, fireRate: 1.0, range: 5, speed: 3.5 },
      { kind: 'charger', x: 6, z: -24, hp: 3, speed: 12, fireRate: 0 },
      { kind: 'heavy', x: 10, z: -22, hp: 6, fireRate: 1.2 },
      { kind: 'crouch', x: 8, z: -20, hp: 2, peekInterval: 2.0, peekDur: 1.0 },
      { kind: 'charger', x: 0, z: -28, hp: 3, speed: 12, fireRate: 0, delay: 5 },
    ],
  },
  // L7 铁血长廊
  {
    id: 7, name: '铁血长廊', stars: 4,
    terrain: '雪原',
    objective: '敌方狙击手会反击！用掩体规避，找准时机开枪！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 4.5,
    allyHp: 160,
    barriers: [{ x: -4, z: -12 }, { x: 2, z: -13 }, { x: 8, z: -12 }],
    enemies: [
      { kind: 'stationary', x: -6, z: -22, hp: 1, fireRate: 1.2 },
      { kind: 'sniper', x: 0, z: -28, hp: 4, fireRate: 1.1, aimTime: 2.0 },
      { kind: 'charger', x: 4, z: -24, hp: 3, speed: 11, fireRate: 0 },
      { kind: 'patrol', x: -2, z: -20, hp: 1, fireRate: 0.9, range: 4, speed: 3.5 },
      { kind: 'heavy', x: 8, z: -22, hp: 6, fireRate: 1.0 },
      { kind: 'sniper', x: 12, z: -28, hp: 4, fireRate: 1.2, aimTime: 1.8, delay: 8 },
    ],
  },
  // L8 终极 Boss
  {
    id: 8, name: '终极 Boss', stars: 5,
    terrain: '机甲基地',
    objective: '最终Boss机甲！攻击其能量核心弱点以击败它！',
    allyStart: new THREE.Vector3(-18, 0, -12),
    allyEnd: new THREE.Vector3(18, 0, -12),
    allySpeed: 4,
    allyHp: 200,
    barriers: [{ x: -4, z: -12 }, { x: 4, z: -13 }],
    enemies: [
      { kind: 'stationary', x: -6, z: -22, hp: 1, fireRate: 1.2 },
      { kind: 'patrol', x: 2, z: -24, hp: 1, fireRate: 0.9, range: 4, speed: 3 },
      { kind: 'heavy', x: 8, z: -22, hp: 5, fireRate: 1.0 },
    ],
    boss: { x: 2, z: -28, hp: 40, fireRate: 1.2, phaseAt: 20 },
  },
];

export { LEVELS };
export const levels = {
  all: LEVELS,
  get(id) { return LEVELS.find(l => l.id === id) || LEVELS[0]; },
  count: LEVELS.length,
};