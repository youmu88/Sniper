/* ============================================================
 * main.js — 3D 狙击手掩护行动 · 主入口
 * Three.js ES modules + importmap，无构建工具
 * ============================================================ */
import * as THREE from 'three';
import { createScene } from './scene-setup.js';
import { CameraControls } from './camera-controls.js';
import { InputManager } from './input.js';
import { createTerrain, createBuildings, createSniperNest } from './terrain.js';
import { createCharacter, createBossCharacter, createDeadBody } from './characters.js';
import { Ally3D } from './allies.js';
import { Enemy3D } from './enemies.js';
import { Weapon } from './weapon.js';
import { ParticleSystem } from './particles.js';
import { HUD } from './hud.js';
import { LEVELS } from './levels.js';

const GROUND_Y = 0;

// ============ 全局状态 ============
const STATE = {
  screen: 'menu',
  levelId: 1,
  unlocked: 1,
  stars: {},
  paused: false,
  gameTime: 0,
  stats: { shots: 0, hits: 0, kills: 0, weakKills: 0 },
  combo: 0,
  comboTimer: 0,
};

// ============ 初始化 ============
const canvas = document.getElementById('gameCanvas');
const { scene, camera, renderer } = createScene(canvas);
const input = new InputManager(canvas);
const fpsCam = new CameraControls(camera, canvas);
const weapon = new Weapon(scene, camera);
const particles = new ParticleSystem(scene);
const hud = new HUD();

let terrain, buildings, sniperNest;
let ally, enemies = [];
let enemyBullets = [];
let levelDef = null;
let lastTime = 0;

// 收集所有可射击目标
function getTargets() {
  const targets = [];
  if (ally && ally.alive) targets.push(ally.mesh);
  enemies.forEach(e => { if (e.alive && e.spawned) targets.push(e.mesh); });
  return targets;
}

// ============ 关卡管理 ============
function loadLevel(id) {
  const def = LEVELS.find(l => l.id === id) || LEVELS[0];
  levelDef = def;

  STATE.levelId = id;
  STATE.gameTime = 0;
  STATE.stats = { shots: 0, hits: 0, kills: 0, weakKills: 0 };
  STATE.combo = 0;
  STATE.comboTimer = 0;
  STATE.paused = false;

  clearLevel();

  // 地形
  terrain = createTerrain(def.terrain);
  scene.add(terrain);

  // 建筑
  buildings = createBuildings(def);
  scene.add(buildings);

  // 狙击位
  sniperNest = createSniperNest();
  scene.add(sniperNest);

  // 重置相机与武器
  fpsCam.reset();
  weapon.reset();

  // 队友（从 allyStart 读取）
  const startX = def.allyStart?.x ?? -18;
  const startZ = def.allyStart?.z ?? -12;
  const endX = def.allyEnd?.x ?? 18;
  ally = new Ally3D({ x: startX, z: startZ, speed: def.allySpeed ?? 28, hp: def.allyHp ?? 100 });
  ally.goalX = endX;
  scene.add(ally.mesh);

  // 敌人
  enemies = [];
  (def.enemies || []).forEach(cfg => {
    const e = new Enemy3D(cfg);
    enemies.push(e);
    scene.add(e.mesh);
  });

  // Boss (单独处理，加在敌人列表后)
  if (def.boss) {
    const boss = new Enemy3D({
      kind: 'boss', x: def.boss.x ?? 0, z: def.boss.z ?? -28,
      hp: def.boss.hp ?? 40, fireRate: def.boss.fireRate ?? 1.3,
      phaseAt: def.boss.phaseAt ?? 20,
    });
    enemies.push(boss);
    scene.add(boss.mesh);
  }

  // 环境雾
  const fogColors = {
    '草原': 0x1a2a4a, '城镇': 0x2a2a3a, '城镇夜': 0x0a0a1a,
    '沙漠': 0x2a2a1a, '废墟': 0x1a1a2a, '雪原': 0x2a3a4a, '机甲基地': 0x0a0a1a,
  };
  const fc = fogColors[def.terrain] || 0x1a2a4a;
  scene.fog = new THREE.Fog(fc, 30, 65);
  scene.background = new THREE.Color(fc);

  // 更新UI
  hud.updateHUD({
    levelId: id, levelName: def.name,
    enemiesAlive: enemies.filter(e => e.alive).length,
    allyHp: Math.round(ally.hpRatio() * 100),
    ammo: weapon.ammo,
    kills: STATE.stats.kills,
    combo: STATE.combo,
  });
}

function clearLevel() {
  if (terrain) { scene.remove(terrain); disposeGroup(terrain); }
  if (buildings) { scene.remove(buildings); disposeGroup(buildings); }
  if (sniperNest) { scene.remove(sniperNest); disposeGroup(sniperNest); }
  if (ally) { ally.dispose(scene); ally = null; }
  enemies.forEach(e => e.dispose(scene));
  enemies = [];
  enemyBullets.forEach(b => { scene.remove(b.mesh); b.mesh.geometry?.dispose(); b.mesh.material?.dispose(); });
  enemyBullets = [];
  weapon.reset(); // 清理弹道
  particles.clear();
}

function disposeGroup(obj) {
  obj.traverse(child => {
    if (child.isMesh) { child.geometry?.dispose(); child.material?.dispose(); }
  });
}

// ============ 游戏循环 ============
function loop(time) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  if (STATE.screen === 'playing' && !STATE.paused) {
    update(dt);
  }

  renderer.render(scene, camera);
}

function update(dt) {
  STATE.gameTime += dt;

  // 鼠标移动 → 视角旋转
  if (input.pointerLocked) {
    fpsCam.isLocked = true;
    fpsCam.rotate(input.mouse.x, input.mouse.y);
    input.mouse.x = 0;
    input.mouse.y = 0;
  } else {
    fpsCam.isLocked = false;
  }

  // 开镜缩放
  fpsCam.setZoom(input.zoom);
  fpsCam.update(dt);

  // 瞄准镜UI
  const scopeEl = document.getElementById('scope-overlay');
  if (input.zoom) {
    scopeEl.classList.add('active');
  } else {
    scopeEl.classList.remove('active');
  }

  // 武器更新
  weapon.update(dt);

  // 射击检测
  if (input.consumeShoot() || input.shooting) {
    const targets = getTargets();
    // 过滤出可见的mesh子对象
    const shootMeshes = [];
    targets.forEach(t => {
      t.traverse(child => { if (child.isMesh) shootMeshes.push(child); });
    });
    const result = weapon.shoot(shootMeshes, input.zoom);

    if (result) {
      STATE.stats.shots++;
      if (result.hit) {
        STATE.stats.hits++;
        particles.sparkHit(result.point, result.normal);

        // 查找命中的 Enemy3D 或 Ally3D 对象
        let hitObj = result.object;
        let enemyRef = null;
        while (hitObj) {
          if (hitObj.userData.enemyRef) { enemyRef = hitObj.userData.enemyRef; break; }
          if (hitObj.userData.isAlly) break;
          hitObj = hitObj.parent;
        }

        if (enemyRef && enemyRef.alive) {
          const dmg = (result.isWeakSpot || result.isCore) ? 8 : 3;
          if (enemyRef.kind === 'boss' && !enemyRef.coreVulnerable && result.isCore) {
            // Boss 核心非暴露时只造成1点伤害
            enemyRef.takeDamage(1);
          } else {
            enemyRef.takeDamage(dmg);
          }

          if (!enemyRef.alive) {
            STATE.stats.kills++;
            STATE.combo++;
            STATE.comboTimer = 2;
            if (result.isWeakSpot || result.isCore) STATE.stats.weakKills++;
            particles.burstExplosion(result.point, enemyRef.kind === 'boss');
            playSound('kill');
          } else {
            playSound('hit');
          }
        } else {
          playSound('miss');
        }
      } else {
        playSound('miss');
      }
    }
  }

  // 队友更新
  if (ally) {
    ally.update(dt, ally.goalX || 18);
  }

  // 敌人更新
  const allyAlive = ally ? ally.alive : false;
  enemies.forEach(e => {
    const res = e.update(dt, ally ? ally.x : 0, allyAlive);
    if (res?.fired) {
      spawnEnemyBullet(e.x, e.z);
    }
    if (res?.barrage) {
      for (let i = 0; i < 5; i++) {
        spawnEnemyBullet(e.x + (Math.random() - 0.5) * 4, e.z);
      }
    }
    if (res?.killed) {
      particles.burstExplosion(new THREE.Vector3(e.x, 1, e.z), e.kind === 'boss');
    }
  });

  enemies = enemies.filter(e => e.alive);

  // 敌弹更新
  updateEnemyBullets(dt);

  // 连击计时
  if (STATE.comboTimer > 0) {
    STATE.comboTimer -= dt;
    if (STATE.comboTimer <= 0) STATE.combo = 0;
  }

  // 粒子更新
  particles.update(dt);

  // 胜负判定
  if (levelDef.boss) {
    // Boss关：队友到达终点 AND Boss死亡
    if (ally && ally.reached && !enemies.some(e => e.kind === 'boss' && e.alive)) {
      winLevel();
    }
  } else if (ally && ally.reached) {
    // 普通关：队友到达终点
    winLevel();
  }

  if (ally && !ally.alive) {
    loseLevel();
  }

  // HUD 更新
  const boss = enemies.find(e => e.kind === 'boss' && e.alive);
  const progress = ally ? Math.min(1, Math.max(0, (ally.x - (-18)) / (18 - (-18)))) : 0;
  hud.updateHUD({
    levelId: STATE.levelId,
    levelName: levelDef?.name || '',
    enemiesAlive: enemies.filter(e => e.alive && e.spawned).length,
    allyHp: ally ? Math.round(ally.hpRatio() * 100) : 0,
    ammo: weapon.ammo,
    kills: STATE.stats.kills,
    combo: STATE.combo,
    progress,
    bossHp: boss ? Math.round(boss.hp / boss.maxHp * 100) : 0,
  });
}

// ============ 敌弹 ============
function spawnEnemyBullet(x, z) {
  const geo = new THREE.SphereGeometry(0.08, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 1.0, z);
  scene.add(mesh);
  enemyBullets.push({
    mesh,
    vx: (ally ? ally.x - x : 0) * 0.5,
    vz: (ally ? ally.z - z : 0) * 0.5,
    life: 2.0,
  });
}

function updateEnemyBullets(dt) {
  enemyBullets.forEach(b => {
    b.mesh.position.x += b.vx * dt;
    b.mesh.position.z += b.vz * dt;
    b.life -= dt;
    if (ally && ally.alive) {
      const dx = b.mesh.position.x - ally.x;
      const dz = b.mesh.position.z - ally.z;
      if (Math.sqrt(dx * dx + dz * dz) < 0.6) {
        ally.takeDamage(8);
        b.life = 0;
        particles.sparkHit(b.mesh.position.clone(), new THREE.Vector3(0, 1, 0));
      }
    }
  });
  // 清理
  enemyBullets = enemyBullets.filter(b => {
    if (b.life <= 0) {
      scene.remove(b.mesh);
      b.mesh.geometry?.dispose();
      b.mesh.material?.dispose();
      return false;
    }
    return true;
  });
}

// ============ 胜负 ============
function winLevel() {
  STATE.screen = 'win';
  const rating = computeRating();
  STATE.stars[STATE.levelId] = Math.max(STATE.stars[STATE.levelId] || 0, rating);
  if (STATE.levelId === STATE.unlocked && STATE.levelId < LEVELS.length) {
    STATE.unlocked++;
  }
  saveProgress();
  playSound('victory');
  hud.showWinScreen(rating, STATE);
  input.unlockPointer();
}

function loseLevel() {
  STATE.screen = 'dead';
  playSound('defeat');
  hud.showDeadScreen();
  input.unlockPointer();
}

function computeRating() {
  const st = STATE.stats;
  const hitRate = st.shots > 0 ? st.hits / st.shots : 0;
  let score = 1;
  if (hitRate >= 0.6) score++;
  if (ally && ally.hpRatio() >= 0.6) score++;
  return Math.min(3, score);
}

// ============ 音效 (复用现有 audio.js) ============
function playSound(name) {
  try {
    const S = window.Sniper;
    if (S && S.audio) {
      S.audio.unlock();
      S.audio.play(name);
    }
  } catch (e) { /* 音效可选 */ }
}

// ============ 存档 ============
function loadProgress() {
  try {
    const raw = localStorage.getItem('sniper3d_unlocked');
    STATE.unlocked = raw ? parseInt(raw, 10) || 1 : 1;
    const s = localStorage.getItem('sniper3d_stars');
    if (s) STATE.stars = JSON.parse(s);
  } catch (e) { STATE.unlocked = 1; STATE.stars = {}; }
}

function saveProgress() {
  try {
    localStorage.setItem('sniper3d_unlocked', String(STATE.unlocked));
    localStorage.setItem('sniper3d_stars', JSON.stringify(STATE.stars));
  } catch (e) {}
}

// ============ UI 绑定 ============
function bindUI() {
  document.getElementById('btnStart').addEventListener('click', () => {
    playSound('ui');
    hud.showSelectScreen(STATE, LEVELS);
  });
  document.getElementById('btnSelectHome').addEventListener('click', () => {
    playSound('ui');
    hud.showMenuScreen();
  });
  document.getElementById('btnRetry').addEventListener('click', () => {
    playSound('ui');
    STATE.screen = 'playing';
    loadLevel(STATE.levelId);
    canvas.requestPointerLock();
  });
  document.getElementById('btnRetryWin').addEventListener('click', () => {
    playSound('ui');
    STATE.screen = 'playing';
    loadLevel(STATE.levelId);
    canvas.requestPointerLock();
  });
  document.getElementById('btnNext').addEventListener('click', () => {
    playSound('ui');
    if (STATE.levelId < LEVELS.length) {
      STATE.screen = 'playing';
      loadLevel(STATE.levelId + 1);
      canvas.requestPointerLock();
    } else {
      hud.showWinAllScreen();
    }
  });
  document.getElementById('btnSelectHome2').addEventListener('click', () => {
    playSound('ui');
    hud.showMenuScreen();
  });
  document.getElementById('btnWinAllReplay').addEventListener('click', () => {
    playSound('ui');
    hud.showMenuScreen();
  });

  // 关卡选择（事件委托）
  document.getElementById('levelGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.levelCard');
    if (!card || card.classList.contains('locked')) return;
    const id = parseInt(card.dataset.levelId, 10);
    if (id) {
      playSound('ui');
      STATE.screen = 'playing';
      loadLevel(id);
      canvas.requestPointerLock();
    }
  });

  // 暂停
  input.onPause(() => {
    if (STATE.screen === 'playing') {
      STATE.paused = !STATE.paused;
      document.getElementById('pauseTip').style.display = STATE.paused ? 'flex' : 'none';
    }
  });
}

// ============ 启动 ============
loadProgress();
bindUI();
hud.showMenuScreen();
lastTime = performance.now();
loop(lastTime);

console.log('🔭 Sniper Cover Duty 3D loaded');
console.log(`📦 Three.js version: ${THREE.REVISION}`);