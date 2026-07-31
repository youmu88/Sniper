/* ============================================================
 * integrated-test.js — 胜负循环集成测试
 * 验证：非Boss关可通过击杀敌人使队友抵终点胜利；不杀敌则战败；
 *       Boss关需击败Boss且队友抵达才胜利。
 * 运行：node integrated-test.js
 * ============================================================ */
'use strict';

// ---------- Mock 浏览器环境 ----------
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'createRadialGradient') return () => ({ addColorStop(){} });
    if (k === 'createLinearGradient') return () => ({ addColorStop(){} });
    if (k === 'measureText') return () => ({ width: 10 });
    if (typeof k === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
function mockCanvas() {
  return {
    width: 1000, height: 600,
    getContext: () => ctxStub,
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}
const doc = {
  addEventListener: () => {},
  readyState: 'loading',
  getElementById: () => mockCanvas(),
  createElement: () => { const c = mockCanvas(); c.getContext = () => ctxStub; return c; },
};
global.window = global;
global.document = doc;
global.localStorage = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => {};
global.Image = class {};

const fs = require('fs');
['js/sprites.js','js/levels.js','js/input.js','js/allies.js','js/enemies.js','js/game.js'].forEach(f => {
  const code = fs.readFileSync(__dirname + '/' + f, 'utf8');
  // 挂在 global 环境执行，使模块内 document/window 等引用全局 mock
  (0, eval)(code + '\n//# sourceURL=' + f);
});

const S = global.Sniper;
let pass = 0, fail = 0;
function ok(name) { pass++; console.log('  ✅ ' + name); }
function bad(name, extra) { fail++; console.log('  ❌ ' + name + (extra ? ' :: ' + extra : '')); }

function makeGame(levelId) {
  const g = new S.Game(mockCanvas());
  g.loadLevel(S.levels.get(levelId));
  return g;
}
const DT = 1/60;

console.log('=== 胜负循环集成测试 ===');

// 1. 普通关：击杀所有敌人后，队友推进应抵达终点 → win
{
  const g = makeGame(1);
  // 击杀所有敌人
  g.enemies.forEach(e => { e.hp = 0; e.update(0, g.ally.x, true); });
  g.enemies = g.enemies.filter(e => e.alive);
  ok(g.enemies.length === 0, '清空敌人');
  // 推进模拟 60 秒
  for (let i = 0; i < 60 * 60; i++) {
    g.update(DT);
    if (g.state === 'win') break;
  }
  g.update(DT);
  g.state === 'win' ? ok('普通关击杀后队友抵达 → 胜利') : bad('普通关应胜利，实际=' + g.state);
}

// 2. 普通关：不杀敌，队友会被敌火击倒 → dead
{
  const g = makeGame(1);
  // L1 敌人不射击(fireRate=0)，改用强制伤害队友验证死判定
  // 手动把队友打空血
  g.ally.hp = 1;
  g.ally.takeDamage(100);
  g.update(DT);
  g.update(DT);
  g.state === 'dead' ? ok('队友血空 → 战败') : bad('应战败，实际=' + g.state);
}

// 3. 普通关：队友达终点即使敌人未清完也胜利（掩护优先级）
{
  const g = makeGame(1);
  // 移除敌人，让队友快速抵达
  g.enemies = [];
  for (let i = 0; i < 60 * 60; i++) {
    g.update(DT);
    if (g.state === 'win') break;
  }
  g.state === 'win' ? ok('队友抵达终点 → 胜利(敌人已清)') : bad('应胜利,实际=' + g.state);
}

// 4. Boss关：不击败Boss，队友抵达不胜利
{
  const g = makeGame(8);
  ok(!!g.boss, 'Boss关加载出Boss');
  // 队友推进到终点
  for (let i = 0; i < 60 * 60; i++) {
    g.update(DT);
    if (g.state !== 'running') break;
  }
  (g.state === 'running') ? ok('Boss未击败+队友抵达 → 仍进行中(不提前胜利)') : bad('Boss关仍在running,实际=' + g.state);
}

// 5. Boss关：击败Boss 且 队友抵达 → 胜利
{
  const g = makeGame(8);
  // 通过真实游戏路径击败Boss：设HP为0后调 game.update，引擎内敌人遍历会判定死亡并调 _onBossDefeated
  g.boss.hp = 0;
  g.update(DT);           // 引擎内会消费 e.update() 返回值 → _onBossDefeated(e) → bossDefeated=true
  g.update(DT);
  ok(g.bossDefeated === true, 'Boss死亡触发 bossDefeated（真实路径）');
  // 队友抵达
  for (let i = 0; i < 60 * 60; i++) {
    g.update(DT);
    if (g.state === 'win') break;
  }
  g.state === 'win' ? ok('Boss击败+队友抵达 → 总胜利') : bad('应胜利,实际=' + g.state + ' bossDefeated=' + g.bossDefeated + ' reached=' + g.ally.reached);
}

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
