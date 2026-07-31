/* ============================================================
 * game.js — 核心游戏引擎
 * 状态管理：加载关卡、更新敌方/队友/子弹、相机、碰撞判定、目标完成判定
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  const VIEW_W = 1000, VIEW_H = 600;   // 视图逻辑分辨率
  const GROUND_H = 40;

  function Game(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks || {};   // onShoot? onLevelComplete? onLose? 由 main 挂载
    this.camera = { zoom: 1 };
    this.state = 'running';      // running | dead(战败) | win(通关)
    this.level = null;
    this.time = 0;
    this.ally = null;
    this.enemies = [];
    this.bullets = [];           // 玩家子弹
    this.fx = [];                // 特效（命中火花、弹壳）
    this.muzzleFlash = 0;
    this.recoil = 0;             // 开火后坐力（0..1，恢复）
    this.ammo = 0;
    this.maxAmmo = 0;
    this.shots = {};             // 敌方弹道缓存
    this.speed = 1;              // 时间倍率
    this.deadTimer = 0;
    this.winTimer = 0;

    // Boss 引用
    this.boss = null;

    // 相机初始：聚焦区域
    this.camOX = 0;  // 世界滚动偏移（逻辑像素）
  }

  // ---------- 初始化关卡 ----------
  Game.prototype.loadLevel = function (levelDef) {
    this.level = levelDef;
    this.time = 0;
    this.camOX = 0;
    this.enemies = [];
    this.bullets = [];
    this.fx = [];
    this.state = 'running';
    this.ammo = 12;
    this.maxAmmo = 12;
    this.boss = null;
    this.bossDefeated = false;
    this.bossAliveInLevel = false;
    this._zoom = false;

    // 队友
    this.ally = new S.Ally(levelDef.allies[0], S.sprites && S.sprites.fighter);
    this.ally.baseY = GROUND_H;

    // 敌人（初始 + 波次压平到 initially）
    const defs = [...(levelDef.initially || []), ...this._flattenWaves(levelDef.waves)];
    let hasBoss = false;
    defs.forEach(cfg => {
      const e = new S.Enemy(cfg, GROUND_H);
      if (e.kind === 'boss') {
        hasBoss = true;
        this._initBoss(e, levelDef);
      }
      this.enemies.push(e);
    });
    // 若关卡只通过 levelDef.boss 声明 Boss（未在敌列表），则补建
    if (levelDef.boss && !hasBoss) {
      const e = new S.Enemy({ kind: 'boss', x: levelDef.boss.x || 760, hp: levelDef.boss.hp || 40, fireRate: levelDef.boss.fireRate || 1.2 }, GROUND_H);
      this._initBoss(e, levelDef);
      this.enemies.push(e);
    }
  };

  Game.prototype._initBoss = function (e, levelDef) {
    this.boss = e;
    this.bossAliveInLevel = true;
    e.x = (levelDef.boss && levelDef.boss.x) || 760;
    e.hp = (levelDef.boss && levelDef.boss.hp) || 40;
    e.maxHp = e.hp;
    e.fireRate = (levelDef.boss && levelDef.boss.fireRate) || 1.2;
  };

  // 波次数据变平：若关卡定义了 waves 且没有 initially，则直接作为初始敌人
  Game.prototype._flattenWaves = function (waves) {
    if (!waves) return [];
    // 存在 delay>0 的需要延迟出场；simple 实现：都先加入，Enemy 内有 spawnUpdate 处理 delay
    return waves.slice();
  };

  // ---------- 相机 ----------
  // 逻辑坐标 -> 屏幕坐标（带滚动偏移）
  Game.prototype.screenX = function (wx) {
    return wx - this.camOX;
  };

  // 屏幕坐标 -> 逻辑坐标（用于射击命中换算）
  Game.prototype.worldX = function (sx) {
    return sx + this.camOX;
  };

  // 相机接口：逻辑x -> 屏幕x（水平滚动）。供绘制函数统一调用
  Game.prototype.camX = function (wx) {
    return wx - this.camOX;
  };
  // 相机接口：逻辑y -> 屏幕y（当前无垂直滚动）
  Game.prototype.camY = function (wy) {
    return wy;
  };
  // 供 enemies.allies 中以 cam.x()/cam.y() 形式调用（保持接口形态一致）
  Object.defineProperty(Game.prototype, 'cam', {
    get() {
      return { x: this.camX.bind(this), y: this.camY.bind(this) };
    },
  });

  Game.prototype.drawGround = function (ctx) {
    // 地面
    ctx.fillStyle = this.level.terrain === '雪原' ? '#d9e9f2' : this.level.terrain === '沙漠' ? '#ecd9a8' : this.level.terrain === '机甲基地' ? '#3a3f4a' : this.level.terrain === '废墟' ? '#b08968' : '#9cb873';
    ctx.fillRect(0, VIEW_H - GROUND_H, VIEW_W, GROUND_H);
    // 地面顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, VIEW_H - GROUND_H, VIEW_W, 4);
    // 地面草末纹理
    const tile = S.sprites.ground();
    ctx.imageSmoothingEnabled = false;
    const gw = 24, gh = 6;
    for (let gx = -((this.camOX % (gw * 4)) / 4); gx < VIEW_W; gx += gw) {
      ctx.drawImage(tile, gx, VIEW_H - GROUND_H, gw, gh);
    }
    // 预绘装饰：树干/建筑剪影（极简化）
    this._drawBackdrop(ctx);
  };

  Game.prototype._drawBackdrop = function (ctx) {
    const xs = [150, 400, 650, 900];
    if (this.level.id === 8) {
      // 基地
      ctx.fillStyle = '#2c303b';
      for (let i = 0; i < xs.length; i++) {
        ctx.fillRect(xs[i] - 30, 180, 60, 380);
        ctx.fillRect(xs[i] - 60, 280, 30, 280);
      }
    } else if (this.level.terrain === '城镇夜') {
      ctx.fillStyle = '#1f2430';
      xs.forEach(x => { ctx.fillRect(x - 24, 240, 48, 320); });
      ctx.fillStyle = '#f7dc6f';
      xs.forEach(x => { ctx.fillRect(x - 10, 260, 4, 4); ctx.fillRect(x + 6, 286, 4, 4); });
    } else if (this.level.terrain === '雪原') {
      ctx.fillStyle = '#e8f0f7';
      xs.forEach(x => { ctx.beginPath(); ctx.moveTo(x - 30, 400); ctx.lineTo(x, 250); ctx.lineTo(x + 30, 400); ctx.closePath(); ctx.fill(); });
    } else {
      // 山丘/草丛
      ctx.fillStyle = 'rgba(120,150,90,0.5)';
      xs.forEach(x => { ctx.beginPath(); ctx.arc(x, VIEW_H - GROUND_H - 10, 46, Math.PI, 0); ctx.fill(); });
    }
  };

  // 掩体绘制
  Game.prototype.drawBarriers = function (ctx) {
    if (!this.level.barriers) return;
    const tile = S.sprites.barrier('sandbag');
    ctx.imageSmoothingEnabled = false;
    const bw = 54, bh = 18;
    this.level.barriers.forEach(b => {
      const sx = this.screenX(b.x);
      if (sx < -60 || sx > VIEW_W + 60) return;
      ctx.drawImage(tile, sx - bw / 2, VIEW_H - GROUND_H - bh + (b.lift || 0), bw, bh);
    });
  };

  // ---------- 更新 ----------
  Game.prototype.update = function (dt) {
    dt = dt * this.speed;
    this.time += dt;

    // 玩家后坐力/特效恢复
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 2);
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;

    // 弹药缓慢回填（每 1.2s 补 1 发，上限 maxAmmo）
    this.reloadTimer = (this.reloadTimer || 0) - dt;
    if (this.reloadTimer <= 0 && this.ammo < this.maxAmmo) {
      this.ammo++;
      this.reloadTimer = 1.2;
    }

    // 相机跟随队友并向前平滑滚动（不过度）
    const target = Math.max(0, this.ally.x - VIEW_W * 0.4);
    this.camOX += (target - this.camOX) * Math.min(1, dt * 3);

    // 更新队友（Boss 关也按 goalX 推进，Boss 战胜利仍需队友抵达）
    this.ally.update(dt, this.level.goalX);

    // 更新敌人
    const allyAlive = this.ally.alive;
    for (const e of this.enemies) {
      const res = e.update(dt, this.ally.x, allyAlive);
      if (res && res.shot) this.enemyFire(e);
      if (res && res.killed && e.boss) this._onBossDefeated(e);
    }

    // 清理死亡敌人
    this.enemies = this.enemies.filter(e => e.alive);

    // 玩家子弹推进
    this.updateBullets(dt);

    // 特效老化 + 敌方子弹命中结算
    this.fx = this.fx.filter(f => (f.t += dt) < f.life);
    this.tickEnemyShots(dt);

    // ---------- 胜负判定 ----------
    // 失败：队友团灭
    if ((!this.ally.alive || this.ally.hp <= 0) && this.state === 'running') {
      this.state = 'dead';
      this.deadTimer = 0;
    }
    // 胜利：非 Boss 关队友到达终点；Boss 关需 Boss 已击败 且 队友到达终点
    if (this.state === 'running' && this.ally.reached) {
      if (this.bossDefeated || !this.bossAliveInLevel) {
        this.state = 'win';
      }
    }
  };

  Game.prototype._onBossDefeated = function (e) {
    // Boss 死亡：标记已击败，Boss 不再是活敌（其余守卫可继续清）
    this.bossDefeated = true;
    this.boss = null;
  };

  // 敌方射击
  Game.prototype.enemyFire = function (e) {
    // 向队友方向发射一发敌方子弹（简化：直接快进伤害判定，带红色线条与迟滞）
    if (!this.ally.alive) return;
    // 敌方子弹：命中前有飞行时间，距离越远命中越慢（给玩家反应时间）
    const dist = Math.abs(e.x - this.ally.x);
    const speed = 260; // px/s
    const travel = dist / speed;
    this.fx.push({ type: 'enemyShot', t: 0, life: travel, from: e.x, to: this.ally.x, toY: this.ally.baseY, fromY: e.baseY, dmg: this._enemyDmg(e), travel });
  };

  Game.prototype._enemyDmg = function (e) {
    // 不同兵种伤害
    if (e.kind === 'heavy') return 18;
    if (e.kind === 'boss') return 14;
    if (e.kind === 'sniper') return 40;   // 高伤
    return 10;
  };

  // 处理敌方子弹命中（travel 到期时）
  Game.prototype.tickEnemyShots = function (dt, realDt) {
    // 在 update 尾部、基于真实 dt 推进特效寿命，命中时对队友扣血
    dt = dt * this.speed;
    for (const f of this.fx) {
      if (f.type === 'enemyShot' && !f.hitApplied && f.t >= f.life) {
        f.hitApplied = true;
        if (this.ally.alive) this.ally.takeDamage(f.dmg);
      }
    }
  };

  // 玩家子弹更新（直线前进，命中判定在 main 中）
  Game.prototype.updateBullets = function (dt) {
    for (const b of this.bullets) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.t = (b.t || 0) + dt;
    }
    // 出界清理
    this.bullets = this.bullets.filter(b => b.t < b.life);
  };

  // ---------- 玩家射击 ----------
  Game.prototype.shoot = function (aimScreen, scopeRatio) {
    if (this.ammo <= 0 || this.state !== 'running') return;
    this.ammo--;
    const scopeZoom = this.zoom ? 2.2 : 1;
    // 屏幕上瞄准点 -> 世界 x
    const wx = this.worldX(aimScreen.x);
    // 发射：计算弹道 Y 随距离衰减（重力的简单模拟：直接用水平线，命中判定用 X）
    const bullet = {
      x: aimScreen.x, y: aimScreen.y,   // 屏幕起点（枪口）近似瞄准点
      angle: 0,
      speed: 0,
      t: 0,
      life: 0.06,
      targetWX: wx,   // 目标世界坐标 X（命中判定用）
    };
    this.bullets.push(bullet);
    this.muzzleFlash = 0.05;
    this.recoil = 1;
    // 命中判定：横向扫描子弹 t 时刻所在屏幕 x 直接按瞬时命中处理（狙击枪瞬时判定）
    // 简化为立即查询
    this._resolveShot(wx, scopeZoom, aimScreen.y);
    if (this.cb.onShoot) this.cb.onShoot(wx);
  };

  // 瞬时命中：
  Game.prototype._resolveShot = function (wx, scopeZoom, aimY) {
    // aimY：瞄准点的屏幕 y（用于判断命中身体部位）
    let hit = null, best = 1e9;
    for (const e of this.enemies) {
      if (!e.isVisible()) continue;
      if (Math.abs(e.x - wx) <= 20) {
        const d = Math.abs(e.x - wx);
        if (d < best) { best = d; hit = e; }
      }
    }
    if (hit) {
      // 弱点判定：瞄准点落在敌人躯干中上部 -> 弱点翻倍伤害
      const bodyTop = VIEW_H - GROUND_H - (hit.boss ? 100 : 44);
      const bodyBot = VIEW_H - GROUND_H - 10;
      const isWeak = aimY !== undefined && aimY >= bodyTop && aimY <= (bodyTop + bodyBot) / 2 + 6;
      const ok = hit.takeDamage(this._shotDmg(hit, isWeak));
      this._spawnHitFx(wx, isWeak);
      if (ok && this.cb.onKill) this.cb.onKill(hit.kind);
    } else {
      this._spawnMissFx(wx);
    }
  };

  Game.prototype._shotDmg = function (e, isWeak) {
    // 狙击枪：普通兵 1 枪；重甲/Boss/狙击手需要多枪（基础 3）
    let base;
    if (e.boss) base = 3;
    else if (e.kind === 'heavy' || e.kind === 'sniper' || e.maxHp > 1) base = 3;
    else base = 1;
    // 开镜 = 精确瞄准，任何命中的弱点进一步翻倍
    if (this._zoom) base = base * 2;
    if (isWeak) base = base * 2;
    return base;
  };

  Game.prototype._spawnHitFx = function (wx) {
    this.fx.push({ type: 'hit', t: 0, life: 0.25, x: this.screenX(wx), y: VIEW_H - GROUND_H - 40 });
  };
  Game.prototype._spawnMissFx = function (wx) {
    this.fx.push({ type: 'miss', t: 0, life: 0.3, x: this.screenX(wx), y: VIEW_H - GROUND_H });
  };

  // 画子弹/特效
  Game.prototype.drawBullets = function (ctx) {
    // 玩家弹道（狙击：画出膛瞬间的一道线）
    for (const b of this.bullets) {
      ctx.strokeStyle = 'rgba(255,255,200,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.muzzleFlash > 0 ? this.canvas.width / 2 : b.x, VIEW_H - GROUND_H - 30);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  };

  Game.prototype.drawFx = function (ctx) {
    for (const f of this.fx) {
      if (f.type === 'hit') {
        const a = 1 - f.t / f.life;
        ctx.fillStyle = `rgba(255,180,40,${a})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 6 * a + 2, 0, Math.PI * 2); ctx.fill();
      } else if (f.type === 'miss') {
        const a = 1 - f.t / f.life;
        ctx.fillStyle = `rgba(200,200,180,${a})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 4 * a + 1, 0, Math.PI * 2); ctx.fill();
      } else if (f.type === 'enemyShot') {
        // 敌方子弹飞行线
        const p = Math.min(1, f.t / f.life);
        const x0 = this.screenX(f.from), x1 = this.screenX(f.to);
        const sx = x0 + (x1 - x0) * p;
        const sy = VIEW_H - GROUND_H - 20;
        ctx.strokeStyle = 'rgba(255,60,60,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, sy + 10);
        ctx.lineTo(sx, sy - 2);
        ctx.stroke();
      }
    }
  };

  // 顶部警示（狙击手瞄准时）
  Game.prototype.drawSniperWarn = function (ctx) {
    for (const e of this.enemies) {
      if (e.kind === 'sniper' && e.aiming) {
        ctx.fillStyle = 'rgba(255,0,0,0.85)';
        ctx.font = 'bold 15px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ 敌方狙击手!', this.screenX(e.x), 60);
      }
    }
  };

  // ---------- 完整渲染 ----------
  Game.prototype.render = function (ctx) {
    const c = this.ctx;
    c.imageSmoothingEnabled = false;

    // 相机对象：明确的 {x,y} 函数（供 enemies/allies 绘制调用，避免 getter 间接问题）
    const cam = {
      x: (wx) => wx - this.camOX,
      y: (wy) => wy,
    };
    // 供 Game 自身绘制复用
    this._camObj = cam;

    // 背景
    if (this.level.terrain === '城镇夜') c.fillStyle = '#12151f';
    else if (this.level.terrain === '雪原') c.fillStyle = '#bcd4e6';
    else if (this.level.terrain === '机甲基地') c.fillStyle = '#22242e';
    else if (this.level.terrain === '沙漠') c.fillStyle = '#e8d3a9';
    else c.fillStyle = '#bcd1e0';
    c.fillRect(0, 0, VIEW_W, VIEW_H - GROUND_H);

    this.drawGround(c);
    this.drawBackdrop2(c);
    this.drawBarriers(c);

    // 敌人
    this.enemies.forEach(e => e.draw(c, cam));

    // 队友
    this.ally.draw(c, cam);

    // 特效/弹道
    this.drawBullets(c);
    this.drawFx(c);
    this.drawSniperWarn(c);
  };

  Game.prototype.drawBackdrop2 = function (ctx) {
    // 复用 _drawBackdrop 画剪影（画在地面之上、单位之后）
    this._drawBackdrop(ctx);
  };

  // 存取 zoom 状态（由 main 控制，这里是读取）
  Object.defineProperty(Game.prototype, 'zoom', { get() { return this._zoom || false; }, set(v) { this._zoom = v; } });

  S.Game = Game;
  S.VIEW_W = VIEW_W;
  S.VIEW_H = VIEW_H;
  S.GROUND_H = GROUND_H;
})(typeof window !== 'undefined' ? window : this);
