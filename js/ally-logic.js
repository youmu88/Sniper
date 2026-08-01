/* ============================================================
 * ally-logic.js — 队友推进/阻挡决策纯逻辑（无 three 依赖，可单测）
 * 规则：队友前进路上最近的前方存活敌人即"威胁"，
 *       队友推进至威胁前 SAFE_GAP 处停等，威胁清除后自动继续前进。
 * ============================================================ */

/** 与前方威胁保持的最小横向安全距离（世界单位） */
export const ALLY_SAFE_GAP = 7;

/**
 * 计算队友本帧推进目标与等待状态
 * @param {number} allyX      队友当前 x
 * @param {number} goalX      终点 x
 * @param {number[]} threatXs 存活且已出现的敌人 x 列表
 * @param {number} [safeGap]  安全距离，默认 ALLY_SAFE_GAP
 * @returns {{ targetX:number, waiting:boolean, threatX:number|null }}
 *   targetX 本帧推进目标（不倒退、不越过终点）
 *   waiting 队友已停在保持线，等待玩家清敌
 *   threatX 当前挡路的最近前方敌人 x（无威胁为 null）
 */
export function computeAllyAdvance(allyX, goalX, threatXs, safeGap = ALLY_SAFE_GAP) {
  // 只统计"队友前方 且 终点线附近以内"的敌人；身后与终点之外的敌人不挡路
  const ahead = threatXs
    .filter(x => x > allyX + 0.05 && x < goalX + 1)
    .sort((a, b) => a - b);

  if (ahead.length === 0) {
    return { targetX: goalX, waiting: false, threatX: null };
  }

  const threatX = ahead[0];
  // 保持线 = 威胁前 safeGap；不越过终点、不倒退
  const stopX = Math.max(allyX, Math.min(goalX, threatX - safeGap));
  return { targetX: stopX, waiting: allyX >= stopX - 0.05, threatX };
}
