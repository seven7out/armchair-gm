import { LeagueYear, PositionGroup } from './types';

/**
 * Base 2026 League Salary Cap ($M) per Project Brief ($301.2M)
 */
export const BASE_CAP_2026 = 301.2;

/**
 * Default annual salary cap growth rate (~7.5% per year)
 */
export const DEFAULT_CAP_GROWTH_RATE = 0.075;

/**
 * Compute base league cap ceiling for a given year and growth rate.
 */
export function getLeagueCapCeiling(
  year: LeagueYear,
  growthRate: number = DEFAULT_CAP_GROWTH_RATE
): number {
  const yearsAfter2026 = year - 2026;
  const raw = BASE_CAP_2026 * Math.pow(1 + growthRate, yearsAfter2026);
  return Math.round(raw * 100) / 100;
}

/**
 * NFL CBA Minimum Replacement Salary (51st roster spot displacement baseline) ($M)
 * ~$1.03M in 2026, scaling ~4.5% annually per CBA schedule.
 */
export const REPLACEMENT_MIN_SALARY_BY_YEAR: Record<LeagueYear, number> = {
  2026: 1.03,
  2027: 1.075,
  2028: 1.12,
  2029: 1.165,
};

/**
 * CBA Veteran Minimum Salary ($M) in 2026 by Accrued Seasons, scaled for future years.
 * Used to enforce the minimum base salary floor during a Contract Restructure.
 */
export function getVeteranMinimumSalary(
  accruedSeasons: number,
  year: LeagueYear = 2026
): number {
  const yearEscalator = 1 + (year - 2026) * 0.045;
  let base2026 = 0.885; // 0 accrued seasons (Rookie min)
  if (accruedSeasons === 1) base2026 = 1.03;
  else if (accruedSeasons === 2) base2026 = 1.1;
  else if (accruedSeasons === 3) base2026 = 1.17;
  else if (accruedSeasons >= 4 && accruedSeasons <= 6) base2026 = 1.255;
  else if (accruedSeasons >= 7) base2026 = 1.38;

  return Math.round(base2026 * yearEscalator * 1000) / 1000;
}

/**
 * Positional Aging & Longevity Curve Thresholds
 */
export interface PositionalAgingCurve {
  position: PositionGroup;
  label: string;
  peakStartAge: number;
  peakEndAge: number;
  cliffAge: number;             // Age at which historical production/snap share drops sharply
  severeDeclineAge: number;     // Age where only outliers remain starters
  typicalRetirementAge: number; // Expected ceiling for viable starter seasons calculation
}

export const POSITIONAL_AGING_CURVES: Record<PositionGroup, PositionalAgingCurve> = {
  QB: {
    position: 'QB',
    label: 'Quarterback',
    peakStartAge: 25,
    peakEndAge: 33,
    cliffAge: 35,
    severeDeclineAge: 37,
    typicalRetirementAge: 37,
  },
  RB: {
    position: 'RB',
    label: 'Running Back',
    peakStartAge: 22,
    peakEndAge: 25,
    cliffAge: 27,
    severeDeclineAge: 29,
    typicalRetirementAge: 29,
  },
  WR: {
    position: 'WR',
    label: 'Wide Receiver',
    peakStartAge: 24,
    peakEndAge: 28,
    cliffAge: 30,
    severeDeclineAge: 32,
    typicalRetirementAge: 32,
  },
  TE: {
    position: 'TE',
    label: 'Tight End',
    peakStartAge: 25,
    peakEndAge: 29,
    cliffAge: 31,
    severeDeclineAge: 33,
    typicalRetirementAge: 33,
  },
  OL: {
    position: 'OL',
    label: 'Offensive Line',
    peakStartAge: 25,
    peakEndAge: 30,
    cliffAge: 32,
    severeDeclineAge: 34,
    typicalRetirementAge: 34,
  },
  EDGE: {
    position: 'EDGE',
    label: 'Edge Rusher',
    peakStartAge: 24,
    peakEndAge: 28,
    cliffAge: 30,
    severeDeclineAge: 32,
    typicalRetirementAge: 32,
  },
  IDL: {
    position: 'IDL',
    label: 'Interior DL',
    peakStartAge: 25,
    peakEndAge: 29,
    cliffAge: 31,
    severeDeclineAge: 33,
    typicalRetirementAge: 33,
  },
  LB: {
    position: 'LB',
    label: 'Linebacker',
    peakStartAge: 24,
    peakEndAge: 28,
    cliffAge: 30,
    severeDeclineAge: 32,
    typicalRetirementAge: 31,
  },
  CB: {
    position: 'CB',
    label: 'Cornerback',
    peakStartAge: 23,
    peakEndAge: 27,
    cliffAge: 29,
    severeDeclineAge: 31,
    typicalRetirementAge: 31,
  },
  S: {
    position: 'S',
    label: 'Safety',
    peakStartAge: 24,
    peakEndAge: 28,
    cliffAge: 30,
    severeDeclineAge: 32,
    typicalRetirementAge: 32,
  },
  ST: {
    position: 'ST',
    label: 'Special Teams',
    peakStartAge: 25,
    peakEndAge: 33,
    cliffAge: 36,
    severeDeclineAge: 39,
    typicalRetirementAge: 38,
  },
};

/**
 * Helper to round currency values to 3 decimal places ($1K precision).
 */
export function roundCap(val: number): number {
  return Math.round(val * 1000) / 1000;
}
