/* ============================================================
 * enemies.js — 3D 敌人 AI
 * 兵种：静止/巡逻/冲锋/掩体/狙击手/重甲/Boss
 * ============================================================ */
import * as THREE from 'three';
import { createCharacter, createBossCharacter } from './characters.js';

const GROUND_Y = 0;

// 兵种配置
const ENEMY_CFG = {
  stationary: { hp: 1, speed: 0, fireRate: 0.8, scale: 0.9 },
  patrol: { hp: 1, speed: 11, fireRate: 0.6, scale: 0.9 },
  charger: { hp: 3, speed: 32, fireRate: 0, scale: 0.9 },
  crouch: { hp: 2, speed: 0, fireRate: 0.6, scale: 0.9 },
  sniper: { hp: 4, speed: 0, fireRate: 1.0, scale: 0.9 },
  heavy: { hp: 6, speed: 0, fireRate: 1.0, scale: 1.0 },
  boss: { hp: 40, speed: 0, fireRate: 1.3, scale: 1.2 },
};

export class Enemy3D {
  constructor(cfg) {
    this.kind = cfg.kind || 'stationary';
    const def = ENEMY_CFG[this.kind] || ENEMY_CFG.stationary;
    this.hp = cfg.hp != null ? cfg.hp : def.hp;
    this.maxHp = this.hp;
    this.speed = cfg.speed != null ? cfg.speed : def.speed;
    this.fireRate = cfg.fireRate != null ? cfg.fireRate : def.fireRate;
    this.x = cfg.x || 0;
    this.z = cfg.z || -15;
    this.fireTimer = Math.random() * (1 / (this.fireRate || 1));
    this.alive = true;
    this.spawned = !cfg.delay || cfg.delay <= 0;
    this.delay = cfg.delay || 0;
    this.dir = 1;
    this.visible = true;

    // 巡逻范围（levels 用 range 简写：x ± range；显式 minX/maxX 优先）
    const range = cfg.range != null ? cfg.range : 4;
    this.minX = cfg.minX != null ? cfg.minX : this.x - range;
    this.maxX = cfg.maxX != null ? cfg.maxX : this.x + range;
    this.minZ = cfg.minZ != null ? cfg.minZ : this.z;
    this.maxZ = cfg.maxZ != null ? cfg.maxZ : this.z;

    // 掩体探头
    this.peekInterval = cfg.peekInterval || 2.0;
    this.peekDur = cfg.peekDur || 1.0;
    this.peekTimer = Math.random() * this.peekInterval;

    // 狙击手瞄準
    this.aimTime = cfg.aimTime || 1.5;
    this.aimProgress = 0;
    this.aiming = false;

    // Boss
    this.bossPhase = 0;
    this.phaseAt = cfg.phaseAt || 0;
    this.coreVulnerable = false;
    this.coreTimer = 0;
    this.barrageTimer = 4;

    // 创建3D模型
    const colorKey = this.kind === 'boss' ? 'boss' : this.kind === 'heavy' ? 'heavy' : 'enemy';
    this.mesh = this.kind === 'boss' ? createBossCharacter() : createCharacter(colorKey, def.scale);
    this.mesh.position.set(this.x, GROUND_Y, this.z);
    this.mesh.userData.isEnemy = true;
    this.mesh.userData.enemyRef = this;

    // 红外热成像状态（夜战核心机制）
    this._thermal = false;
    this._matRefs = this._collectMaterials();

    // 面向队友（默认朝+ x方向）
    this.mesh.rotation.y = 0;

    // 血条（精灵）
    this.hpBar = this._createHPBar();
    this.mesh.add(this.hpBar);

    // 受伤闪烁
    this.hurtFlash = 0;
    // 行走动画计时
    this.walkT = 0;
  }

  /** 收集所有可发光的材质引用（供红外热成像切换） */
  _collectMaterials() {
    const refs = [];
    this.mesh.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          if (m && 'emissive' in m) {
            const isCore = c.userData.isCore;
            const isEye = c.userData.isEye;
            refs.push({ mat: m, isCore, isEye });
            this._applyThermal(m, isCore, isEye, false); // 初始应用关镜暗态
          }
        });
      }
    });
    return refs;
  }

  /** 应用红外热成像发光态：active=true 开镜白热，false 关镜暗红 */
  _applyThermal(mat, isCore, isEye, active) {
    if (this.kind === 'boss' && (isCore || isEye)) {
      // Boss 核心/眼睛自身发光，热成像下进一步拉亮
      mat.emissive = new THREE.Color(active ? 0xffaa44 : 0xff4400);
      mat.emissiveIntensity = active ? 2.4 : (mat.emissiveIntensity || 0.6);
      return;
    }
    if (active) {
      mat.emissive = new THREE.Color(0xff5324); // 白热橙红热源
      mat.emissiveIntensity = 1.7;
    } else {
      mat.emissive = new THREE.Color(0x8a1a0a); // 夜色暗红轮廓（不开镜难辨方向）
      mat.emissiveIntensity = 0.35;
    }
  }

  /** 切换红外热成像（main.js 随开镜状态调用） */
  setThermal(active) {
    if (this._thermal === active) return;
    this._thermal = active;
    if (this._matRefs) {
      this._matRefs.forEach(r => this._applyThermal(r.mat, r.isCore, r.isEye, active));
    }
  }

  _createHPBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 40; canvas.height = 5;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 40, 5);
    ctx.fillStyle = '#e05555'; ctx.fillRect(0, 0, 40, 5);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.y = 2.2;
    sprite.scale.set(0.6, 0.08, 1);
    sprite.userData.canvas = canvas;
    sprite.userData.ctx = ctx;
    return sprite;
  }

  updateHPBar() {
    const c = this.hpBar.userData.canvas;
    const ctx = this.hpBar.userData.ctx;
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.clearRect(0, 0, 40, 5);
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 40, 5);
    ctx.fillStyle = ratio > 0.3 ? '#3fae4a' : '#e05555';
    ctx.fillRect(0, 0, 40 * ratio, 5);
    this.hpBar.material.map.needsUpdate = true;
  }

  isVisible() { return this.alive && this.spawned && this.visible; }

  spawnUpdate(dt) {
    if (this.spawned) return;
    this.delay -= dt;
    if (this.delay <= 0) { this.spawned = true; this.mesh.visible = true; }
  }

  moveUpdate(dt, allyX) {
    if (!this.alive || !this.spawned) return;
    let moving = false;
    if (this.kind === 'patrol' && this.speed > 0) {
      this.x += this.dir * this.speed * dt;
      if (this.x >= this.maxX) { this.x = this.maxX; this.dir = -1; }
      if (this.x <= this.minX) { this.x = this.minX; this.dir = 1; }
      this.mesh.rotation.y = this.dir > 0 ? 0 : Math.PI;
      moving = true;
    } else if (this.kind === 'charger' && this.speed > 0) {
      const dx = allyX - this.x;
      const d = Math.sign(dx);
      if (Math.abs(dx) > 3) { this.x += d * this.speed * dt; moving = true; }
      this.mesh.rotation.y = d > 0 ? 0 : Math.PI;
    } else {
      this.mesh.rotation.y = allyX >= this.x ? 0 : Math.PI;
    }
    this.mesh.position.x = this.x;
    this._animateWalk(dt, moving);
  }

  /** 行走/待机动画：移动时四肢摆动，停止时复位（Boss 等非人形跳过） */
  _animateWalk(dt, moving) {
    const parts = this.mesh.userData.parts;
    if (!parts || !parts.lLeg) return;
    if (moving) {
      this.walkT += dt;
      const swing = Math.sin(this.walkT * 10) * 0.15;
      parts.lLeg.position.x = -0.15 + swing * 0.3;
      parts.rLeg.position.x = 0.15 - swing * 0.3;
      parts.lArm.position.x = -0.39 - swing * 0.15;
      parts.rArm.position.x = 0.39 + swing * 0.15;
    } else {
      parts.lLeg.position.x = -0.15;
      parts.rLeg.position.x = 0.15;
      parts.lArm.position.x = -0.39;
      parts.rArm.position.x = 0.39;
    }
  }

  fireUpdate(dt, allyAlive) {
    if (!this.alive || !this.spawned || !this.visible) return false;
    if (this.fireRate <= 0 || !allyAlive) return false;
    this.fireTimer -= dt;
    if (this.kind === 'sniper') {
      if (!this.aiming) { this.aiming = true; this.aimProgress = 0; }
      this.aimProgress += dt;
      if (this.aimProgress >= this.aimTime) {
        this.aiming = false;
        this.fireTimer = 1 / this.fireRate;
        return true;
      }
      return false;
    }
    if (this.fireTimer <= 0) {
      this.fireTimer = 1 / this.fireRate;
      return true;
    }
    return false;
  }

  peekUpdate(dt) {
    if (this.kind !== 'crouch') return;
    this.peekTimer -= dt;
    if (this.visible && this.peekTimer <= 0) {
      this.visible = false;
      this.peekTimer = this.peekInterval;
      this.mesh.visible = false;
    } else if (!this.visible && this.peekTimer <= 0) {
      this.visible = true;
      this.peekTimer = this.peekDur;
      this.mesh.visible = true;
    }
  }

  bossUpdate(dt) {
    if (this.kind !== 'boss') return null;
    this.coreTimer += dt;
    this.coreVulnerable = (this.coreTimer % 5) >= 3;

    // 核心发光效果
    const core = this.mesh.userData.parts?.core;
    if (core) {
      const intensity = this.coreVulnerable ? 1.0 : 0.3;
      core.material.emissiveIntensity = intensity;
      core.scale.setScalar(this.coreVulnerable ? 1.3 : 1.0);
    }

    if (this.bossPhase === 0 && this.phaseAt > 0 && this.hp <= this.phaseAt) {
      this.bossPhase = 1;
      this.fireRate *= 1.5;
      this.speed = 5;
      this.dir = -1;
      this.minX = -4; this.maxX = 4;
      this.barrageTimer = 4;
      return { phaseChange: true };
    }
    if (this.bossPhase >= 1) {
      if (this.speed > 0) {
        this.x += this.dir * this.speed * dt;
        if (this.x >= this.maxX) { this.x = this.maxX; this.dir = -1; }
        if (this.x <= this.minX) { this.x = this.minX; this.dir = 1; }
        this.mesh.position.x = this.x;
      }
      this.barrageTimer -= dt;
      if (this.barrageTimer <= 0) {
        this.barrageTimer = 4;
        return { barrage: true };
      }
    }
    return null;
  }

  takeDamage(dmg) {
    if (!this.isVisible()) return false;
    this.hp -= dmg;
    this.hurtFlash = 0.12;
    this.updateHPBar();
    // 闪烁效果
    this.mesh.traverse(child => {
      if (child.isMesh) child.material.emissive = new THREE.Color(0xffffff);
    });
    setTimeout(() => {
      if (this.alive) {
        // 恢复时回到当前红外热成像态，避免开镜下敌人"熄灭"
        this.setThermal(this._thermal || false);
      }
    }, 80);
    return true;
  }

  update(dt, allyX, allyAlive) {
    if (!this.alive) return null;
    this.spawnUpdate(dt);
    if (!this.spawned) return null;
    this.moveUpdate(dt, allyX);
    this.peekUpdate(dt);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    // 冲锋兵贴身自爆：对队友造成近战伤害，自身阵亡
    if (this.kind === 'charger' && allyAlive && Math.abs(allyX - this.x) <= 2.5) {
      this.hp = 0;
      this.alive = false;
      this.mesh.visible = false;
      return { killed: true, melee: true, kind: this.kind, x: this.x, z: this.z };
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return { killed: true, kind: this.kind, x: this.x, z: this.z };
    }

    const bossRes = this.bossUpdate(dt);
    const fired = this.fireUpdate(dt, allyAlive);
    if (fired) {
      return { fired: true, x: this.x, z: this.z, target: 'ally' };
    }
    if (bossRes) {
      if (bossRes.phaseChange) return { phaseChange: true };
      if (bossRes.barrage) return { barrage: true, x: this.x, z: this.z };
    }
    return null;
  }

  /** 清理场景中的 mesh */
  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
  }
}