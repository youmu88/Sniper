/* ============================================================
 * terrain.js — 3D 战场地形生成
 * ============================================================ */
import * as THREE from 'three';

// 地形参数
const GROUND_SIZE = 60;
const GROUND_SEG = 40;

// 地形类型配置
const TERRAIN_CFG = {
  '草原': { color: 0x6a9c5a, fog: 0x1a2a4a, roughness: 0.9 },
  '城镇': { color: 0x8a7a6a, fog: 0x2a2a3a, roughness: 0.8 },
  '城镇夜': { color: 0x3a3a4a, fog: 0x0a0a1a, roughness: 0.7 },
  '沙漠': { color: 0xccb280, fog: 0x2a2a1a, roughness: 0.9 },
  '废墟': { color: 0x7a6a5a, fog: 0x1a1a2a, roughness: 0.8 },
  '雪原': { color: 0xccddee, fog: 0x2a3a4a, roughness: 0.6 },
  '机甲基地': { color: 0x3a3f4a, fog: 0x0a0a1a, roughness: 0.5 },
};

/** 创建战场地形 */
export function createTerrain(terrainType) {
  const cfg = TERRAIN_CFG[terrainType] || TERRAIN_CFG['草原'];
  const group = new THREE.Group();

  // 地面（带起伏）
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEG, GROUND_SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    // 只在远处加微起伏（近处平坦）
    const dist = Math.sqrt(x * x + z * z);
    if (z < -10) {
      const h = Math.sin(x * 0.3) * 0.15 + Math.cos(z * 0.2) * 0.1;
      pos.setY(i, h);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: cfg.color,
    roughness: cfg.roughness,
    metalness: 0.0,
    flatShading: true,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(0, -0.1, -25);
  ground.receiveShadow = true;
  group.add(ground);

  // 道路（从起点到终点，沿x轴）
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.9 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 2.5), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.05, -12);
  road.receiveShadow = true;
  group.add(road);

  // 背景山脉
  const mtMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const w = 8 + Math.random() * 12;
    const h = 3 + Math.random() * 6;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), mtMat);
    mt.position.set((i - 3) * 10 + Math.random() * 4, 0, -45 - Math.random() * 8);
    mt.scale.y = 0.5 + Math.random() * 0.5;
    group.add(mt);
  }

  return group;
}

/** 创建战场建筑/掩体 */
export function createBuildings(levelDef) {
  const group = new THREE.Group();
  const terrain = levelDef.terrain || '草原';
  const isNight = terrain === '城镇夜';

  // 建筑颜色
  const colors = isNight ? [0x2a3040, 0x3a4050, 0x1a2030] : [0x6a7a5a, 0x7a8a6a, 0x5a6a4a];
  if (terrain === '废墟') colors.splice(0, 3, 0x5a4a3a, 0x6a5a4a, 0x4a3a2a);
  if (terrain === '机甲基地') colors.splice(0, 3, 0x4a4a5a, 0x3a3a4a, 0x2a2a3a);

  // 在战场两侧加建筑
  const buildingPositions = [
    { x: -22, z: -18, w: 3, h: 3.5, d: 3 },
    { x: -18, z: -28, w: 2.5, h: 2.5, d: 2.5 },
    { x: 22, z: -15, w: 3, h: 4, d: 3 },
    { x: 20, z: -28, w: 2.5, h: 2.5, d: 2.5 },
    { x: -15, z: -38, w: 4, h: 5, d: 3.5 },
    { x: 15, z: -38, w: 3.5, h: 4.5, d: 3 },
  ];

  buildingPositions.forEach((p, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: colors[i % colors.length],
      roughness: 0.8,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
    mesh.position.set(p.x, p.h / 2, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 窗户（夜战时亮灯）
    if (isNight) {
      const winMat = new THREE.MeshStandardMaterial({
        color: 0xf7dc6f,
        emissive: 0xf7dc6f,
        emissiveIntensity: 0.3,
      });
      for (let wy = 0; wy < 2; wy++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), winMat);
        win.position.set(p.x, p.h * 0.3 + wy * 0.8, p.z - p.d / 2 - 0.01);
        group.add(win);
      }
    }
  });

  // 掩体（沙袋/矮墙）
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 });
  if (levelDef.barriers) {
    levelDef.barriers.forEach(b => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), barrierMat);
      wall.position.set(b.x, 0.25, b.z || -12);
      wall.castShadow = true;
      group.add(wall);
    });
  }

  // 木箱
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat);
    crate.position.set(-8 + i * 4 + Math.random() * 2, 0.4, -22 + Math.random() * 4);
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);
  }

  return group;
}

/** 创建狙击手所在位置（掩体/伪装） */
export function createSniperNest() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.9 });

  // 灌木伪装
  for (let i = 0; i < 5; i++) {
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 5, 5),
      mat
    );
    bush.position.set(
      (Math.random() - 0.5) * 2,
      -0.2 + Math.random() * 0.3,
      14 + Math.random() * 0.5
    );
    group.add(bush);
  }
  return group;
}

/* ============================================================
 * createProps — 战场布景系统（按地形主题差异化，提升场景丰富度）
 * 布景置于战场两侧与纵深，避开道路与敌群刷新区
 * ============================================================ */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** 板条木箱（Canvas 纹理） */
function _createCrate(w, h, d, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color || '#8a6a3a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(40,25,8,0.85)';
  ctx.lineWidth = 4;
  // 板条边框
  ctx.strokeRect(3, 3, 58, 58);
  ctx.beginPath();
  ctx.moveTo(32, 3); ctx.lineTo(32, 61);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, 32); ctx.lineTo(61, 32);
  ctx.stroke();
  // 对角斜撑
  ctx.beginPath();
  ctx.moveTo(6, 58); ctx.lineTo(58, 6);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 沙袋堆（交错box） */
function _createSandbagGroup(cx, cz) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.95 });
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const n = 3 - r;
    for (let i = 0; i < n; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.34), mat);
      bag.position.set(cx + (i - (n - 1) / 2) * 0.55, 0.14 + r * 0.26, cz + (r % 2) * 0.12);
      bag.rotation.y = (Math.random() - 0.5) * 0.4;
      bag.castShadow = true;
      group.add(bag);
    }
  }
  return group;
}

/** 铁丝网 */
function _createBarbedWire(cx, cz, len = 5) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4a3a, roughness: 0.8 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.5, metalness: 0.6 });
  const posts = 4;
  for (let i = 0; i < posts; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), postMat);
    post.position.set(cx + (i / (posts - 1) - 0.5) * len, 0.55, cz);
    group.add(post);
  }
  for (let h = 0; h < 3; h++) {
    const y = 0.3 + h * 0.3;
    const wire = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.02), wireMat);
    wire.position.set(cx, y, cz);
    group.add(wire);
  }
  return group;
}

/** 树（草原） */
function _createTree(cx, cz) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a6a35, roughness: 0.8 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6), trunkMat);
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  group.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.85, 7, 6), leafMat);
  crown.position.y = 2.1;
  crown.castShadow = true;
  group.add(crown);
  group.position.set(cx, 0, cz);
  return group;
}

/** 松树（雪原） */
function _createPine(cx, cz) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.85 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), trunkMat);
  trunk.position.y = 0.6;
  group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const r = 0.9 - i * 0.24;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.0, 7), leafMat);
    cone.position.y = 1.2 + i * 0.72;
    cone.castShadow = true;
    group.add(cone);
  }
  group.position.set(cx, 0, cz);
  return group;
}

/** 岩石 */
function _createRock(cx, cz, s = 1) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.95, flatShading: true });
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
  rock.position.set(cx, s * 0.4, cz);
  rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  rock.scale.y = rand(0.6, 0.9);
  rock.castShadow = true;
  return rock;
}

/** 仙人掌（沙漠） */
function _createCactus(cx, cz) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.8, 6), mat);
  trunk.position.y = 0.9;
  group.add(trunk);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 5), mat);
    arm.position.set(side * 0.24, 1.2, 0);
    arm.rotation.z = side * 0.9;
    group.add(arm);
  }
  group.position.set(cx, 0, cz);
  return group;
}

/** 路灯（城镇/城镇夜，夜晚发光） */
function _createStreetLamp(cx, cz, lit) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.7, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), poleMat);
  pole.position.y = 2.1;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), poleMat);
  arm.position.set(0.35, 4.0, 0);
  group.add(arm);
  const lampMat = new THREE.MeshStandardMaterial({
    color: lit ? 0xfff3c0 : 0x6a6a6a,
    emissive: lit ? 0xffd080 : 0x000000,
    emissiveIntensity: lit ? 1.4 : 0,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), lampMat);
  lamp.position.set(0.7, 3.95, 0);
  group.add(lamp);
  group.position.set(cx, 0, cz);
  return group;
}

/** 断墙（废墟/城镇） */
function _createBrokenWall(cx, cz) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95, flatShading: true });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.35), mat);
  base.position.y = 0.7;
  base.castShadow = true;
  group.add(base);
  // 参差破损砖块
  for (let i = 0; i < 4; i++) {
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(rand(0.3, 0.6), rand(0.2, 0.4), 0.3), mat);
    chunk.position.set(rand(-0.9, 0.9), 1.5 + rand(0, 0.35), 0);
    chunk.rotation.z = rand(-0.3, 0.3);
    group.add(chunk);
  }
  group.position.set(cx, 0, cz);
  return group;
}

/** 瓦砾堆（废墟） */
function _createRubble(cx, cz) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(rand(0.2, 0.5), rand(0.15, 0.35), rand(0.2, 0.5)), mat);
    piece.position.set(rand(-0.7, 0.7), rand(0.08, 0.3), rand(-0.4, 0.4));
    piece.rotation.set(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5));
    group.add(piece);
  }
  group.position.set(cx, 0, cz);
  return group;
}

/** 烧毁车辆残骸（废墟） */
function _createBurntVehicle(cx, cz) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.9, metalness: 0.2 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 1.0), bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.9), bodyMat);
  cabin.position.set(-0.15, 1.05, 0);
  group.add(cabin);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 8), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(end * 0.72, 0.26, side * 0.52);
      group.add(tire);
    }
  }
  group.position.set(cx, 0, cz);
  group.rotation.y = rand(-0.6, 0.6);
  return group;
}

/** 金属立柱 + 警示灯（机甲基地） */
function _createMetalPillar(cx, cz, lit) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a5f6a, roughness: 0.4, metalness: 0.7 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 5.2, 7), mat);
  pillar.position.y = 2.6;
  pillar.castShadow = true;
  group.add(pillar);
  const lightMat = new THREE.MeshStandardMaterial({
    color: lit ? 0xff5040 : 0x3a3a3a,
    emissive: lit ? 0xff3020 : 0x000000,
    emissiveIntensity: lit ? 1.6 : 0,
  });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), lightMat);
  light.position.y = 5.3;
  group.add(light);
  group.position.set(cx, 0, cz);
  return group;
}

/** 按地形生成差异化布景 */
export function createProps(levelDef) {
  const group = new THREE.Group();
  const terrain = levelDef.terrain || '草原';
  const isNight = terrain === '城镇夜' || terrain === '机甲基地';

  // 公共：沙袋堆 + 铁丝网（随机分布于两侧）
  const sideSpots = [
    { x: -16, z: -24 }, { x: 16, z: -24 }, { x: -20, z: -32 }, { x: 20, z: -32 },
  ];
  const sandbags = pick(sideSpots);
  const wire = pick(sideSpots.filter(s => s !== sandbags));
  group.add(_createSandbagGroup(sandbags.x, sandbags.z));
  group.add(_createBarbedWire(wire.x, wire.z));

  // 地形主题元素
  const props = [];
  if (terrain === '草原') {
    for (let i = 0; i < 5; i++) props.push(_createTree(rand(-28, -12), rand(-40, -20)));
    for (let i = 0; i < 5; i++) props.push(_createTree(rand(12, 28), rand(-40, -20)));
    for (let i = 0; i < 5; i++) props.push(_createRock(rand(-28, 28), rand(-44, -34), rand(0.4, 0.8)));
    for (let i = 0; i < 3; i++) props.push(_createCrate(rand(0.7, 0.9), rand(0.7, 0.9), rand(0.7, 0.9)));
  } else if (terrain === '城镇' || terrain === '城镇夜') {
    const lampCount = isNight ? 5 : 3;
    for (let i = 0; i < lampCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      props.push(_createStreetLamp(side * rand(9, 14), rand(-16, -13), isNight));
    }
    for (let i = 0; i < 4; i++) props.push(_createBrokenWall(rand(-28, 28), rand(-40, -26)));
    for (let i = 0; i < 4; i++) props.push(_createCrate(rand(0.7, 0.9), rand(0.7, 0.9), rand(0.7, 0.9)));
  } else if (terrain === '沙漠') {
    for (let i = 0; i < 6; i++) props.push(_createCactus(rand(-28, 28), rand(-40, -22)));
    for (let i = 0; i < 7; i++) props.push(_createRock(rand(-30, 30), rand(-46, -30), rand(0.5, 1.1)));
  } else if (terrain === '废墟') {
    for (let i = 0; i < 4; i++) props.push(_createBrokenWall(rand(-28, 28), rand(-40, -24)));
    for (let i = 0; i < 5; i++) props.push(_createRubble(rand(-27, 27), rand(-36, -22)));
    for (let i = 0; i < 2; i++) props.push(_createBurntVehicle(rand(-20, 20), rand(-34, -26)));
  } else if (terrain === '雪原') {
    for (let i = 0; i < 7; i++) props.push(_createPine(rand(-28, -10), rand(-42, -20)));
    for (let i = 0; i < 7; i++) props.push(_createPine(rand(10, 28), rand(-42, -20)));
    for (let i = 0; i < 4; i++) props.push(_createRock(rand(-28, 28), rand(-44, -34), rand(0.4, 0.7)));
  } else if (terrain === '机甲基地') {
    for (let i = 0; i < 5; i++) props.push(_createMetalPillar(rand(-28, 28), rand(-42, -24), i % 2 === 0));
    for (let i = 0; i < 4; i++) props.push(_createCrate(rand(0.8, 1.0), rand(0.8, 1.0), rand(0.8, 1.0), '#4a5560'));
  }

  props.forEach(p => group.add(p));

  // ============ 每关专属装饰（Canvas 程序化高清纹理，提升辨识度） ============
  const specials = [];
  if (levelDef.id === 1) {
    // L1 教学关：训练靶（木桩 + 靶心）
    const target = _createTarget(rand(-14, -16), rand(-30, -26));
    if (target) specials.push(target);
  } else if (levelDef.id === 2) {
    // L2 草原：废弃弹药箱堆（残骸氛围）
    const pile = _createAmmoPile(rand(-18, -22), rand(-30, -26));
    if (pile) specials.push(pile);
  } else if (levelDef.id === 3) {
    // L3 城镇：涂鸦墙
    const wall = _createGraffitiWall(rand(-24, -28), rand(-30, -26));
    if (wall) specials.push(wall);
  } else if (levelDef.id === 4) {
    // L4 城镇夜：霓虹灯牌（发光）
    const neon = _createNeonSign(rand(-18, -22), rand(-28, -24));
    if (neon) specials.push(neon);
  } else if (levelDef.id === 5) {
    // L5 沙漠：风化石柱（天然掩体）
    const col = _createStoneColumn(rand(-20, -24), rand(-34, -30));
    if (col) specials.push(col);
  } else if (levelDef.id === 6) {
    // L6 废墟：破损车辆残骸
    const wreck = _createBurntVehicle(rand(-16, -20), rand(-30, -26));
    if (wreck) specials.push(wreck);
  } else if (levelDef.id === 7) {
    // L7 雪原：信号旗杆（孤寂氛围）
    const flag = _createSignalFlag(rand(-20, -24), rand(-32, -28));
    if (flag) specials.push(flag);
  } else if (levelDef.id === 8) {
    // L8 机甲基地：能量罐（警示纹理）
    const tank = _createEnergyTank(rand(-14, -18), rand(-32, -28));
    if (tank) specials.push(tank);
  }
  specials.forEach(p => group.add(p));
  return group;
}

/** 废弃弹药箱堆（L2 草原） */
function _createAmmoPile(x, z) {
  try {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a6a3a, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), mat);
      crate.position.set((i % 2) * 0.55 - 0.28, 0.2 + Math.floor(i / 2) * 0.42, (Math.floor(i / 2) % 2) * 0.3);
      crate.rotation.y = (i % 3) * 0.15;
      crate.castShadow = true;
      group.add(crate);
    }
    group.position.set(x, 0, z);
    return group;
  } catch (e) { return null; }
}

/** 风化石柱（L5 沙漠） */
function _createStoneColumn(x, z) {
  try {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.95, flatShading: true });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.6, 7), mat);
    col.position.y = 1.3; col.castShadow = true;
    group.add(col);
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), mat);
    cap.position.y = 2.7; cap.rotation.set(0.3, 0, 0.4);
    group.add(cap);
    group.position.set(x, 0, z);
    return group;
  } catch (e) { return null; }
}

/** 信号旗杆（L7 雪原） */
function _createSignalFlag(x, z) {
  try {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.4 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6), poleMat);
    pole.position.y = 1.6; group.add(pole);
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, 64, 40);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(12, 8, 8, 8); ctx.fillRect(28, 20, 8, 8); ctx.fillRect(12, 32, 8, 8);
    const tex = new THREE.CanvasTexture(canvas);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    flag.position.set(0.45, 2.9, 0); group.add(flag);
    group.position.set(x, 0, z);
    return group;
  } catch (e) { return null; }
}

/** 训练靶：木桩 + Canvas 靶心环 */
function _createTarget(x, z) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const rings = [['#ffffff', 62], ['#e05555', 48], ['#ffffff', 34], ['#e05555', 20], ['#dd2222', 7]];
    rings.forEach(([c, r]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.fill(); });
    const tex = new THREE.CanvasTexture(canvas);
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), postMat);
    post.position.y = 0.75; post.castShadow = true; group.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    board.position.y = 1.7; board.castShadow = true; group.add(board);
    group.position.set(x, 0, z);
    return group;
  } catch (e) { return null; }
}

/** 涂鸦墙：墙面 + Canvas 涂鸦（★ 标记） */
function _createGraffitiWall(x, z) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6a5a4a'; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 6;
    ctx.strokeRect(18, 16, 60, 90);
    ctx.fillStyle = '#e67e22';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(150 + i * 16, 60, 8, 8);
      ctx.fillRect(154 + i * 16, 40, 8, 8);
      ctx.fillRect(154 + i * 16, 80, 8, 8);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.25), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    wall.position.set(x, 0.6, z); wall.castShadow = true;
    return wall;
  } catch (e) { return null; }
}

/** 霓虹灯牌：发光标牌（夜战氛围） */
function _createNeonSign(x, z) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(20,10,30,0.9)'; ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#ff55ff'; ctx.lineWidth = 4; ctx.shadowColor = '#ff55ff'; ctx.shadowBlur = 12;
    ctx.font = 'bold 30px system-ui'; ctx.fillStyle = '#ff88ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('HOTEL', 64, 34);
    const tex = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.12),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0x8833aa, emissiveIntensity: 0.8, roughness: 0.4 }));
    sign.position.set(x, 3.2, z); sign.castShadow = true;
    return sign;
  } catch (e) { return null; }
}

/** 能量罐：圆筒 + 警示条纹（机甲基地） */
function _createEnergyTank(x, z) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a4a5a'; ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#e8c93a';
    for (let y = 16; y < 128; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y - 12); ctx.lineTo(64, y + 4); ctx.lineTo(0, y + 20); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 12),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.4 }));
    tank.position.set(x, 0.8, z); tank.castShadow = true;
    return tank;
  } catch (e) { return null; }
}
