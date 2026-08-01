/* ============================================================
 * hud.js — UI/菜单/HUD 管理
 * 接口对齐 main.js 的调用方式
 * ============================================================ */

export class HUD {
  constructor() {
    this.onLevelSelect = null;
    this.onMenuStart = null;
    this._bindUI();
  }

  _bindUI() {
    this.el = {
      menu: document.getElementById('screen-menu'),
      select: document.getElementById('screen-select'),
      win: document.getElementById('screen-win'),
      dead: document.getElementById('screen-dead'),
      winAll: document.getElementById('screen-winAll'),
      level: document.getElementById('hudLevel'),
      name: document.getElementById('hudName'),
      enemy: document.getElementById('hudEnemy'),
      allyHp: document.getElementById('hudAllyHp'),
      ammo: document.getElementById('hudAmmo'),
      stat: document.getElementById('hudStat'),
      combo: document.getElementById('hudCombo'),
      boss: document.getElementById('hudBoss'),
      progFill: document.getElementById('hudProgFill'),
      levelGrid: document.getElementById('levelGrid'),
      objective: document.getElementById('objective'),
      scorePanel: document.getElementById('scorePanel'),
      pauseTip: document.getElementById('pauseTip'),
      scopeOverlay: document.getElementById('scope-overlay'),
      controlsHint: document.getElementById('controls-hint'),
    };
  }

  init(state) {
    this.showMenuScreen();
  }

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('show'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('show');
    if (this.el.controlsHint) {
      this.el.controlsHint.style.display = (name === 'playing') ? 'block' : 'none';
    }
  }

  // === main.js 调用的接口 ===
  showMenuScreen() { this.showScreen('menu'); }
  showSelectScreen(state, levels) { this.showScreen('select'); this.renderLevelSelect(state.unlocked, state.stars, levels); }
  showWinScreen(rating, state) { this.showScreen('win'); this.fillScorePanel(rating, state); }
  showDeadScreen() { this.showScreen('dead'); }
  showWinAllScreen() { this.showScreen('winAll'); }

  // === HUD 更新（接收对象参数） ===
  updateHUD(data) {
    if (this.el.level) this.el.level.textContent = `关卡 ${data.levelId || '-'}`;
    if (this.el.name) this.el.name.textContent = data.levelName || '-';
    if (this.el.enemy) this.el.enemy.textContent = `敌方 ${data.enemiesAlive ?? '?'}`;
    if (this.el.allyHp) this.el.allyHp.textContent = `队友 ${data.allyHp ?? '?'}%`;
    if (this.el.ammo) this.el.ammo.textContent = `弹药 ${data.ammo ?? '?'}`;
    if (this.el.stat) this.el.stat.textContent = `击杀 ${data.kills ?? 0}`;

    // 连击
    if (data.combo > 1) {
      if (this.el.combo) { this.el.combo.style.display = 'inline'; this.el.combo.textContent = `🔥 ${data.combo}连杀`; }
    } else {
      if (this.el.combo) this.el.combo.style.display = 'none';
    }

    // 进度条
    if (this.el.progFill && data.progress != null) {
      this.el.progFill.style.width = `${data.progress * 100}%`;
    }

    // Boss
    if (this.el.boss) {
      if (data.bossHp != null && data.bossHp > 0) {
        this.el.boss.style.display = 'inline';
        this.el.boss.textContent = `BOSS ${data.bossHp}%`;
      } else {
        this.el.boss.style.display = 'none';
      }
    }
  }

  renderLevelSelect(unlocked, stars, levels) {
    const wrap = this.el.levelGrid;
    if (!wrap) return;
    wrap.innerHTML = '';
    const levelNames = [
      { id: 1, name: '初出茅庐' }, { id: 2, name: '稳步推进' },
      { id: 3, name: '火力集结' }, { id: 4, name: '夜色迷踪' },
      { id: 5, name: '敌后穿插' }, { id: 6, name: '火力压制' },
      { id: 7, name: '铁血长廊' }, { id: 8, name: '终极 Boss' },
    ];
    levelNames.forEach(lv => {
      const btn = document.createElement('div');
      btn.className = 'levelCard' + (lv.id > unlocked ? ' locked' : '');
      const st = stars[lv.id] || 0;
      btn.innerHTML = `<div class="lvNum">${lv.id}</div>
        <div class="lvName">${lv.name}</div>
        <div class="lvMeta">${'★'.repeat(Math.min(3, st)) || (lv.id > unlocked ? '🔒' : '')}</div>`;
      if (lv.id <= unlocked) {
        btn.addEventListener('click', () => {
          if (this.onLevelSelect) this.onLevelSelect(lv.id);
        });
      }
      wrap.appendChild(btn);
    });
  }

  fillScorePanel(rating, state) {
    const el = this.el.scorePanel;
    if (!el) return;
    const st = state.stats;
    const hitRate = st.shots > 0 ? Math.round(st.hits / st.shots * 100) : 0;
    el.innerHTML =
      `<div class="scoreStars">${'★'.repeat(rating)}${'☆'.repeat(3 - rating)}</div>` +
      `<div class="scoreRow">命中率 <b>${hitRate}%</b>（${st.hits}/${st.shots}）</div>` +
      `<div class="scoreRow">击杀 <b>${st.kills}</b> · 爆头 <b>${st.weakKills}</b></div>` +
      `<div class="scoreRow">用时 <b>${state.gameTime.toFixed(1)}s</b></div>`;
  }
}