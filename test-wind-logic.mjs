#!/usr/bin/env node
/* ============================================================
 * test-wind-logic.mjs — 风偏弹道纯逻辑回归保护单测
 * 覆盖：风偏角计算 / MIL 换算 / 建议补偿 / 残差归零 / 射线偏移方向
 * ============================================================ */
import assert from 'node:assert';
import {
  windDriftAngle, milToRad, radToMil,
  suggestCompMil, residualAngle, aimYawOffset, BULLET_SPEED,
} from './js/wind-logic.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`✅ ${name}`); };

// 1. 风偏角：wind=0 → 0；风速越大偏角越大；初速越慢偏角越大
t('零风偏角为 0', () => assert.strictEqual(windDriftAngle(0), 0));
t('正风速产生正偏角（小角度近似 ≈ wind/speed）', () => {
  const a = windDriftAngle(3, 780);
  assert.ok(a > 0 && a < 0.01, `偏角 ${a} 应在 (0, 0.01) 弧度`);
  assert.ok(Math.abs(a - Math.atan(3 / 780)) < 1e-9, '符合 atan(wind/speed)');
});
t('风速增大偏角增大', () => assert.ok(windDriftAngle(5) > windDriftAngle(3)));
t('初速更慢偏角更大', () => assert.ok(windDriftAngle(3, 300) > windDriftAngle(3, 780)));
t('非法输入返回 0', () => {
  assert.strictEqual(windDriftAngle(3, 0), 0);
  assert.strictEqual(windDriftAngle(NaN), 0);
});

// 2. MIL 换算往返
t('MIL→弧度→MIL 往返一致', () => assert.ok(Math.abs(radToMil(milToRad(2.5)) - 2.5) < 1e-9));
t('1 MIL = 0.001 rad', () => assert.ok(Math.abs(milToRad(1) - 0.001) < 1e-12));

// 3. 建议补偿 = 风偏角（MIL），补偿后残差为 0
t('建议补偿等于风偏角 MIL 值', () => {
  const s = 2.4;
  const sugg = suggestCompMil(s);
  assert.ok(Math.abs(sugg - radToMil(windDriftAngle(s))) < 1e-9);
});
t('按建议补偿后残差为 0（恰好抵消）', () => {
  const s = 3.1;
  const drift = windDriftAngle(s);
  const sugg = suggestCompMil(s);
  assert.ok(Math.abs(residualAngle(drift, sugg)) < 1e-9, '补偿后净偏差应归零');
});
t('未补偿时残差 = 风偏角', () => {
  const s = 2.0;
  assert.ok(Math.abs(residualAngle(windDriftAngle(s), 0) - windDriftAngle(s)) < 1e-9);
});

// 4. 射线偏移方向：风向右(dir=1)应左瞄（负角），风向左应右瞄（正角）
t('dir=1（风向右）→ 瞄准向左偏（负 Yaw）', () => assert.ok(aimYawOffset(1, 2) < 0));
t('dir=-1（风向左）→ 瞄准向右偏（正 Yaw）', () => assert.ok(aimYawOffset(-1, 2) > 0));
t('补偿为 0 → 无偏移（回归保护核心）', () => assert.strictEqual(aimYawOffset(1, 0), 0));
t('补偿增大 → 偏移幅度增大', () => {
  assert.ok(Math.abs(aimYawOffset(1, 3)) > Math.abs(aimYawOffset(1, 1)));
});
t('偏移幅度 = |compMil| * 0.001（MIL 转弧度）', () => {
  assert.ok(Math.abs(aimYawOffset(1, 2) + milToRad(2)) < 1e-12);
  assert.ok(Math.abs(aimYawOffset(-1, 2) - milToRad(2)) < 1e-12);
});

// 5. 常量
t('BULLET_SPEED 为正有限值', () => assert.ok(BULLET_SPEED > 0 && Number.isFinite(BULLET_SPEED)));

console.log(`\n=== 结果: ${passed} 通过, 0 失败 ===`);
