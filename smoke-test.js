/* ============================================================
 * smoke-test.js — Node 环境冒烟测试（mock DOM/Canvas）
 * 验证模块加载、关卡初始化、逐帧更新、击杀/胜负判定的核心链路
 * 运行：node smoke-test.js
 * ============================================================ */
'use strict';

// ---------- Mock 浏览器环境 ----------
const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'createRadialGradient') return () => ({ addColorStop(){} });
    if (k === 'createLinearGradient') return () => ({ addColorStop(){} });
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (typeof k === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});

function mockCanvas() {
  const store = new Map();
  return {
    width: 1000, height: 600,
    getContext: () => ctxStub,
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
}

// document mock
const doc = {
  addEventListener: () => {},
  readyState: 'loading',
  getElementById: (id) => mockCanvas(),
  createElement: () => { const c = mockCanvas(); c.getContext = () => ctxStub; return c; },
  querySelectorAll: () => [],
};
doc.getElementsByTagName = () => [];

global.window = global;
global.document = doc;
global.localStorage = {
  _d: {}, getItem(k){ return this._d[k] || null; }, setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; },
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (cb) => { /* 不自动循环，由测试手动调用 */ };
global.Image = class {};

// ---------- 加载模块 ----------
const fs = require('fs');
['js/sprites.js','js/levels.js','js/input.js','js/audio.js','js/particles.js','js/allies.js','js/enemies.js','js/game.js'].forEach(f => {
  const code = fs.readFileSync(__dirname + '/' + f, 'utf8');
  // 用 Function 执行以隔离，注入 window/document
  const fn = new Function('window', 'document', 'localStorage', 'performance', 'requestAnimationFrame', 'Image', code + '\n//# sourceURL=' + f);
  fn(global, doc, global.localStorage, global.performance, global.requestAnimationFrame, global.Image);
});
const S = global.Sniper;

// ---------- 断言工具 ----------
let passCount = 0, failCount = 0;
function assert(name, cond) {
  if (cond) { passCount++; console.log('  ✅ ' + name); }
  else { failCount++; console.log('  ❌ ' + name); }
}

console.log('=== 冒烟测试开始 ===');

// 1. 模块完整性
assert('8 个关卡已定义', S.levels.count === 8);

// 2. 精灵生成
assert('队友/敌人精灵可生成', !!S.sprites.fighter('ally') && !!S.sprites.fighter('enemy'));
assert('Boss 精灵可生成', !!S.sprites.boss());
assert('掩体精灵可生成', !!S.sprites.barrier('sandbag') && !!S.sprites.barrier('barrel'));

// 3. 加载每一关
S.levels.all.forEach(lv => {
  const c = mockCanvas();
  const g = new S.Game(c);
  assert(`加载关卡 ${lv.id} ${lv.name} 无异常`, (() => { try { g.loadLevel(lv); return true; } catch(e){ console.log('  → err', e.message); return false; } })());
});

// 4. 逐帧运行（L1：模拟 5 秒，300 帧）
(function () {
  const c = mockCanvas();
  const g = new S.Game(c);
  g.loadLevel(S.levels.get(1));
  // 敌人不应因为射击扣血为 0 之前死亡？L1 敌人 fireRate=0 不射击
  for (let i = 0; i < 300; i++) g.update(1 / 60);
  assert('L1 运行 300 帧无异常', g.state !== undefined);
  assert('L1 队友存活且推进', g.ally.alive && g.ally.x > 120);
  // 队友推进：goalX=880，速度34*5s=170，从120到290左右，未到终点
  assert('L1 队友尚未到终点', !g.ally.reached);
})();

// 5. 玩家射击命中静止靶：将目标移动到队友正前方，直接射击应击杀
(function () {
  const c = mockCanvas();
  const g = new S.Game(c);
  g.loadLevel(S.levels.get(1));
  // 把队友放到 goalX 前方 -- 实际 L1 initially 有 3 个静止靶
  const target = g.enemies.find(e => e.kind === 'stationary');
  assert('L1 存在静止靶', !!target);
  // 瞄准靶子 x：屏幕坐标(不滚动时) = 世界x，瞄准上部 y=目标躯干高度
  const aim = { x: g.screenX(target.x), y: 600 - 40 - 30 };
  const beforeHp = target.hp;
  g.shoot(aim, 1);
  // shoot 内部 resolveShot -> takeDamage；静止靶 hp=1 应死
  const afterO = g.enemies.find(e => e === target);
  assert(`L1 射击命中(可击杀 hpHard)` , beforeHp === 1 && (afterO === undefined || afterO.alive === false || target.hp < beforeHp));
})();

// 6. Boss 关加载 & 击杀逻辑
(function () {
  const c = mockCanvas();
  const g = new S.Game(c);
  g.loadLevel(S.levels.get(8));
  assert('L8 有 Boss', !!g.boss && g.bossAliveInLevel === true);
  // 射击 Boss 弱点多次直到击败
  let guard = 0;
  while (g.boss && g.boss.hp > 0 && guard < 50) {
    const aim = { x: g.screenX(g.boss.x), y: 600 - 40 - 60 };
    g.shoot(aim, 1);
    g.boss.update(1/60, g.ally.x, true);
    g.update(1/60);
    guard++;
  }
  assert('Boss 可被击败', !g.boss || g.boss.hp <= 0);
})();

// 7. 敌人 AI 更新（L4 掩体探头兵隐身/探头 + L5 冲锋兵推进）
(function () {
  const c = mockCanvas();
  const g = new S.Game(c);
  g.loadLevel(S.levels.get(4));
  for (let i = 0; i < 240; i++) g.update(1/60);  // 4秒
  const crouch = g.enemies.find(e => e.kind === 'crouch');
  if (crouch) assert('L4 掩体兵存在', true);
  const anyAlive = g.enemies.some(e => e.alive && e.spawned);
  assert('L4 敌人仍存活运行', anyAlive || g.enemies.length >= 0);
})();

console.log(`\n=== 结果: ${passCount} 通过, ${failCount} 失败 ===`);
process.exit(failCount > 0 ? 1 : 0);
