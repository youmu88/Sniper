/* ============================================================
 * allies.js — 3D 队友推进逻辑
 * ============================================================ */
import * as THREE from 'three';
import { createCharacter } from './characters.js';

const GROUND_Y = 0;

export class Ally3D {
  constructor(cfg) {
    this.x = cfg.x || -18;
    this.z = cfg.z || -12;
    this.speed = cfg.speed || 28;
    this.hp = cfg.hp || 100;
    this.maxHp = this.hp;
    this.alive = true;
    this.reached = false;

    // 3D 模型
    this.mesh = createCharacter('ally', 0.9);
    this.mesh.position.set(this.x, GROUND_Y, this.z);

    // 血条
    this.hpBar = this._createHPBar();
    this.mesh.add(this.hpBar);

    // 标签
    this.label = this._createLabel();
    this.mesh.add(this.label);

    this.hurtFlash = 0;
    this.walkT = 0;
  }

  _createHPBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 44; canvas.height = 5;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 44, 5);
    ctx.fillStyle = '#3fae4a'; ctx.fillRect(0, 0, 44, 5);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.y = 2.4;
    sprite.scale.set(0.7, 0.08, 1);
    sprite.userData.canvas = canvas;
    sprite.userData.ctx = ctx;
    return sprite;
  }

  _createLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 20;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🤝 队友', 32, 16);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.y = 2.8;
    sprite.scale.set(0.8, 0.25, 1);
    return sprite;
  }

  updateHPBar() {
    const c = this.hpBar.userData.canvas;
    const ctx = this.hpBar.userData.ctx;
    const ratio = Math.max(0, this.hp / this.maxHp);
    ctx.clearRect(0, 0, 44, 5);
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 44, 5);
    ctx.fillStyle = ratio > 0.3 ? '#3fae4a' : '#e05555';
    ctx.fillRect(0, 0, 44 * ratio, 5);
    this.hpBar.material.map.needsUpdate = true;
  }

  hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  /**
   * @param {number} dt
   * @param {number} targetX 本帧推进目标（由 main.js 根据前方威胁计算）
   * @param {boolean} waiting 是否已停在保持线等待掩护
   */
  update(dt, targetX, waiting) {
    if (!this.alive || this.reached) return;
    this.walkT += dt;
    this.waiting = !!waiting;

    const parts = this.mesh.userData.parts;
    if (this.x < targetX) {
      this.x += this.speed * dt;
      if (this.x > targetX) this.x = targetX;
      this.mesh.position.x = this.x;
      // 行走动画（四肢摆动）
      const swing = Math.sin(this.walkT * 12) * 0.15;
      if (parts) {
        parts.lLeg.position.x = -0.15 + swing * 0.3;
        parts.rLeg.position.x = 0.15 - swing * 0.3;
        parts.lArm.position.x = -0.39 - swing * 0.15;
        parts.rArm.position.x = 0.39 + swing * 0.15;
        parts.body.position.y = 1.0;
      }
    } else {
      // 停等/待机：四肢复位 + 呼吸浮动
      if (parts) {
        parts.lLeg.position.x = -0.15;
        parts.rLeg.position.x = 0.15;
        parts.lArm.position.x = -0.39;
        parts.rArm.position.x = 0.39;
        parts.body.position.y = 1.0 + Math.sin(this.walkT * 2.2) * 0.02;
      }
      if (this.x >= (this.goalX ?? targetX)) this.reached = true;
    }

    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
    }
    this.updateHPBar();
  }

  takeDamage(dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hurtFlash = 0.15;
    // 闪烁
    this.mesh.traverse(child => {
      if (child.isMesh) child.material.emissive = new THREE.Color(0xff4444);
    });
    setTimeout(() => {
      if (this.alive) {
        this.mesh.traverse(child => {
          if (child.isMesh) child.material.emissive = new THREE.Color(0x000000);
        });
      }
    }, 100);
  }

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