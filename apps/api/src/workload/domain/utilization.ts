import type { WorkloadLevel } from '@prisma/client';

export interface Thresholds {
  high: number;
  full: number;
  overload: number;
}

export function utilizationOf(effLoad: number, effCap: number): number {
  if (effCap <= 0) return effLoad > 0 ? Number.POSITIVE_INFINITY : 0;
  return effLoad / effCap;
}

export function levelOf(u: number, t: Thresholds): WorkloadLevel {
  if (u > t.overload) return 'OVERLOAD';
  if (u >= t.full) return 'FULL';
  if (u >= t.high) return 'HIGH';
  return 'NORMAL';
}

/** Spread = max − median (docs 04 §9) */
export function spreadOf(utils: number[]): number {
  const xs = utils.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  return Math.round((xs[xs.length - 1] - median) * 1000) / 1000;
}
