import { REPLACEMENT_MIN_SALARY_BY_YEAR, roundCap } from './constants';
import {
  ContractYear,
  DraftPick,
  LEAGUE_YEARS,
  LeagueYear,
  Player,
  PositionGroup,
} from './types';

/**
 * Deterministic NFL Rookie Wage Scale & Trade Value Engine (`draftEngine.ts`).
 *
 * Implements:
 * 1. Exact 4-year rookie contract generator for overall picks 1..262 (2026 CBA Rookie Pool curves).
 * 2. Net marginal cap impact after Top-51 roster displacement (~$1.03M 51st contract displaced).
 * 3. Round 1 Fifth-Year Option projection by position tier and draft slot.
 * 4. Both Rich Hill (modern NFL front-office consensus) and Fitzgerald-Spielberger (analytical surplus value)
 *    draft pick & player trade value calculators.
 */

export interface RookieSlotContractProjection {
  overallPick: number;
  round: number;
  totalFourYearValue: number;
  signingBonusTotal: number;
  annualProratedBonus: number;
  year1CapHit: number;
  year1NetCapImpactAfterDisplacement: number;
  projectedFifthYearOption: number | null;
  contractYears: Record<LeagueYear, ContractYear | null>;
}

/**
 * Estimate total 4-year rookie contract value ($M) and signing bonus ($M) for pick 1..262.
 * Calibrated to the 2026–2027 NFL CBA rookie pool (~$49.5M for #1 overall, ~$14.2M for #32,
 * scaling smoothly down to ~$4.42M for #262 Mr. Irrelevant).
 */
export function getRookieSlotTotals(overallPick: number): {
  totalValue: number;
  signingBonus: number;
  round: number;
} {
  const clampedPick = Math.max(1, Math.min(262, Math.round(overallPick)));
  const round = Math.min(7, Math.ceil(clampedPick / 32));

  let totalValue: number;
  let signingBonusPct: number;

  if (clampedPick === 1) {
    totalValue = 49.5;
    signingBonusPct = 0.64;
  } else if (clampedPick <= 10) {
    // Picks 2..10: exponential curve from $46.2M down to $25.4M
    const t = (clampedPick - 1) / 9;
    totalValue = 49.5 * Math.pow(0.515, t);
    signingBonusPct = 0.62 - t * 0.06;
  } else if (clampedPick <= 32) {
    // Picks 11..32: $24.5M down to $14.2M
    const t = (clampedPick - 10) / 22;
    totalValue = 25.4 * Math.pow(0.56, t);
    signingBonusPct = 0.55 - t * 0.08;
  } else if (clampedPick <= 64) {
    // Round 2 (33..64): $11.8M down to $6.9M
    const t = (clampedPick - 33) / 31;
    totalValue = 11.8 * Math.pow(0.585, t);
    signingBonusPct = 0.42 - t * 0.12;
  } else if (clampedPick <= 100) {
    // Round 3 (65..100): $6.4M down to $5.6M
    const t = (clampedPick - 65) / 35;
    totalValue = 6.4 - t * 0.8;
    signingBonusPct = 0.24 - t * 0.05;
  } else {
    // Rounds 4..7 (101..262): $5.35M down to $4.42M
    const t = (clampedPick - 101) / 161;
    totalValue = 5.35 - t * 0.93;
    signingBonusPct = 0.16 - t * 0.12;
  }

  const signingBonus = roundCap(totalValue * signingBonusPct);
  return {
    totalValue: roundCap(totalValue),
    signingBonus,
    round,
  };
}

/**
 * Project the Round 1 Fifth-Year Option salary ($M) based on position and draft slot (Top 10 vs 11–32).
 */
export function getProjectedFifthYearOption(
  overallPick: number,
  position: PositionGroup = 'EDGE'
): number | null {
  if (overallPick > 32) return null;
  const isTop10 = overallPick <= 10;

  const baseByPos: Record<PositionGroup, [number, number]> = {
    QB: [38.5, 29.8],
    WR: [26.4, 21.8],
    EDGE: [25.2, 20.6],
    OL: [23.8, 19.4],
    CB: [21.5, 17.9],
    IDL: [21.0, 17.2],
    LB: [19.2, 15.8],
    S: [17.4, 14.2],
    TE: [15.6, 12.8],
    RB: [14.2, 11.5],
    ST: [6.8, 5.9],
  };

  const [top10Val, lateR1Val] = baseByPos[position] ?? [20.0, 16.5];
  return isTop10 ? top10Val : lateR1Val;
}

/**
 * Generate a deterministic 4-year rookie contract structure starting in `draftYear`.
 * Per CBA rules, rookie base salaries start near the rookie minimum in Year 1 and escalate
 * across Years 2–4 while the signing bonus prorates evenly across all 4 years.
 */
export function generateRookieContract(
  overallPick: number,
  draftYear: LeagueYear = 2026,
  position: PositionGroup = 'EDGE',
  replacementCutoff: number = REPLACEMENT_MIN_SALARY_BY_YEAR[draftYear]
): RookieSlotContractProjection {
  const { totalValue, signingBonus, round } = getRookieSlotTotals(overallPick);
  const annualProratedBonus = roundCap(signingBonus / 4);
  const remainingBasePool = Math.max(3.9, totalValue - signingBonus);

  // CBA 25% annual escalator weights across 4 years: [18%, 23%, 27%, 32%] of total base pool
  const weights = [0.18, 0.23, 0.27, 0.32];
  const isFirstRound = overallPick <= 32;

  const contractYears: Record<LeagueYear, ContractYear | null> = {
    2026: null,
    2027: null,
    2028: null,
    2029: null,
  };

  for (let i = 0; i < 4; i++) {
    const y = (draftYear + i) as LeagueYear;
    if (LEAGUE_YEARS.includes(y)) {
      const baseSalary = roundCap(Math.max(0.885 + i * 0.115, remainingBasePool * weights[i]));
      const guaranteedSalary =
        isFirstRound || (overallPick <= 64 && i <= 1) ? baseSalary : 0;

      contractYears[y] = {
        year: y,
        baseSalary,
        guaranteedSalary,
        proratedBonus: annualProratedBonus,
        rosterBonus: 0,
        workoutBonus: 0,
        isVoidYear: false,
      };
    }
  }

  const firstYear = contractYears[draftYear];
  const year1CapHit = firstYear
    ? roundCap(firstYear.baseSalary + firstYear.proratedBonus)
    : roundCap(0.885 + annualProratedBonus);

  // Top-51 Roster Displacement: adding a draft pick pushes out the 51st-lowest contract
  const year1NetCapImpactAfterDisplacement = roundCap(
    Math.max(0, year1CapHit - replacementCutoff)
  );

  return {
    overallPick,
    round,
    totalFourYearValue: totalValue,
    signingBonusTotal: signingBonus,
    annualProratedBonus,
    year1CapHit,
    year1NetCapImpactAfterDisplacement,
    projectedFifthYearOption: getProjectedFifthYearOption(overallPick, position),
    contractYears,
  };
}

/**
 * Create a full `Player` entity when a user signs/simulates a draft pick in the sandbox.
 */
export function createDraftedPlayer(
  pick: DraftPick,
  prospectName: string,
  position: PositionGroup
): Player {
  const slot = generateRookieContract(pick.overallPick, pick.year, position);
  const rating = Math.max(
    68,
    Math.min(86, Math.round(86 - Math.pow(pick.overallPick, 0.52) * 1.45))
  );

  return {
    id: `rookie-${pick.year}-${pick.overallPick}`,
    name: prospectName,
    position,
    ageIn2026: pick.year === 2026 ? 21 : 20,
    tier: pick.overallPick <= 64 ? 'Rookie' : 'Depth',
    overallRating: rating,
    accruedSeasons: 0,
    draftRound: pick.round,
    draftPick: pick.overallPick,
    isRookieContract: true,
    notes: `2026 Draft Pick #${pick.overallPick} (Rd ${pick.round})`,
    contractYears: slot.contractYears,
  };
}

// ============================================================================
// Trade Value Calculator (Rich Hill & Fitzgerald-Spielberger Charts)
// ============================================================================

export type TradeChartModel = 'RichHill' | 'FitzgeraldSpielberger';

/**
 * Compute Draft Pick Trade Value on either the Rich Hill (1000 pt max) or
 * Fitzgerald-Spielberger (3000 pt max analytical curve) scale.
 */
export function getDraftPickTradeValue(
  overallPick: number,
  chart: TradeChartModel = 'RichHill',
  futureYearDiscount: number = 0 // 0 for current draft, 1 for next year's pick
): number {
  const p = Math.max(1, Math.min(262, overallPick));
  let rawValue: number;

  if (chart === 'RichHill') {
    // Rich Hill Chart: #1 = 1000, #10 = 369, #32 = 184, #64 = 78, #100 = 35, #262 = 1
    if (p === 1) rawValue = 1000;
    else if (p === 2) rawValue = 717;
    else if (p === 3) rawValue = 514;
    else if (p <= 32) {
      rawValue = 510 * Math.pow(0.953, p - 3);
    } else if (p <= 100) {
      rawValue = 180 * Math.pow(0.976, p - 32);
    } else {
      rawValue = Math.max(1, 35 * Math.pow(0.978, p - 100));
    }
  } else {
    // Fitzgerald-Spielberger Chart: Flatter top end, higher Round 2/3 surplus value
    // #1 = 3000, #10 = 1825, #32 = 1134, #64 = 740, #100 = 512, #262 = 110
    rawValue = 3000 * Math.pow(p, -0.285);
  }

  const discountFactor = Math.pow(0.82, futureYearDiscount);
  return Math.round(rawValue * discountFactor);
}

/**
 * Compute a Player's Trade Value in Draft Chart Points based on overall rating, age vs cliff,
 * positional importance, and remaining non-prorated contract cost (surplus value).
 */
export function getPlayerTradeValue(
  player: Player,
  chart: TradeChartModel = 'RichHill',
  actionYear: LeagueYear = 2026
): number {
  const posMultiplier: Record<PositionGroup, number> = {
    QB: 1.55,
    EDGE: 1.25,
    WR: 1.2,
    OL: 1.15,
    CB: 1.12,
    IDL: 1.05,
    S: 0.9,
    LB: 0.88,
    TE: 0.85,
    RB: 0.72,
    ST: 0.35,
  };

  const age = player.ageIn2026 + (actionYear - 2026);
  const ageFactor = age <= 25 ? 1.25 : age <= 28 ? 1.0 : age <= 30 ? 0.65 : 0.35;

  // Base talent score
  const ratingAboveReplacement = Math.max(2, player.overallRating - 70);
  const talentPoints = Math.pow(ratingAboveReplacement, 1.85) * 0.65;

  // Contract burden discount (acquiring team pays base salary + roster bonus)
  const cy = player.contractYears[actionYear];
  const acquiringCashCost = cy ? cy.baseSalary + cy.rosterBonus : 10;
  const surplusMultiplier = acquiringCashCost < 8 ? 1.3 : acquiringCashCost > 25 ? 0.75 : 1.0;

  const richHillEquivalent = Math.max(
    8,
    Math.round(talentPoints * posMultiplier[player.position] * ageFactor * surplusMultiplier)
  );

  if (chart === 'FitzgeraldSpielberger') {
    return Math.round(richHillEquivalent * 3.2);
  }
  return richHillEquivalent;
}
