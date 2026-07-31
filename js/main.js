/* ============================================================
 * main.js — 游戏主入口 / 控制器
 * 菜单、选关、HUD、主循环、射击交互、胜负结算
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  const VIEW_W = S.VIEW_W, VIEW_H = S.VIEW_H, GROUND_H = S.GROUND_H;

  let canvas, ctx, input, game, gameCtx;
  let screen = 'menu';        // menu | select | playing | dead | win
  let currentLevelId = 1;
  let lastTime = 0;
  let unlocked = 1;           // 已解锁的最大关卡（存 localStorage）
  let stars = {};             // 关卡星级

  // 依赖检查
  function need() {
    if (!S.Game || !S.Input || !S.Ally || !S.Enemy || !S.levels) {
      throw new Error('JS 模块加载不完整');
    }
  }

  // ---------- 初始化 ----------
  function init() {
    canvas = document.getElementById('gameCanvas');
    gameCtx = canvas.getContext('2d');
    need();
    input = new S.Input(canvas);
    input.attach();
    loadProgress();
    game = new S.Game(canvas);
    game.cb.onKill = handleKill;
    game.cb.shoot = function(){};
    bindUI();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem('sniper_unlocked');
      unlocked = raw ? parseInt(raw, 10) || 1 : 1;
      const s = localStorage.getItem('sniper_stars');
      if (s) stars = JSON.parse(s);
    } catch (e) { unlocked = 1; stars = {}; }
  }
  function saveProgress() {
    try {
      localStorage.setItem('sniper_unlocked', String(unlocked));
      localStorage.setItem('sniper_stars', JSON.stringify(stars));
    } catch (e) {}
  }

  function handleKill(kind) {
    // 击杀反馈（可预留音效/计数）
  }

  function uiSound(){ if (S.audio) { S.audio.unlock(); S.audio.play('ui'); } }
  function bindUI() {
    // 首次交互解锁音频（浏览器自动播放策略要求用户手势后才能出声）
    const unlockAudio = () => { if (S.audio) S.audio.unlock(); };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    document.getElementById('btnStart').addEventListener('click', () => { uiSound(); showScreen('select'); });
    document.getElementById('btnSelectHome').addEventListener('click', () => { uiSound(); showScreen('menu'); });
    document.getElementById('btnRetry').addEventListener('click', () => { uiSound(); restartLevel(); });
    document.getElementById('btnNext').addEventListener('click', () => { uiSound(); goNext(); });

    // 空格发射补充 + P 暂停
    window.addEventListener('keydown', (e) => {
      if (screen === 'playing' && (e.code === 'Space')) { input.shootBuffer = true; }
      if (e.code === 'KeyP' && screen === 'playing') { togglePause(); }
    });
  }

  let paused = false;
  function togglePause() {
    paused = !paused;
    game.speed = paused ? 0 : 1;
    if (S.audio) S.audio.play('ui');
    const el = document.getElementById('pauseTip');
    if (el) el.style.display = paused ? 'flex' : 'none';
  }

  // ---------- 屏幕切换 ----------
  function showScreen(name, levelId) {
    screen = name;
    document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');
    const el = document.getElementById('screen-' + name);
    if (el) el.style.display = 'flex';
    if (name === 'select') renderLevelSelect();
    else if (name === 'playing') { canvas.style.display = 'block'; }
    else { canvas.style.display = 'none'; }
  }

  function renderLevelSelect() {
    const wrap = document.getElementById('levelGrid');
    wrap.innerHTML = '';
    S.levels.all.forEach(lv => {
      const btn = document.createElement('div');
      btn.className = 'levelCard' + (lv.id > unlocked ? ' locked' : '');
      const st = stars[lv.id] || 0;
      btn.innerHTML = `<div class="lvNum">${lv.id}</div>
        <div class="lvName">${lv.name}</div>
        <div class="lvMeta">${'★'.repeat(Math.min(3,st))|| (lv.id>unlocked?'🔒':'' )}</div>`;
      if (lv.id <= unlocked) {
        btn.addEventListener('click', () => startLevel(lv.id));
      }
      wrap.appendChild(btn);
    });
  }

  // 目标：默认从已解锁最高关开始更新，但这里点击关卡标题返回
  function setCurrentLevel(id) {
    currentLevelId = id;
  }

  // ---------- 关卡运行 ----------
  function startLevel(id) {
    setCurrentLevel(id);
    const def = S.levels.get(id);
    resetRuntime(def);
    game.loadLevel(def);
    showScreen('playing');
    updateHUD();
  }

  function restartLevel() {
    const def = S.levels.get(currentLevelId);
    resetRuntime(def);
    game.loadLevel(def);
    showScreen('playing');
    updateHUD();
  }

  function resetRuntime(def) {
    // 初始化本关 runtime
  }

  function goNext() {
    if (currentLevelId < S.levels.count) startLevel(currentLevelId + 1);
    else showScreen('winAll');
  }

  // ---------- 主循环 ----------
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (screen === 'playing') {
      update(dt);
      draw();
      updateHUD();
    }
    requestAnimationFrame(loop);
  }

  function update(dt) {
    // 开镜状态传入 game
    game.zoom = input.zoom;
    // 处理射击输入（按住连点或点击）
    if (input.shooting || input.consumeShoot()) {
      game.shoot(input.mouse, game.zoom ? 2.2 : 1);
    }
    game.update(dt);

    // 胜利/失败转移
    if (game.state === 'win') {
      // 计算评分星级（命中率/队友剩余HP）
      const lvId = currentLevelId;
      const rating = computeRating();
      stars[lvId] = Math.max(stars[lvId] || 0, rating);
      if (lvId === unlocked && lvId < S.levels.count) { unlocked = lvId + 1; }
      saveProgress();
      if (S.audio) S.audio.play(lvId >= S.levels.count ? 'winAll' : 'victory');
      fillScorePanel(rating);
      if (lvId >= S.levels.count) showScreen('winAll');
      else showScreen('win');
    } else if (game.state === 'dead') {
      if (S.audio) S.audio.play('defeat');
      showScreen('dead');
    }
  }

  // 评分：基础1星（通关），命中率≥60% +1星，队友剩余HP≥60% +1星
  function computeRating() {
    const st = game.stats;
    const hitRate = st.shots > 0 ? st.hits / st.shots : 0;
    let score = 1;
    if (hitRate >= 0.6) score++;
    if (game.ally.hpRatio() >= 0.6) score++;
    return Math.min(3, score);
  }

  // 填充结算面板
  function fillScorePanel(rating) {
    const el = document.getElementById('scorePanel');
    if (!el) return;
    const st = game.stats;
    const hitRate = st.shots > 0 ? Math.round(st.hits / st.shots * 100) : 0;
    el.innerHTML =
      `<div class="scoreStars">${'★'.repeat(rating)}${'☆'.repeat(3 - rating)}</div>` +
      `<div class="scoreRow">命中率 <b>${hitRate}%</b>（${st.hits}/${st.shots}）</div>` +
      `<div class="scoreRow">击杀 <b>${st.kills}</b> · 爆头 <b>${st.weakKills}</b> · 最高连杀 <b>${st.kills > 0 ? game.combo : 0}</b></div>` +
      `<div class="scoreRow">队友剩余 <b>${Math.round(game.ally.hpRatio() * 100)}%</b> · 用时 <b>${game.time.toFixed(1)}s</b></div>`;
  }

  // ---------- 绘制 ----------
  function draw() {
    gameCtx.setTransform(1, 0, 0, 1, 0, 0);
    gameCtx.clearRect(0, 0, canvas.width, canvas.height);
    game.render(gameCtx);
    drawScope();
  }

  // 瞄准镜
  function drawScope() {
    const c = gameCtx;
    const mx = input.mouse.x, my = input.mouse.y;
    // 十字线
    c.strokeStyle = 'rgba(255,50,50,0.95)';
    c.lineWidth = 2;
    const L = 18;
    c.beginPath();
    c.moveTo(mx - L, my); c.lineTo(mx - 5, my);
    c.moveTo(mx + 5, my); c.lineTo(mx + L, my);
    c.moveTo(mx, my - L); c.lineTo(mx, my - 5);
    c.moveTo(mx, my + 5); c.lineTo(mx, my + L);
    c.stroke();
    // 中心点
    c.fillStyle = '#ff3232';
    c.beginPath(); c.arc(mx, my, 2, 0, Math.PI * 2); c.fill();

    // 开镜效果
    if (input.zoom) {
      // 四周暗角
      const g = c.createRadialGradient(mx, my, 40, mx, my, 280);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      c.fillStyle = g;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      // 放大镜：围绕鼠标放大画面（近似：在中心画一圈）
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 3;
      c.beginPath(); c.arc(mx, my, 150, 0, Math.PI * 2); c.stroke();
      // 战术提示
      c.fillStyle = 'rgba(255,235,59,0.95)';
      c.font = 'bold 16px system-ui,sans-serif';
      c.textAlign = 'center';
      c.fillText('弱点伤害 ×2', mx, my - 170);
    }
  }

  // ---------- HUD ----------
  function updateHUD() {
    if (!game || !game.level) return;
    document.getElementById('hudLevel').textContent = `关卡 ${currentLevelId}/${S.levels.count}`;
    document.getElementById('hudName').textContent = game.level.name;
    document.getElementById('hudEnemy').textContent = `敌方存活: ${game.enemies.length}`;
    document.getElementById('hudAllyHp').textContent = `队友: ${Math.max(0, Math.round(game.ally.hp))}`;
    document.getElementById('hudAmmo').textContent = `弹药: ${game.ammo}`;
    // 连击 + 命中率 + 击杀
    const st = game.stats;
    const hitRate = st.shots > 0 ? Math.round(st.hits / st.shots * 100) : 100;
    const comboEl = document.getElementById('hudCombo');
    if (comboEl) {
      comboEl.textContent = game.combo >= 2 ? `🔥 ${game.combo} 连杀` : '';
      comboEl.style.display = game.combo >= 2 ? 'inline-block' : 'none';
    }
    const statEl = document.getElementById('hudStat');
    if (statEl) statEl.textContent = `击杀 ${st.kills} · 命中 ${hitRate}%`;
    // 队友推进进度条
    const progEl = document.getElementById('hudProgFill');
    if (progEl && game.level.goalX) progEl.style.width = Math.min(100, game.ally.x / game.level.goalX * 100) + '%';
    // Boss 状态
    const bs = document.getElementById('hudBoss');
    if (game.boss) { bs.style.display = 'block'; bs.textContent = `BOSS HP ${game.boss.hp}`; }
    else bs.style.display = 'none';
  }

  // 暴露给全局（供调试/HTML onclick）
  S.boot = init;
  S._startLevel = startLevel;
  S._showScreen = showScreen;

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
