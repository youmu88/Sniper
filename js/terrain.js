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
