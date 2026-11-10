import { getVeteranMinimumSalary, roundCap } from './constants';
import {
  ContractYear,
  DeadCapEntry,
  LEAGUE_YEARS,
  LeagueYear,
  Player,
} from './types';

/**
 * Compute single-year total cap hit for a ContractYear.
 */
export function getContractYearCapHit(cy: ContractYear | null | undefined): number {
  if (!cy) return 0;
  return roundCap(cy.baseSalary + cy.proratedBonus + cy.rosterBonus + cy.workoutBonus);
}

/**
 * Compute total cash paid in a single ContractYear (Base + Roster Bonus + Workout Bonus).
 */
export function getContractYearCash(cy: ContractYear | null | undefined): number {
  if (!cy || cy.isVoidYear) return 0;
  return roundCap(cy.baseSalary + cy.rosterBonus + cy.workoutBonus);
}

/**
 * Sum all remaining unamortized prorated bonus from `startYear` through 2029.
 */
export function getRemainingUnamortizedBonus(
  player: Player,
  startYear: LeagueYear
): number {
  let total = 0;
  for (const y of LEAGUE_YEARS) {
    if (y >= startYear) {
      const cy = player.contractYears[y];
      if (cy) {
        total += cy.proratedBonus;
      }
    }
  }
  return roundCap(total);
}

export interface CutOrTradeSimulationResult {
  actionType: 'PRE_JUNE_1_CUT' | 'POST_JUNE_1_CUT' | 'PRE_JUNE_1_TRADE' | 'POST_JUNE_1_TRADE';
  actionYear: LeagueYear;
  currentYearOriginalCapHit: number;
  currentYearDeadCap: number;
  currentYearCapSavings: number;
  nextYearDeadCap: number;
  nextYearOriginalCapHit: number;
  nextYearCapSavings: number;
  deadCapByYear: Record<LeagueYear, number>;
  savingsByYear: Record<LeagueYear, number>;
}

/**
 * Preview or execute a Pre-June 1 or Post-June 1 Cut / Trade for `player` in `actionYear`.
 *
 * CBA Rules:
 * - Pre-June 1 Cut:
 *   All remaining future `proratedBonus` (from actionYear..2029) accelerates immediately into `actionYear` Dead Money.
 *   Any `guaranteedSalary` in `actionYear` (and future years, if any) also stays as Dead Money in `actionYear`.
 * - Post-June 1 Cut:
 *   Only `actionYear`'s `proratedBonus` + `actionYear`'s `guaranteedSalary` remain on `actionYear` cap.
 *   All remaining future `proratedBonus` (actionYear+1..2029) accelerates into `actionYear + 1` Dead Money.
 * - Pre/Post-June 1 Trade:
 *   Acquiring team inherits base salaries (including guaranteed base salary) and future non-paid roster/workout bonuses.
 *   Original team only eats the unamortized `proratedBonus` (all in `actionYear` if Pre-June 1, or split between `actionYear` and `actionYear+1` if Post-June 1).
 */
export function simulateCutOrTrade(
  player: Player,
  actionYear: LeagueYear,
  mode: 'PRE_JUNE_1_CUT' | 'POST_JUNE_1_CUT' | 'PRE_JUNE_1_TRADE' | 'POST_JUNE_1_TRADE'
): CutOrTradeSimulationResult {
  const isTrade = mode === 'PRE_JUNE_1_TRADE' || mode === 'POST_JUNE_1_TRADE';
  const isPostJune1 = mode === 'POST_JUNE_1_CUT' || mode === 'POST_JUNE_1_TRADE';

  const cyCurrent = player.contractYears[actionYear];
  const currentYearOriginalCapHit = getContractYearCapHit(cyCurrent);

  const nextYear = (actionYear + 1) as LeagueYear;
  const hasNextYear = LEAGUE_YEARS.includes(nextYear);
  const nextYearOriginalCapHit = hasNextYear
    ? getContractYearCapHit(player.contractYears[nextYear])
    : 0;

  const currentYearProrated = cyCurrent ? cyCurrent.proratedBonus : 0;
  const futureProratedAfterActionYear = hasNextYear
    ? getRemainingUnamortizedBonus(player, nextYear)
    : 0;

  // Guaranteed base salary stays with original team on a Cut, but transfers on a Trade
  let guaranteedBaseRemaining = 0;
  if (!isTrade) {
    for (const y of LEAGUE_YEARS) {
      if (y >= actionYear) {
        const cy = player.contractYears[y];
        if (cy && !cy.isVoidYear) {
          guaranteedBaseRemaining += cy.guaranteedSalary;
        }
      }
    }
  }

  const deadCapByYear: Record<LeagueYear, number> = {
    2026: 0,
    2027: 0,
    2028: 0,
    2029: 0,
  };

  if (!isPostJune1) {
    // Pre-June 1: Everything accelerates into actionYear
    deadCapByYear[actionYear] = roundCap(
      currentYearProrated + futureProratedAfterActionYear + guaranteedBaseRemaining
    );
  } else {
    // Post-June 1: Current year proration + current year guaranteed base stays in actionYear;
    // Future proration accelerates into actionYear + 1
    const currentYearGuaranteed = !isTrade && cyCurrent ? cyCurrent.guaranteedSalary : 0;
    const futureGuaranteed = !isTrade
      ? Math.max(0, guaranteedBaseRemaining - currentYearGuaranteed)
      : 0;

    deadCapByYear[actionYear] = roundCap(currentYearProrated + currentYearGuaranteed);
    if (hasNextYear) {
      deadCapByYear[nextYear] = roundCap(futureProratedAfterActionYear + futureGuaranteed);
    }
  }

  const savingsByYear: Record<LeagueYear, number> = {
    2026: 0,
    2027: 0,
    2028: 0,
    2029: 0,
  };

  for (const y of LEAGUE_YEARS) {
    if (y >= actionYear) {
      const origHit = getContractYearCapHit(player.contractYears[y]);
      savingsByYear[y] = roundCap(origHit - deadCapByYear[y]);
    }
  }

  return {
    actionType: mode,
    actionYear,
    currentYearOriginalCapHit,
    currentYearDeadCap: deadCapByYear[actionYear],
    currentYearCapSavings: savingsByYear[actionYear],
    nextYearDeadCap: hasNextYear ? deadCapByYear[nextYear] : 0,
    nextYearOriginalCapHit,
    nextYearCapSavings: hasNextYear ? savingsByYear[nextYear] : 0,
    deadCapByYear,
    savingsByYear,
  };
}

/**
 * Apply a Cut or Outgoing Trade to a player, returning the DeadCapEntry and removing future contract years.
 */
export function applyPlayerReleaseOrTrade(
  player: Player,
  actionYear: LeagueYear,
  mode: 'PRE_JUNE_1_CUT' | 'POST_JUNE_1_CUT' | 'PRE_JUNE_1_TRADE' | 'POST_JUNE_1_TRADE',
  transactionId: string
): DeadCapEntry {
  const sim = simulateCutOrTrade(player, actionYear, mode);
  const reasonMap: Record<typeof mode, string> = {
    PRE_JUNE_1_CUT: 'Pre-June 1 Release',
    POST_JUNE_1_CUT: 'Post-June 1 Designation',
    PRE_JUNE_1_TRADE: 'Traded (Pre-June 1)',
    POST_JUNE_1_TRADE: 'Traded (Post-June 1)',
  };

  return {
    id: `dead-${transactionId}-${player.id}`,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    reason: reasonMap[mode],
    amountsByYear: sim.deadCapByYear,
  };
}

export interface RestructureSimulationResult {
  actionYear: LeagueYear;
  vetMinimumFloor: number;
  maxRestructurableSalary: number;
  convertedBonusAmount: number;
  prorationYearsCount: number;
  annualProrationAdded: number;
  currentYearCapSavings: number;
  updatedPlayer: Player;
  capDeltaByYear: Record<LeagueYear, number>;
}

/**
 * Restructure a player's contract in `actionYear`:
 * Converts `convertPercentage` (0.0 to 1.0) of restructurable baseSalary (above Veteran Minimum)
 * into a signing bonus and prorates it evenly across remaining contract years (plus optional void years,
 * up to the 2029 horizon or max 5 years).
 */
export function simulateRestructure(
  player: Player,
  actionYear: LeagueYear,
  convertPercentage: number,
  addVoidYears: number = 0
): RestructureSimulationResult {
  const cy = player.contractYears[actionYear];
  const vetMin = getVeteranMinimumSalary(player.accruedSeasons, actionYear);

  if (!cy || cy.isVoidYear || cy.baseSalary <= vetMin) {
    return {
      actionYear,
      vetMinimumFloor: vetMin,
      maxRestructurableSalary: 0,
      convertedBonusAmount: 0,
      prorationYearsCount: 1,
      annualProrationAdded: 0,
      currentYearCapSavings: 0,
      updatedPlayer: player,
      capDeltaByYear: { 2026: 0, 2027: 0, 2028: 0, 2029: 0 },
    };
  }

  const maxRestructurableSalary = roundCap(Math.max(0, cy.baseSalary - vetMin));
  const clampedPct = Math.min(1, Math.max(0, convertPercentage));
  const convertedBonusAmount = roundCap(maxRestructurableSalary * clampedPct);

  // Clone contractYears
  const newContractYears: Record<LeagueYear, ContractYear | null> = {
    2026: player.contractYears[2026] ? { ...player.contractYears[2026]! } : null,
    2027: player.contractYears[2027] ? { ...player.contractYears[2027]! } : null,
    2028: player.contractYears[2028] ? { ...player.contractYears[2028]! } : null,
    2029: player.contractYears[2029] ? { ...player.contractYears[2029]! } : null,
  };

  // Identify eligible proration years from actionYear..2029
  let voidYearsRemainingToAdd = addVoidYears;
  const prorationYears: LeagueYear[] = [];

  for (const y of LEAGUE_YEARS) {
    if (y >= actionYear) {
      if (newContractYears[y] !== null) {
        prorationYears.push(y);
      } else if (voidYearsRemainingToAdd > 0) {
        newContractYears[y] = {
          year: y,
          baseSalary: 0,
          guaranteedSalary: 0,
          proratedBonus: 0,
          rosterBonus: 0,
          workoutBonus: 0,
          isVoidYear: true,
        };
        prorationYears.push(y);
        voidYearsRemainingToAdd--;
      }
    }
  }

  // Ensure at least 2 proration years if possible within 2026-2029 when restructuring a 1-year deal
  if (prorationYears.length === 1) {
    const nextY = (actionYear + 1) as LeagueYear;
    if (LEAGUE_YEARS.includes(nextY) && !newContractYears[nextY]) {
      newContractYears[nextY] = {
        year: nextY,
        baseSalary: 0,
        guaranteedSalary: 0,
        proratedBonus: 0,
        rosterBonus: 0,
        workoutBonus: 0,
        isVoidYear: true,
      };
      prorationYears.push(nextY);
    }
  }

  const prorationYearsCount = prorationYears.length;
  const annualProrationAdded = roundCap(convertedBonusAmount / prorationYearsCount);

  // Update actionYear baseSalary
  const updatedCurrent = newContractYears[actionYear]!;
  updatedCurrent.baseSalary = roundCap(updatedCurrent.baseSalary - convertedBonusAmount);
  updatedCurrent.guaranteedSalary = roundCap(
    Math.min(updatedCurrent.baseSalary, updatedCurrent.guaranteedSalary)
  );

  // Add proration to each eligible year
  for (const y of prorationYears) {
    if (newContractYears[y]) {
      newContractYears[y]!.proratedBonus = roundCap(
        newContractYears[y]!.proratedBonus + annualProrationAdded
      );
    }
  }

  const capDeltaByYear: Record<LeagueYear, number> = {
    2026: 0,
    2027: 0,
    2028: 0,
    2029: 0,
  };

  for (const y of LEAGUE_YEARS) {
    const oldHit = getContractYearCapHit(player.contractYears[y]);
    const newHit = getContractYearCapHit(newContractYears[y]);
    capDeltaByYear[y] = roundCap(newHit - oldHit);
  }

  const currentYearCapSavings = roundCap(-capDeltaByYear[actionYear]);

  return {
    actionYear,
    vetMinimumFloor: vetMin,
    maxRestructurableSalary,
    convertedBonusAmount,
    prorationYearsCount,
    annualProrationAdded,
    currentYearCapSavings,
    updatedPlayer: {
      ...player,
      contractYears: newContractYears,
    },
    capDeltaByYear,
  };
}

// ============================================================================
// "Real Contract" X-Ray ("Headline Deal vs. Reality & Ghost Years")
// ============================================================================

export interface RealContractXRay {
  headlineYears: number;
  headlineTotalCap: number;
  headlineApy: number;
  realisticYears: number;
  realisticPracticalMoney: number;
  firstCleanExitYear: LeagueYear | null;
  exitNetCapSavings: number;
  exitDeadCap: number;
  voidYearsCount: number;
  voidGhostBillTotal: number;
  hasFakeBackEnd: boolean;
  verdictLabel: string;
}

/**
 * Computes the "Real Contract" X-Ray for any player on a 2026–2029 ledger:
 * Distinguishes agent-reported headline length/value from the realistic practical
 * structure (where cutting the player saves substantial cap space over dead money)
 * and totals any "Ghost Year" (Void Year) bonus bills.
 */
export function computeRealContractXRay(player: Player): RealContractXRay {
  const activeYears: LeagueYear[] = [];
  const voidYears: LeagueYear[] = [];
  let headlineTotalCap = 0;
  let voidGhostBillTotal = 0;

  for (const y of LEAGUE_YEARS) {
    const cy = player.contractYears[y];
    if (cy) {
      if (cy.isVoidYear) {
        voidYears.push(y);
        voidGhostBillTotal += cy.proratedBonus;
      } else {
        activeYears.push(y);
        headlineTotalCap += getContractYearCapHit(cy);
      }
    }
  }

  headlineTotalCap = roundCap(headlineTotalCap);
  voidGhostBillTotal = roundCap(voidGhostBillTotal);
  const headlineYears = Math.max(1, activeYears.length);
  const headlineApy = roundCap(headlineTotalCap / headlineYears);

  // Determine the first year where the team can cleanly exit the deal
  // (Pre-June 1 cut savings >= $4.0M and savings >= dead cap, or unguaranteed balloon year)
  let firstCleanExitYear: LeagueYear | null = null;
  let exitNetCapSavings = 0;
  let exitDeadCap = 0;

  for (const y of activeYears) {
    const preCut = simulateCutOrTrade(player, y, 'PRE_JUNE_1_CUT');
    const postCut = simulateCutOrTrade(player, y, 'POST_JUNE_1_CUT');
    const cy = player.contractYears[y]!;

    // A year is a realistic team exit window if guaranteedSalary == 0 and cutting saves >= $4M
    if (
      cy.guaranteedSalary === 0 &&
      (preCut.currentYearCapSavings >= 4.0 ||
        (y > 2026 && postCut.currentYearCapSavings >= 6.0))
    ) {
      firstCleanExitYear = y;
      exitNetCapSavings = Math.max(
        preCut.currentYearCapSavings,
        postCut.currentYearCapSavings
      );
      exitDeadCap = preCut.currentYearDeadCap;
      break;
    }
  }

  const realisticActiveYears = firstCleanExitYear
    ? activeYears.filter((y) => y < firstCleanExitYear)
    : activeYears;

  const realisticYears = Math.max(1, realisticActiveYears.length);
  let realisticPracticalMoney = 0;

  for (const y of realisticActiveYears) {
    const cy = player.contractYears[y];
    if (cy) {
      realisticPracticalMoney += getContractYearCapHit(cy);
    }
  }
  realisticPracticalMoney = roundCap(realisticPracticalMoney);

  const hasFakeBackEnd =
    firstCleanExitYear !== null && realisticYears < headlineYears;

  let verdictLabel = '';
  if (hasFakeBackEnd && firstCleanExitYear) {
    verdictLabel = `Really a ${realisticYears}-yr, $${realisticPracticalMoney.toFixed(1)}M deal · Team exit in ${firstCleanExitYear} saves +$${exitNetCapSavings.toFixed(1)}M`;
  } else if (voidYears.length > 0) {
    verdictLabel = `${headlineYears}-yr locked deal + ${voidYears.length} Ghost Yr${voidYears.length > 1 ? 's' : ''} ($${voidGhostBillTotal.toFixed(1)}M deferred bill)`;
  } else {
    verdictLabel = `True ${headlineYears}-yr, $${headlineTotalCap.toFixed(1)}M structure (no fake back-end years)`;
  }

  return {
    headlineYears,
    headlineTotalCap,
    headlineApy,
    realisticYears,
    realisticPracticalMoney,
    firstCleanExitYear,
    exitNetCapSavings: roundCap(exitNetCapSavings),
    exitDeadCap: roundCap(exitDeadCap),
    voidYearsCount: voidYears.length,
    voidGhostBillTotal,
    hasFakeBackEnd,
    verdictLabel,
  };
}
