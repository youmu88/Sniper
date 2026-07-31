/* ============================================================
 * particles.js — 轻量粒子系统
 * 爆炸碎块 / 血雾 / 尘土 / 枪口烟 / 爆炸冲击波 / 漂浮文字
 * 独立于游戏对象，由 Game 持有并每帧 update/draw
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  // 单个粒子
  function P(o) {
    this.x = o.x || 0; this.y = o.y || 0;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.g = o.g || 0;                 // 重力
    this.drag = o.drag != null ? o.drag : 1; // 空气阻力系数
    this.t = 0; this.life = o.life || 0.5;
    this.size = o.size || 2;
    this.color = o.color || '#fff';
    this.shape = o.shape || 'rect';    // rect|circle|spark|ring|smoke|text
    this.alpha0 = o.alpha != null ? o.alpha : 1;
    this.rot = o.rot || 0; this.vrot = o.vrot || 0;
    this.text = o.text || '';
    this.grow = o.grow || 0;           // 尺寸随时间放大(烟/波)
    this.flicker = o.flicker || false;
  }
  P.prototype.update = function (dt) {
    this.t += dt;
    this.vy += this.g * dt;
    const dr = Math.pow(this.drag, dt * 60);
    this.vx *= dr; this.vy *= dr;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.vrot * dt;
    if (this.grow) this.size += this.grow * dt;
  };
  P.prototype.alive = function () { return this.t < this.life; };
  P.prototype.alpha = function () {
    const k = 1 - this.t / this.life;
    return Math.max(0, this.alpha0 * (this.flicker ? k * (0.5 + 0.5 * Math.random()) : k));
  };

  function Particles() { this.list = []; }
  Particles.prototype.add = function (o) { const p = new P(o); this.list.push(p); return p; };
  Particles.prototype.update = function (dt) {
    for (const p of this.list) p.update(dt);
    this.list = this.list.filter(p => p.alive());
  };
  Particles.prototype.count = function () { return this.list.length; };

  // ---------- 常用发射器 ----------

  // 击杀爆碎块（像素块四散）
  Particles.prototype.burstDebris = function (x, y, palette, n) {
    n = n || 10;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        g: 520, life: 0.4 + Math.random() * 0.4, size: 2 + Math.random() * 3,
        color: palette[(Math.random() * palette.length) | 0],
        shape: 'rect', vrot: (Math.random() - 0.5) * 12,
      });
    }
  };

  // 命中火花（金色散射）
  Particles.prototype.spark = function (x, y, n) {
    n = n || 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 200;
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: 200, life: 0.18 + Math.random() * 0.2, size: 1 + Math.random() * 2,
        color: ['#ffd76b', '#ffb02e', '#fff2b0'][(Math.random() * 3) | 0],
        shape: 'spark', flicker: true,
      });
    }
  };

  // 血雾（红雾团）
  Particles.prototype.bloodMist = function (x, y) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 40;
      this.add({
        x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
        g: 30, drag: 0.94, life: 0.4 + Math.random() * 0.3,
        size: 3 + Math.random() * 4, grow: 6,
        color: 'rgba(190,40,40,0.8)', shape: 'smoke', alpha: 0.7,
      });
    }
  };

  // 枪口烟（向上飘的灰烟）
  Particles.prototype.muzzleSmoke = function (x, y) {
    for (let i = 0; i < 5; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 6, y,
        vx: (Math.random() - 0.5) * 16, vy: -18 - Math.random() * 22,
        g: -8, drag: 0.95, life: 0.5 + Math.random() * 0.4,
        size: 3 + Math.random() * 4, grow: 10,
        color: 'rgba(200,200,205,0.5)', shape: 'smoke', alpha: 0.5,
      });
    }
  };

  // 爆炸（火球+冲击波环+碎块+烟）
  Particles.prototype.explosion = function (x, y, scale) {
    scale = scale || 1;
    // 火球
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = (30 + Math.random() * 140) * scale;
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        g: 260, life: 0.3 + Math.random() * 0.3, size: (2 + Math.random() * 4) * scale,
        color: ['#ffdd55', '#ff9933', '#ff5522', '#ffffff'][(Math.random() * 4) | 0],
        shape: 'rect', flicker: true,
      });
    }
    // 冲击波环
    this.add({ x, y, vx: 0, vy: 0, life: 0.4, size: 6 * scale, grow: 220 * scale, color: 'rgba(255,200,120,0.7)', shape: 'ring', alpha: 0.8 });
    // 烟
    for (let i = 0; i < 8; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 20 * scale, y: y - Math.random() * 10,
        vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 40,
        g: -10, drag: 0.94, life: 0.7 + Math.random() * 0.6,
        size: 5 * scale, grow: 14, color: 'rgba(90,90,95,0.55)', shape: 'smoke', alpha: 0.55,
      });
    }
  };

  // 尘土（落脚/移动扬尘）
  Particles.prototype.dust = function (x, y, n) {
    n = n || 4;
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 10, y,
        vx: (Math.random() - 0.5) * 24, vy: -8 - Math.random() * 12,
        g: 20, drag: 0.92, life: 0.35 + Math.random() * 0.3,
        size: 2 + Math.random() * 3, grow: 5,
        color: 'rgba(170,150,120,0.4)', shape: 'smoke', alpha: 0.4,
      });
    }
  };

  // 漂浮文字（连击/爆头/补给提示）
  Particles.prototype.floatText = function (x, y, text, color, size) {
    this.add({
      x, y, vx: 0, vy: -34, g: 0, drag: 1,
      life: 0.9, size: size || 13, color: color || '#ffe27a',
      shape: 'text', text, alpha: 1,
    });
  };

  // 抛壳（黄铜弹壳向右上方抛出，旋转落地）
  Particles.prototype.shellEject = function (x, y) {
    this.add({
      x, y, vx: 40 + Math.random() * 50, vy: -60 - Math.random() * 40,
      g: 420, drag: 0.995, life: 0.9 + Math.random() * 0.3,
      size: 3, color: '#e6c25a', shape: 'rect',
      rot: Math.random() * Math.PI, vrot: 10 + Math.random() * 14,
    });
  };

  // ---------- 绘制 ----------
  Particles.prototype.draw = function (ctx, cam) {
    for (const p of this.list) {
      const a = p.alpha();
      if (a <= 0) continue;
      const sx = cam ? cam.x(p.x) : p.x;
      const sy = cam ? cam.y(p.y) : p.y;
      ctx.globalAlpha = Math.min(1, a);
      if (p.shape === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
      } else if (p.shape === 'spark') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - p.size, sy); ctx.lineTo(sx + p.size, sy);
        ctx.moveTo(sx, sy - p.size); ctx.lineTo(sx, sy + p.size);
        ctx.stroke();
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.stroke();
      } else if (p.shape === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, sx, sy);
      }
      ctx.globalAlpha = 1;
    }
  };

  S.Particles = Particles;
})(typeof window !== 'undefined' ? window : this);
