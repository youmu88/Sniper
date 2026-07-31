/* ============================================================
 * allies.js — 队友：自动沿路径推进，受敌方火力伤害，携带HP
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  function Ally(cfg, spriteFactory) {
    this.x = cfg.x;
    this.baseY = 0;            // 会被 groundH 校准
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.speed = cfg.speed;
    this.alive = true;
    this.reached = false;
    this.walkT = 0;
    this.hurtFlash = 0;
    this.sprite = (spriteFactory || S.sprites.fighter || function(){ return null; })('ally');
    this.scale = 3.2;
  }

  Ally.prototype.update = function (dt, goalX) {
    if (!this.alive || this.reached) return;
    this.walkT += dt;
    if (this.x < goalX) {
      this.x += this.speed * dt;
    } else {
      this.reached = true;
    }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.hp <= 0) this.alive = false;
  };

  Ally.prototype.takeDamage = function (dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hurtFlash = 0.15;
  };

  Ally.prototype.draw = function (ctx, cam) {
    if (!this.alive) return;
    const sx = this.sprite.width * this.scale;
    const sy = this.sprite.height * this.scale;
    const x = cam.x(this.x) - sx / 2;
    const y = cam.y(this.baseY) - sy;
    if (this.hurtFlash > 0) ctx.filter = 'brightness(2)';
    ctx.drawImage(this.sprite, x, y, sx, sy);
    ctx.filter = 'none';
    const bw = 44, bh = 5;
    ctx.fillStyle = '#333';
    ctx.fillRect(cam.x(this.x) - bw / 2, y - 12, bw, bh);
    ctx.fillStyle = this.hpRatio() > 0.3 ? '#3fae4a' : '#e05555';
    ctx.fillRect(cam.x(this.x) - bw / 2, y - 12, bw * this.hpRatio(), bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('队友', cam.x(this.x), y - 16);
  };

  Ally.prototype.hpRatio = function () {
    return Math.max(0, this.hp / this.maxHp);
  };

  S.Ally = Ally;
})(typeof window !== 'undefined' ? window : this);
