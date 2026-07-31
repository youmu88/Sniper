/* ============================================================
 * enemies.js — 敌人 AI
 * 支持多兵种：静止兵、巡逻兵、冲锋兵、掩体探头兵、重甲兵、敌方狙击手、Boss
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  // 生成精灵（带缩放），kind 决定配色
  function spriteForKind(kind) {
    const sp = S.sprites && S.sprites.fighter;
    if (kind === 'heavy') return sp ? sp('heavy') : null;
    if (kind === 'boss')  return S.sprites && S.sprites.boss ? S.sprites.boss() : null;
    return sp ? sp('enemy') : null;
  }

  function Enemy(cfg, groundH) {
    this.kind = cfg.kind || 'stationary';
    this.x = cfg.x;
    this.baseY = groundH;   // 地面高度
    this.y = groundH;       // 逻辑 y（底部地面）
    this.minX = cfg.xMin != null ? cfg.xMin : this.x - (cfg.range || 0);
    this.maxX = cfg.xMax != null ? cfg.xMax : this.x + (cfg.range || 0);
    this.dir = 1;
    this.hp = cfg.hp != null ? cfg.hp : 1;
    this.maxHp = this.hp;
    this.fireRate = cfg.fireRate || 0;   // 每秒射击次数，0 = 不射击
    this.speed = cfg.speed || 0;
    this.alive = true;

    // 掩体探头兵参数
    this.peekInterval = cfg.peekInterval || 0;
    this.peekDur = cfg.peekDur || 0;
    this.peekTimer = Math.random() * this.peekInterval;
    this.visible = true;    // 探头可见

    // 敌方狙击手：瞄准时间后发射一发高伤子弹，且需玩家对其开火才击杀
    this.aimTime = cfg.aimTime || 0;
    this.aimProgress = 0;
    this.aiming = false;

    // 冲锋兵/巡逻计时
    this.fireTimer = Math.random() * (1 / (this.fireRate || 1));

    // 出场延迟
    this.delay = cfg.delay || 0;
    this.spawned = this.delay <= 0;

    // Boss 附加
    this.bossPhase = 0;
    this.phaseAt = cfg.phaseAt || 0;
    this.coreVulnerable = cfg.coreVulnerable || false;
    this.boss = cfg.kind === 'boss';

    this.sprite = spriteForKind(this.kind);
    this.scale = this.boss ? 4 : 3.2;
    this.hurtFlash = 0;
    this.floatY = 0;

    // 面向队友（默认朝左=朝队友推进方向）
    this.facing = -1;
  }

  // 敌人是否在当前时刻可被击杀/可见
  Enemy.prototype.isVisible = function () {
    return this.alive && this.spawned && this.visible;
  };

  Enemy.prototype.spawnUpdate = function (dt) {
    if (this.spawned) return;
    this.delay -= dt;
    if (this.delay <= 0) this.spawned = true;
  };

  // 移动（巡逻/冲锋）
  Enemy.prototype.moveUpdate = function (dt, allyX) {
    if (this.kind === 'patrol' && this.speed > 0) {
      this.x += this.dir * this.speed * dt;
      if (this.x >= this.maxX) { this.x = this.maxX; this.dir = -1; }
      if (this.x <= this.minX) { this.x = this.minX; this.dir = 1; }
    } else if (this.kind === 'charger' && this.speed > 0) {
      // 朝队友逼近，但保持最小距离（挤压队友阵型但不过度贴脸）
      const dx = allyX - this.x;
      const d = Math.sign(dx);
      if (Math.abs(dx) > 56) this.x += d * this.speed * dt;
      this.facing = dx >= 0 ? 1 : -1;
    } else if (this.kind === 'stationary' || this.kind === 'crouch' || this.kind === 'heavy' || this.kind === 'sniper' || this.boss) {
      // 保持静止，面向队友
      this.facing = allyX >= this.x ? 1 : -1;
    }
  };

  // 射击冲动返回是否在本帧开火，以及是否发射子弹
  Enemy.prototype.fireUpdate = function (dt, allyAlive) {
    this.fireTimer -= dt;
    let fired = false;
    // 冲锋兵与静止靶不射击的无所谓
    if (this.fireRate > 0 && allyAlive && this.spawned && this.visible) {
      if (this.kind === 'sniper') {
        // 敌方狙击手：需要瞄准时间
        if (!this.aiming) { this.aiming = true; this.aimProgress = 0; }
        this.aimProgress += dt;
        // 瞄准完成前 80% 时玩家仍可击杀；完成即发射
        if (this.aimProgress >= this.aimTime) { this.aiming = false; fired = true; this.fireTimer = 1 / this.fireRate; }
      } else {
        if (this.fireTimer <= 0) { fired = true; this.fireTimer = 1 / this.fireRate; }
      }
    }
    return fired;
  };

  // 掩体兵探头逻辑
  Enemy.prototype.peekUpdate = function (dt) {
    if (this.kind !== 'crouch') return;
    if (this.visible) {
      // 探头期间倒计时后缩回
      this.peekTimer -= dt;
      if (this.peekTimer <= 0) {
        this.visible = false;
        this.peekTimer = this.peekInterval;
      }
    } else {
      // 隐匿期间计时后探头
      this.peekTimer -= dt;
      if (this.peekTimer <= 0) {
        this.visible = true;
        this.peekTimer = this.peekDur;
      }
    }
  };

  Enemy.prototype.takeDamage = function (dmg) {
    if (!this.isVisible()) return false;   // 看不见打不着（隐匿时免疫）
    this.hp -= dmg;
    this.hurtFlash = 0.12;
    return true;
  };

  Enemy.prototype.update = function (dt, allyX, allyAlive) {
    if (!this.alive) return null;
    this.spawnUpdate(dt);
    if (!this.spawned) return null;
    this.moveUpdate(dt, allyX);
    this.peekUpdate(dt);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    // 死亡判定
    if (this.hp <= 0) { this.alive = false; return { killed: true, kind: this.kind }; }
    const fired = this.fireUpdate(dt, allyAlive);
    if (fired) return { shot: true };
    return null;
  };

  Enemy.prototype.draw = function (ctx, cam) {
    if (!this.alive || !this.spawned) return;
    // 隐匿的掩体兵不画
    if (this.kind === 'crouch' && !this.visible) {
      // 画一个"!"提示
      ctx.fillStyle = 'rgba(255,235,59,0.8)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', cam.x(this.x), cam.y(this.baseY) - 46);
      return;
    }
    const sp = this.sprite;
    const sx = (sp ? sp.width : 10) * this.scale;
    const sy = (sp ? sp.height : 14) * this.scale;
    const drawY = cam.y(this.baseY) - sy + (this.kind === 'crouch' ? sy * 0.3 : 0);
    const alpha = this.kind === 'sniper' && this.aiming ? 0.55 + 0.45 * Math.abs(Math.sin(this.aimProgress * 12)) : 1;
    ctx.globalAlpha = alpha;
    if (this.hurtFlash > 0) ctx.filter = 'brightness(2.4)';
    if (sp) ctx.drawImage(sp, cam.x(this.x) - sx / 2, drawY, sx, sy);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    // 敌方狙击手瞄准线提示
    if (this.kind === 'sniper' && this.aiming) {
      ctx.strokeStyle = 'rgba(255,80,80,0.5)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(cam.x(this.x), drawY + sy / 2);
      const ally = this._aimTarget;
      if (ally) ctx.lineTo(cam.x(ally.x), cam.y(ally.baseY) - 30);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 血条（多血量时显示）
    if (this.maxHp > 1) {
      const bw = 30, bh = 4;
      ctx.fillStyle = '#222';
      ctx.fillRect(cam.x(this.x) - bw / 2, drawY - 8, bw, bh);
      ctx.fillStyle = this.boss ? '#a03' : '#e74c3c';
      ctx.fillRect(cam.x(this.x) - bw / 2, drawY - 8, bw * (this.hp / this.maxHp), bh);
    }

    // Boss 血条（顶部单独画）
    if (this.boss) this._drawBossBar(ctx, cam);
  };

  Enemy.prototype._drawBossBar = function (ctx, cam) {
    const w = 320;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cam.x(this.x) - w / 2, 20, w, 16);
    ctx.fillStyle = '#c026d3';
    ctx.fillRect(cam.x(this.x) - w / 2 + 2, 22, (w - 4) * (this.hp / this.maxHp), 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS 机甲', cam.x(this.x), 13);
  };

  S.Enemy = Enemy;
})(typeof window !== 'undefined' ? window : this);
