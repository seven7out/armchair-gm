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
 */
export const REPLACEMENT_MIN_SALARY_BY_YEAR: Record<LeagueYear, number> = {
  2026: 1.03,
  2027: 1.075,
  2028: 1.12,
  2029: 1.165,
};

/**
 * CBA Veteran Minimum Salary ($M) in 2026 by Accrued Seasons, scaled for future years.
 */
export function getVeteranMinimumSalary(
  accruedSeasons: number,
  year: LeagueYear = 2026
): number {
  const yearEscalator = 1 + (year - 2026) * 0.045;
  let base2026 = 0.885;
  if (accruedSeasons === 1) base2026 = 1.03;
  else if (accruedSeasons === 2) base2026 = 1.1;
  else if (accruedSeasons === 3) base2026 = 1.17;
  else if (accruedSeasons >= 4 && accruedSeasons <= 6) base2026 = 1.255;
  else if (accruedSeasons >= 7) base2026 = 1.38;

  return Math.round(base2026 * yearEscalator * 1000) / 1000;
}

/**
 * Projected 2026 Non-Exclusive Franchise Tag & Transition Tag Tender Amounts ($M)
 * Calibrated to the $301.2M 2026 League Cap Ceiling.
 */
export const FRANCHISE_TAG_BY_POSITION_2026: Record<
  PositionGroup,
  { franchiseTag: number; transitionTag: number }
> = {
  QB: { franchiseTag: 43.8, transitionTag: 37.9 },
  EDGE: { franchiseTag: 25.1, transitionTag: 21.6 },
  WR: { franchiseTag: 24.8, transitionTag: 21.4 },
  OL: { franchiseTag: 23.4, transitionTag: 20.8 },
  IDL: { franchiseTag: 22.9, transitionTag: 19.5 },
  CB: { franchiseTag: 20.9, transitionTag: 18.2 },
  LB: { franchiseTag: 20.4, transitionTag: 17.6 },
  S: { franchiseTag: 18.6, transitionTag: 15.8 },
  TE: { franchiseTag: 14.4, transitionTag: 12.3 },
  RB: { franchiseTag: 13.6, transitionTag: 11.4 },
  ST: { franchiseTag: 6.4, transitionTag: 5.8 },
};

/**
 * Compute exact Franchise or Transition Tag cost for a player in `targetYear`,
 * enforcing the CBA 120% prior-year cap hit rule (or 144% for a second tag).
 */
export function getPlayerTagCost(
  position: PositionGroup,
  priorYearCapHit: number,
  priorTagsCount: number = 0,
  tagType: 'NON_EXCLUSIVE_FRANCHISE' | 'TRANSITION' = 'NON_EXCLUSIVE_FRANCHISE',
  targetYear: LeagueYear = 2026
): number {
  const yearEscalator = Math.pow(1.075, targetYear - 2026);
  const baseTender =
    (tagType === 'NON_EXCLUSIVE_FRANCHISE'
      ? FRANCHISE_TAG_BY_POSITION_2026[position].franchiseTag
      : FRANCHISE_TAG_BY_POSITION_2026[position].transitionTag) * yearEscalator;

  const cbaMultiplier = priorTagsCount === 0 ? 1.2 : priorTagsCount === 1 ? 1.2 : 1.44;
  const escalatedPrior = priorYearCapHit * cbaMultiplier;

  return Math.round(Math.max(baseTender, escalatedPrior) * 100) / 100;
}

/**
 * Real-World NFL Positional Market Comps (% of Cap at Signing, normalized to 2026 $301.2M Cap).
 * Gives fans immediate context when building an extension or FA contract.
 */
export interface PositionalMarketComp {
  playerName: string;
  team: string;
  position: PositionGroup;
  tierLabel: string;
  pctOfCapAtSigning: number;    // e.g., 11.8 means 11.8% of the league cap when signed
  equivalent2026Apy: number;    // Normalized APY under $301.2M cap ($M)
  years: number;
  guaranteedPct: number;
}

export const POSITIONAL_MARKET_COMPS: Record<PositionGroup, PositionalMarketComp[]> = {
  QB: [
    { playerName: 'Dak Prescott / J. Love Tier', team: 'DAL/GB', position: 'QB', tierLabel: 'Market Reset QB1', pctOfCapAtSigning: 21.5, equivalent2026Apy: 64.8, years: 4, guaranteedPct: 0.76 },
    { playerName: 'Jared Goff / T. Lawrence Tier', team: 'DET/JAX', position: 'QB', tierLabel: 'Franchise QB1', pctOfCapAtSigning: 18.6, equivalent2026Apy: 56.0, years: 4, guaranteedPct: 0.68 },
    { playerName: 'Baker Mayfield / Sam Darnold Tier', team: 'TB/SEA', position: 'QB', tierLabel: 'Bridge / Value Starter', pctOfCapAtSigning: 11.6, equivalent2026Apy: 35.0, years: 3, guaranteedPct: 0.52 },
  ],
  EDGE: [
    { playerName: 'Myles Garrett / N. Bosa Tier', team: 'CLE/SF', position: 'EDGE', tierLabel: 'DPOY Reset Tier', pctOfCapAtSigning: 13.3, equivalent2026Apy: 40.0, years: 4, guaranteedPct: 0.72 },
    { playerName: 'Maxx Crosby / Brian Burns Tier', team: 'LV/NYG', position: 'EDGE', tierLabel: 'Pro Bowl Edge1', pctOfCapAtSigning: 11.2, equivalent2026Apy: 33.8, years: 4, guaranteedPct: 0.64 },
    { playerName: 'Jonathan Greenard / Bryce Huff Tier', team: 'MIN/PHI', position: 'EDGE', tierLabel: 'High-End Starter', pctOfCapAtSigning: 7.4, equivalent2026Apy: 22.3, years: 3, guaranteedPct: 0.54 },
  ],
  WR: [
    { playerName: 'Ja\'Marr Chase / J. Jefferson Tier', team: 'CIN/MIN', position: 'WR', tierLabel: 'All-Pro Alpha WR1', pctOfCapAtSigning: 13.4, equivalent2026Apy: 40.3, years: 4, guaranteedPct: 0.73 },
    { playerName: 'Amon-Ra St. Brown / A.J. Brown Tier', team: 'DET/PHI', position: 'WR', tierLabel: 'Core Contender WR1', pctOfCapAtSigning: 11.0, equivalent2026Apy: 33.1, years: 4, guaranteedPct: 0.65 },
    { playerName: 'Tee Higgins / DeVonta Smith Tier', team: 'CIN/PHI', position: 'WR', tierLabel: 'High-End WR1B / WR2', pctOfCapAtSigning: 9.5, equivalent2026Apy: 28.6, years: 4, guaranteedPct: 0.60 },
  ],
  OL: [
    { playerName: 'Penei Sewell / Tristan Wirfs Tier', team: 'DET/TB', position: 'OL', tierLabel: 'All-Pro Cornerstone OT', pctOfCapAtSigning: 9.8, equivalent2026Apy: 29.5, years: 4, guaranteedPct: 0.68 },
    { playerName: 'Landon Dickerson / Chris Lindstrom Tier', team: 'PHI/ATL', position: 'OL', tierLabel: 'Top-of-Market Guard', pctOfCapAtSigning: 7.4, equivalent2026Apy: 22.3, years: 4, guaranteedPct: 0.60 },
    { playerName: 'Creed Humphrey / Frank Ragnow Tier', team: 'KC/DET', position: 'OL', tierLabel: 'All-Pro Center', pctOfCapAtSigning: 6.4, equivalent2026Apy: 19.3, years: 4, guaranteedPct: 0.58 },
  ],
  IDL: [
    { playerName: 'Chris Jones / Christian Wilkins Tier', team: 'KC/LV', position: 'IDL', tierLabel: 'Game-Wrecking 3-Tech', pctOfCapAtSigning: 11.0, equivalent2026Apy: 33.1, years: 4, guaranteedPct: 0.66 },
    { playerName: 'Alim McNeill / Derrick Brown Tier', team: 'DET/CAR', position: 'IDL', tierLabel: 'Pro Bowl Interior Anchor', pctOfCapAtSigning: 8.5, equivalent2026Apy: 25.6, years: 4, guaranteedPct: 0.60 },
    { playerName: 'Milton Williams / Osa Odighizuwa Tier', team: 'NE/DAL', position: 'IDL', tierLabel: 'Ascending Pass-Rush DT', pctOfCapAtSigning: 6.8, equivalent2026Apy: 20.5, years: 4, guaranteedPct: 0.54 },
  ],
  CB: [
    { playerName: 'Derek Stingley / Pat Surtain II Tier', team: 'HOU/DEN', position: 'CB', tierLabel: 'Shutdown CB1 Reset', pctOfCapAtSigning: 9.9, equivalent2026Apy: 29.8, years: 4, guaranteedPct: 0.68 },
    { playerName: 'Jaylon Johnson / AJ Terrell Tier', team: 'CHI/ATL', position: 'CB', tierLabel: 'Pro Bowl Boundary CB', pctOfCapAtSigning: 7.6, equivalent2026Apy: 22.9, years: 4, guaranteedPct: 0.58 },
    { playerName: 'D.J. Reed / Charvarius Ward Tier', team: 'DET/IND', position: 'CB', tierLabel: 'Veteran Starter CB', pctOfCapAtSigning: 5.5, equivalent2026Apy: 16.5, years: 3, guaranteedPct: 0.50 },
  ],
  S: [
    { playerName: 'Antoine Winfield Jr. / Kerby Joseph Tier', team: 'TB/DET', position: 'S', tierLabel: 'All-Pro Eraser S1', pctOfCapAtSigning: 7.4, equivalent2026Apy: 22.3, years: 4, guaranteedPct: 0.62 },
    { playerName: 'Xavier McKinney / Jevon Holland Tier', team: 'GB/NYG', position: 'S', tierLabel: 'Premier Free-Agent Safety', pctOfCapAtSigning: 6.3, equivalent2026Apy: 19.0, years: 4, guaranteedPct: 0.56 },
  ],
  LB: [
    { playerName: 'Roquan Smith / Fred Warner Tier', team: 'BAL/SF', position: 'LB', tierLabel: 'All-Pro Field General', pctOfCapAtSigning: 7.2, equivalent2026Apy: 21.7, years: 4, guaranteedPct: 0.60 },
    { playerName: 'Zack Baun / Frankie Luvu Tier', team: 'PHI/WAS', position: 'LB', tierLabel: 'Impact 3-Down Starter', pctOfCapAtSigning: 5.2, equivalent2026Apy: 15.7, years: 3, guaranteedPct: 0.52 },
  ],
  TE: [
    { playerName: 'Trey McBride / George Kittle Tier', team: 'ARI/SF', position: 'TE', tierLabel: 'Elite Receiving TE1', pctOfCapAtSigning: 6.6, equivalent2026Apy: 19.9, years: 4, guaranteedPct: 0.62 },
    { playerName: 'Sam LaPorta / T.J. Hockenson Tier', team: 'DET/MIN', position: 'TE', tierLabel: 'Pro Bowl Y/F Mismatch', pctOfCapAtSigning: 5.9, equivalent2026Apy: 17.8, years: 4, guaranteedPct: 0.56 },
  ],
  RB: [
    { playerName: 'Saquon Barkley / C. McCaffrey Tier', team: 'PHI/SF', position: 'RB', tierLabel: 'Offensive Engine RB1', pctOfCapAtSigning: 6.6, equivalent2026Apy: 19.9, years: 3, guaranteedPct: 0.62 },
    { playerName: 'Josh Jacobs / Derrick Henry Tier', team: 'GB/BAL', position: 'RB', tierLabel: 'Workhorse Bellcow', pctOfCapAtSigning: 4.4, equivalent2026Apy: 13.2, years: 3, guaranteedPct: 0.48 },
  ],
  ST: [
    { playerName: 'Harrison Butker / Brandon Auburn Tier', team: 'KC/DAL', position: 'ST', tierLabel: 'All-Pro Specialist', pctOfCapAtSigning: 2.1, equivalent2026Apy: 6.4, years: 4, guaranteedPct: 0.50 },
  ],
};

/**
 * Positional Aging & Longevity Curve Thresholds
 */
export interface PositionalAgingCurve {
  position: PositionGroup;
  label: string;
  peakStartAge: number;
  peakEndAge: number;
  cliffAge: number;
  severeDeclineAge: number;
  typicalRetirementAge: number;
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

export function roundCap(val: number): number {
  return Math.round(val * 1000) / 1000;
}
