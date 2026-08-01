/* ============================================================
 * characters.js — 低多边形人物工厂 (Box/Sphere/Cylinder 组合)
 * ============================================================ */
import * as THREE from 'three';

// 人物调色板
const PALETTE = {
  ally: {
    body: 0x3f7d44, helmet: 0x4a5568, skin: 0xe8b16c,
    pants: 0x2c3e50, boots: 0x718096, gun: 0x6b7280,
  },
  enemy: {
    body: 0xc0392b, helmet: 0x922b21, skin: 0xe8b16c,
    pants: 0x7b241c, boots: 0x718096, gun: 0x6b7280,
  },
  heavy: {
    body: 0xe74c3c, helmet: 0xa93226, skin: 0xe8b16c,
    pants: 0x4a0000, boots: 0x718096, gun: 0x6b7280,
  },
  boss: {
    body: 0x4a0080, helmet: 0x2a0050, skin: 0x8a2be2,
    pants: 0x1a0030, boots: 0x6b6b6b, gun: 0xff4444,
  },
};

// 人物尺寸
const BODY = { w: 0.7, h: 0.9, d: 0.4 };
const HEAD_R = 0.22;
const ARM = { r: 0.07, h: 0.45 };
const LEG = { w: 0.18, h: 0.45, d: 0.18 };
const GUN = { w: 0.06, h: 0.5, d: 0.06 };

// 共享几何体（减少内存）
const geoBody = new THREE.BoxGeometry(BODY.w, BODY.h, BODY.d);
const geoHead = new THREE.SphereGeometry(HEAD_R, 6, 6);
const geoArm = new THREE.CylinderGeometry(ARM.r, ARM.r, ARM.h, 4);
const geoLeg = new THREE.BoxGeometry(LEG.w, LEG.h, LEG.d);
const geoGun = new THREE.BoxGeometry(GUN.w, GUN.h, GUN.d);

// 死亡几何体（横躺）
const geoDead = new THREE.BoxGeometry(0.9, 0.3, 0.4);

/** 创建低多边形人物 Group */
export function createCharacter(colorKey, scale = 1) {
  const pal = PALETTE[colorKey] || PALETTE.enemy;
  const group = new THREE.Group();
  group.userData.colorKey = colorKey;

  // 材质
  const matBody = new THREE.MeshStandardMaterial({ color: pal.body, roughness: 0.7 });
  const matHead = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.6 });
  const matHelmet = new THREE.MeshStandardMaterial({ color: pal.helmet, roughness: 0.5 });
  const matPants = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.8 });
  const matBoots = new THREE.MeshStandardMaterial({ color: pal.boots, roughness: 0.9 });
  const matGun = new THREE.MeshStandardMaterial({ color: pal.gun, roughness: 0.5 });

  // 身体
  const body = new THREE.Mesh(geoBody, matBody);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  // 头
  const head = new THREE.Mesh(geoHead, matHead);
  head.position.set(0, 1.6, 0);
  head.castShadow = true;
  group.add(head);

  // 头盔（半圆顶）
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R + 0.03, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), matHelmet);
  helmet.position.set(0, 1.67, 0);
  group.add(helmet);

  // 左臂
  const lArm = new THREE.Mesh(geoArm, matBody);
  lArm.position.set(-BODY.w / 2 - 0.04, 1.2, 0);
  lArm.rotation.z = 0.2;
  group.add(lArm);

  // 右臂 + 枪
  const rArm = new THREE.Mesh(geoArm, matBody);
  rArm.position.set(BODY.w / 2 + 0.04, 1.15, 0);
  rArm.rotation.z = -0.3;
  group.add(rArm);

  const gun = new THREE.Mesh(geoGun, matGun);
  gun.position.set(BODY.w / 2 + 0.25, 1.05, 0);
  gun.rotation.z = -0.1;
  group.add(gun);

  // 左腿
  const lLeg = new THREE.Mesh(geoLeg, matPants);
  lLeg.position.set(-0.15, 0.48, 0);
  group.add(lLeg);
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.24), matBoots);
  lBoot.position.set(-0.15, 0.23, 0.04);
  group.add(lBoot);

  // 右腿
  const rLeg = new THREE.Mesh(geoLeg, matPants);
  rLeg.position.set(0.15, 0.48, 0);
  group.add(rLeg);
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.24), matBoots);
  rBoot.position.set(0.15, 0.23, 0.04);
  group.add(rBoot);

  // 保存引用用于动画
  group.userData.parts = { lLeg, rLeg, lArm, rArm, body, gun };
  group.userData.scale = scale;

  group.scale.set(scale, scale, scale);
  return group;
}

/** 创建 Boss 机甲 */
export function createBossCharacter() {
  const group = new THREE.Group();
  const pal = PALETTE.boss;

  const matBody = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.3, metalness: 0.6 });
  const matArmor = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.4, metalness: 0.5 });
  const matCore = new THREE.MeshStandardMaterial({ color: 0x8a2be2, emissive: 0x8a2be2, emissiveIntensity: 0.5 });
  const matEye = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.8 });

  // 躯干
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.0), matBody);
  torso.position.y = 1.6;
  torso.castShadow = true;
  group.add(torso);

  // 核心（弱点）
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), matCore);
  core.position.set(0, 1.5, 0.55);
  core.userData.isCore = true;
  group.add(core);

  // 头
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), matArmor);
  head.position.set(0, 2.6, 0);
  group.add(head);
  // 眼睛
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), matEye);
  eyeL.position.set(-0.2, 2.65, 0.35);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), matEye);
  eyeR.position.set(0.2, 2.65, 0.35);
  group.add(eyeR);

  // 肩甲
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), matArmor);
    shoulder.position.set(side * 1.1, 2.2, 0);
    group.add(shoulder);
    // 臂
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), matBody);
    arm.position.set(side * 1.1, 1.2, 0);
    group.add(arm);
  }

  // 腿
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.5), matBody);
    leg.position.set(side * 0.4, 0.4, 0);
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.6), matArmor);
    foot.position.set(side * 0.4, 0.05, 0.05);
    group.add(foot);
  }

  group.userData.parts = { torso, core, head };
  group.userData.isBoss = true;
  group.scale.set(1.2, 1.2, 1.2);
  return group;
}

/** 创建死亡尸体（横躺） */
export function createDeadBody(colorKey) {
  const pal = PALETTE[colorKey] || PALETTE.enemy;
  const mat = new THREE.MeshStandardMaterial({ color: pal.body, roughness: 0.8 });
  const mesh = new THREE.Mesh(geoDead, mat);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

/** 人物走路动画（摆动腿/臂） */
export function animateCharacter(group, time, moving) {
  const parts = group.userData.parts;
  if (!parts) return;
  const speed = moving ? 8 : 0;
  const swing = moving ? Math.sin(time * speed) * 0.3 : 0;
  if (parts.lLeg) parts.lLeg.rotation.x = swing;
  if (parts.rLeg) parts.rLeg.rotation.x = -swing;
  if (parts.lArm) parts.lArm.rotation.x = -swing * 0.5;
  if (parts.rArm) parts.rArm.rotation.x = swing * 0.5;
}
