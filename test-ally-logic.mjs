/* ============================================================
 * test-ally-logic.mjs — 队友推进/阻挡逻辑单元测试
 * 运行：node test-ally-logic.mjs
 * ============================================================ */
import { computeAllyAdvance, ALLY_SAFE_GAP } from './js/ally-logic.js';

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

console.log('=== 队友推进/阻挡逻辑测试 ===');
const G = 18, A = -18; // 终点 / 起点

// 1. 无威胁 → 直奔终点
{
  const r = computeAllyAdvance(A, G, []);
  assert('无敌人: target=goalX', r.targetX === G);
  assert('无敌人: 不等待', r.waiting === false && r.threatX === null);
}

// 2. 前方敌人 → 保持线 = 威胁前 SAFE_GAP，未达线不等待
{
  const r = computeAllyAdvance(A, G, [-8]);
  assert('前方敌人: target = threatX - GAP', r.targetX === -8 - ALLY_SAFE_GAP);
  assert('前方敌人未达保持线: 不等待', r.waiting === false);
  assert('前方敌人: threatX 正确', r.threatX === -8);
}

// 3. 到达保持线 → waiting=true 且不再前进
{
  const r = computeAllyAdvance(-15, G, [-8]); // 保持线 = -15
  assert('到达保持线: waiting=true', r.waiting === true);
  assert('到达保持线: target 停在保持线', r.targetX === -15);
}

// 4. 身后敌人不挡路
{
  const r = computeAllyAdvance(0, G, [-10, -5]);
  assert('身后敌人: target=goalX 不等待', r.targetX === G && r.waiting === false);
}

// 5. 终点之外的敌人不挡路
{
  const r = computeAllyAdvance(0, G, [25]);
  assert('终点外敌人: target=goalX', r.targetX === G && r.waiting === false);
}

// 6. 多敌人取最近威胁
{
  const r = computeAllyAdvance(A, G, [8, -4, 12]);
  assert('多敌人取最近威胁', r.threatX === -4 && r.targetX === -4 - ALLY_SAFE_GAP);
}

// 7. 冲锋兵贴脸（threat-GAP 在身后）→ 不倒退
{
  const r = computeAllyAdvance(-10, G, [-9]);
  assert('敌人贴脸: 不倒退 target=allyX', r.targetX === -10);
  assert('敌人贴脸: waiting=true', r.waiting === true);
}

// 8. 清除威胁后恢复推进
{
  const before = computeAllyAdvance(-15, G, [-8]);
  const after = computeAllyAdvance(-15, G, []);
  assert('清敌前停滞', before.waiting === true);
  assert('清敌后恢复推进', after.targetX === G && after.waiting === false);
}

// 9. 终点线处的敌人仍挡路
{
  const r = computeAllyAdvance(10, G, [17.5]);
  assert('终点前敌人: 被挡', r.threatX === 17.5 && r.targetX === 17.5 - ALLY_SAFE_GAP);
}

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
