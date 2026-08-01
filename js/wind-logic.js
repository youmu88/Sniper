/* ============================================================
 * wind-logic.js — 弹道风偏纯逻辑（可单测，回归保护核心）
 * 模拟《狙击精英》mil-dot 调零：侧风使弹道横向偏移，
 * 玩家按镜内读数手动调整补偿密位（MIL），补偿准确则命中。
 * ============================================================ */

// 狙击枪弹丸初速（m/s）——决定风偏角大小
export const BULLET_SPEED = 780;

/** 均匀侧风造成的弹道偏转角（弧度）
 * 小角度近似：drift ≈ wind / speed（风使弹丸横向获得 wind 速度，
 * 飞行时间 t = d/speed，横向位移 = wind*t，角位移 ≈ wind*t/d = wind/speed）
 */
export function windDriftAngle(windSpeed, bulletSpeed = BULLET_SPEED) {
  if (bulletSpeed <= 0 || !Number.isFinite(windSpeed) || windSpeed === 0) return 0;
  const angle = Math.atan(windSpeed / bulletSpeed);
  return angle === 0 ? 0 : angle; // 规范化 -0 → 0
}

/** MIL（密位）→ 弧度：1 MIL = 1/1000 rad */
export function milToRad(mil) {
  return mil * 0.001;
}

/** 弧度 → MIL */
export function radToMil(rad) {
  return rad / 0.001;
}

/** 建议补偿密位：等于风偏角（MIL），玩家照此调零即可命中 */
export function suggestCompMil(windSpeed, bulletSpeed = BULLET_SPEED) {
  return radToMil(windDriftAngle(windSpeed, bulletSpeed));
}

/** 补偿后净偏差（弧度）：风偏角 - 玩家补偿。0 = 恰好抵消 */
export function residualAngle(driftRad, compMil) {
  return driftRad - milToRad(compMil);
}

/** 根据风向符号与玩家补偿，计算瞄准射线绕 Y 轴应旋转的角度（弧度）
 *  dir: 1 = 风从右向左吹（弹道偏左需向右瞄），-1 = 反向
 *  返回值为施加到基础瞄准方向的旋转角（水平面内）
 */
export function aimYawOffset(dir, compMil) {
  const sign = dir >= 0 ? 1 : -1;
  const offset = -sign * milToRad(compMil);
  return offset === 0 ? 0 : offset; // 规范化 -0 → 0
}
