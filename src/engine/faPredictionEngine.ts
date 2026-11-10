import { POSITIONAL_AGING_CURVES, roundCap } from './constants';
import { evaluatePlayerLongevity } from './agingEngine';
import {
  getContractYearCapHit,
  simulateCutOrTrade,
  simulateRestructure,
} from './contractEngine';
import {
  DerivedTeamCapState,
  FreeAgentOriginType,
  FreeAgentTarget,
  LEAGUE_YEARS,
  LeagueYear,
  Player,
  PositionGroup,
  PredictedMarketClassification,
} from './types';

/**
 * Deterministic NFL Free Agent Availability & Cap Casualty Prediction Engine (`faPredictionEngine.ts`).
 *
 * Solves the biggest blind spot in traditional salary cap sites:
 * 1. Half of the "top upcoming free agents" on expiring contracts never actually reach March free agency
 *    because they get Franchise Tagged or Extended in-house.
 * 2. Half of the best actual signings in March aren't on expiring contracts at all — they are
 *    "Cap Casualties" (Street Free Agents) cut by cap-strapped teams in late February / early March,
 *    who ALSO carry the massive bonus of NOT counting against the Compensatory Pick formula!
 */

export interface MarketAvailabilityPrediction {
  classification: PredictedMarketClassification;
  classificationBadge: string;
  availabilityProbability: number;      // 0 to 100 (%)
  countsTowardCompFormula: boolean;     // True for standard UFA; False for Street FA (Cap Casualty)
  compPickImpactLabel: string;
  primaryDrivers: string[];
}

export interface PredictionCandidateInput {
  name: string;
  position: PositionGroup;
  age: number;
  overallRating: number;
  marketApy: number;
  originType: FreeAgentOriginType;
  incumbentTeamCapSpace: number;        // $M (negative means over the cap)
  scheduledCapHit: number;              // $M
  netCutSavings: number;                // $M
  deadCapOnCut: number;                 // $M
  franchiseTagCost: number;             // $M
  priorTagsCount: number;               // 0, 1, or 2
  hasPositionalSuccessorOrBlock: boolean;
}

/**
 * Core deterministic prediction model that evaluates whether a player will actually hit
 * the open market (and via what mechanism: UFA, Street FA Cap Casualty, Trade/Release, or Tag/Extend).
 */
export function predictMarketAvailability(
  input: PredictionCandidateInput
): MarketAvailabilityPrediction {
  const curve = POSITIONAL_AGING_CURVES[input.position];
  const yearsFromCliff = input.age - curve.cliffAge; // >= 0 means at or past positional age cliff
  const drivers: string[] = [];

  // ==========================================================================
  // CASE A: Player is CURRENTLY UNDER CONTRACT (`UNDER_CONTRACT_VETERAN`)
  // Evaluate Cap Casualty (Street FA) vs Trade-or-Release vs Safe Roster Lock
  // ==========================================================================
  if (input.originType === 'UNDER_CONTRACT_VETERAN') {
    const savingsToHitRatio =
      input.scheduledCapHit > 0 ? input.netCutSavings / input.scheduledCapHit : 0;
    const savingsToDeadRatio =
      input.deadCapOnCut > 0
        ? input.netCutSavings / input.deadCapOnCut
        : input.netCutSavings > 0
        ? 5.0
        : 0;

    let cutScore = 15; // Base probability of release

    // 1. Net Cap Savings Magnitude
    if (input.netCutSavings >= 15.0) {
      cutScore += 32;
      drivers.push(`Massive $${input.netCutSavings.toFixed(1)}M net cap savings if released`);
    } else if (input.netCutSavings >= 8.5) {
      cutScore += 22;
      drivers.push(`Unlocks $${input.netCutSavings.toFixed(1)}M in immediate cap relief`);
    } else if (input.netCutSavings >= 4.5) {
      cutScore += 10;
    } else {
      cutScore -= 30;
      drivers.push(`Low net savings ($${input.netCutSavings.toFixed(1)}M) relative to $${input.deadCapOnCut.toFixed(1)}M dead cap`);
    }

    // 2. Incumbent Team Cap Pressure
    if (input.incumbentTeamCapSpace < -15.0) {
      cutScore += 22;
      drivers.push(`Incumbent club is $${Math.abs(input.incumbentTeamCapSpace).toFixed(1)}M over the cap`);
    } else if (input.incumbentTeamCapSpace < 10.0) {
      cutScore += 12;
      drivers.push(`Incumbent team faces tight cap squeeze ($${input.incumbentTeamCapSpace.toFixed(1)}M space)`);
    } else if (input.incumbentTeamCapSpace > 45.0) {
      // Even wealthy teams cut older non-guaranteed veterans if cash >> market value
      if (yearsFromCliff >= 0 && input.netCutSavings >= 10.0) {
        cutScore += 14;
        drivers.push(`Unguaranteed $${input.netCutSavings.toFixed(1)}M cash exceeds post-cliff valuation`);
      }
    }

    // 3. Positional Age Cliff & Contract Surplus Gap
    if (yearsFromCliff >= 1) {
      cutScore += 22;
      drivers.push(`Age ${input.age} is past ${input.position} cliff (${curve.cliffAge})`);
    } else if (yearsFromCliff === 0) {
      cutScore += 15;
      drivers.push(`Touching ${input.position} age-${curve.cliffAge} cliff with high scheduled cap hit ($${input.scheduledCapHit.toFixed(1)}M)`);
    } else if (yearsFromCliff <= -2 && input.overallRating >= 88) {
      cutScore -= 35;
      drivers.push(`Prime ${input.age}-yr-old cornerstone (${input.overallRating} OVR) — restructure candidate, not cut`);
    }

    // 4. Clean out ratio (high savings vs dead cap)
    if (savingsToHitRatio >= 0.65 && savingsToDeadRatio >= 1.5) {
      cutScore += 12;
    }

    // 5. Positional block or successor drafted
    if (input.hasPositionalSuccessorOrBlock) {
      cutScore += 12;
      drivers.push(`Incumbent roster already has younger replacement / heavy spend at ${input.position}`);
    }

    const probability = Math.max(5, Math.min(95, Math.round(cutScore)));

    // Distinguish between outright Street FA Cut vs Trade-or-Release Bridge candidate
    if (probability >= 55 && input.overallRating >= 87 && yearsFromCliff <= 1) {
      return {
        classification: 'TRADE_OR_RELEASE_BRIDGE',
        classificationBadge: 'Trade / Cap Casualty Target',
        availabilityProbability: probability,
        countsTowardCompFormula: false,
        compPickImpactLabel: 'Comp-Pick Safe (Cut or Trade)',
        primaryDrivers: drivers.slice(0, 3),
      };
    }

    if (probability >= 55) {
      return {
        classification: 'CAP_CASUALTY_STREET_FA',
        classificationBadge: 'Projected Cap Casualty (Street FA)',
        availabilityProbability: probability,
        countsTowardCompFormula: false,
        compPickImpactLabel: 'Comp-Pick Safe (Street FA)',
        primaryDrivers: drivers.slice(0, 3),
      };
    }

    return {
      classification: 'TAG_OR_EXTEND_TRAP',
      classificationBadge: 'Likely Retained / Restructured',
      availabilityProbability: probability,
      countsTowardCompFormula: false,
      compPickImpactLabel: 'Under Contract',
      primaryDrivers: drivers.slice(0, 3),
    };
  }

  // ==========================================================================
  // CASE B: Player is on an EXPIRING CONTRACT (`EXPIRING_CONTRACT`)
  // Evaluate Likely UFA Walk vs Franchise Tag / In-House Extension Trap
  // ==========================================================================
  let walkScore = 50; // Base 50% open-market probability

  // 1. Franchise Tag Economics (Tag Cost vs Market APY)
  const tagPremiumOverMarket = input.franchiseTagCost - input.marketApy;

  if (input.priorTagsCount >= 2) {
    walkScore += 35;
    drivers.push(`3rd Franchise Tag triggers prohibitive 144% CBA escalator`);
  } else if (input.priorTagsCount === 1) {
    walkScore += 18;
    drivers.push(`2nd Franchise Tag requires 120% cash commitment ($${input.franchiseTagCost.toFixed(1)}M)`);
  } else if (tagPremiumOverMarket >= 4.0) {
    // Tag is much more expensive than player's actual market APY (common for RBs, TEs, Safeties, non-elite OL/LB)
    walkScore += 22;
    drivers.push(`${input.position} Franchise Tag ($${input.franchiseTagCost.toFixed(1)}M) exceeds $${input.marketApy.toFixed(1)}M market APY`);
  } else if (tagPremiumOverMarket <= -2.5 && yearsFromCliff <= -2 && input.overallRating >= 90) {
    // Franchise tag is a bargain compared to market APY for an elite young player!
    walkScore -= 32;
    drivers.push(`Prime ${input.age}-yr-old star where Franchise Tag ($${input.franchiseTagCost.toFixed(1)}M) is below market APY`);
  }

  // 2. Incumbent Team Cap Space & Positional Allocation Block
  if (input.incumbentTeamCapSpace < 5.0) {
    walkScore += 20;
    drivers.push(`Incumbent club lacks cap room ($${input.incumbentTeamCapSpace.toFixed(1)}M) to absorb $${input.franchiseTagCost.toFixed(1)}M tag`);
  } else if (input.incumbentTeamCapSpace > 45.0 && yearsFromCliff < 0 && input.overallRating >= 88) {
    walkScore -= 24;
    drivers.push(`Incumbent team holds $${input.incumbentTeamCapSpace.toFixed(1)}M cap space to lock up in-house core`);
  }

  if (input.hasPositionalSuccessorOrBlock) {
    walkScore += 20;
    drivers.push(`Incumbent already committed top-of-market cap at ${input.position}`);
  }

  // 3. Age vs Positional Cliff
  if (yearsFromCliff >= 0) {
    walkScore += 18;
    drivers.push(`Age ${input.age} touches ${input.position} cliff (${curve.cliffAge}) — incumbent reluctant on 4-yr guarantees`);
  } else if (yearsFromCliff <= -3 && input.overallRating >= 91 && !input.hasPositionalSuccessorOrBlock) {
    walkScore -= 25;
    drivers.push(`25-and-under cornerstone (${input.overallRating} OVR) rarely allowed to walk without tag-and-trade`);
  }

  const probability = Math.max(8, Math.min(94, Math.round(walkScore)));

  if (probability >= 55) {
    return {
      classification: 'LIKELY_UFA',
      classificationBadge: 'Likely Open-Market UFA',
      availabilityProbability: probability,
      countsTowardCompFormula: true,
      compPickImpactLabel: 'CFA Qualifying (Counts Against Comp Pick)',
      primaryDrivers: drivers.slice(0, 3),
    };
  }

  return {
    classification: 'TAG_OR_EXTEND_TRAP',
    classificationBadge: 'High Tag / Re-Sign Risk',
    availabilityProbability: probability,
    countsTowardCompFormula: true,
    compPickImpactLabel: 'Unlikely to Reach Market Unprotected',
    primaryDrivers: drivers.slice(0, 3),
  };
}

/**
 * Helper to evaluate a `FreeAgentTarget` directly from the seed pool.
 */
export function evaluateFreeAgentTarget(fa: FreeAgentTarget): MarketAvailabilityPrediction {
  return predictMarketAvailability({
    name: fa.name,
    position: fa.position,
    age: fa.ageIn2026,
    overallRating: fa.overallRating,
    marketApy: fa.marketApy,
    originType: fa.predictionFeatures.originType,
    incumbentTeamCapSpace: fa.predictionFeatures.incumbentTeamCapSpace,
    scheduledCapHit: fa.predictionFeatures.scheduledCapHit,
    netCutSavings: fa.predictionFeatures.netCutSavings,
    deadCapOnCut: fa.predictionFeatures.deadCapOnCut,
    franchiseTagCost: fa.predictionFeatures.franchiseTagCost,
    priorTagsCount: fa.predictionFeatures.priorTagsCount,
    hasPositionalSuccessorOrBlock: fa.predictionFeatures.hasPositionalSuccessorOrBlock,
  });
}

/**
 * Scan any `TeamSeedData` roster in `actionYear` to automatically surface in-house
 * Cap Casualty candidates and Tag/Extension candidates.
 */
export interface RosterCapCasualtyScanItem {
  player: Player;
  scheduledCapHit: number;
  preJuneSavings: number;
  postJuneSavings: number;
  deadCapPreJune: number;
  prediction: MarketAvailabilityPrediction;
}

export function scanRosterForCapCasualties(
  roster: Player[],
  teamEffectiveCapSpace: number,
  actionYear: LeagueYear = 2026
): RosterCapCasualtyScanItem[] {
  const results: RosterCapCasualtyScanItem[] = [];

  for (const player of roster) {
    const cy = player.contractYears[actionYear];
    if (!cy || cy.isVoidYear) continue;

    const scheduledCapHit = getContractYearCapHit(cy);
    if (scheduledCapHit < 4.5) continue;

    const preSim = simulateCutOrTrade(player, actionYear, 'PRE_JUNE_1_CUT');
    const postSim = simulateCutOrTrade(player, actionYear, 'POST_JUNE_1_CUT');
    const bestSavings = Math.max(preSim.currentYearCapSavings, postSim.currentYearCapSavings);

    const pred = predictMarketAvailability({
      name: player.name,
      position: player.position,
      age: player.ageIn2026 + (actionYear - 2026),
      overallRating: player.overallRating,
      marketApy: roundCap(scheduledCapHit * 0.8),
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: teamEffectiveCapSpace,
      scheduledCapHit,
      netCutSavings: bestSavings,
      deadCapOnCut: preSim.currentYearDeadCap,
      franchiseTagCost: 22.0,
      priorTagsCount: player.priorTagsCount ?? 0,
      hasPositionalSuccessorOrBlock: false,
    });

    if (bestSavings >= 4.0) {
      results.push({
        player,
        scheduledCapHit,
        preJuneSavings: preSim.currentYearCapSavings,
        postJuneSavings: postSim.currentYearCapSavings,
        deadCapPreJune: preSim.currentYearDeadCap,
        prediction: pred,
      });
    }
  }

  return results.sort(
    (a, b) =>
      b.prediction.availabilityProbability - a.prediction.availabilityProbability ||
      b.postJuneSavings - a.postJuneSavings
  );
}

// ============================================================================
// Player Fate Forecast ("Will my favorite player get extended, restructured, or let go?")
// ============================================================================

export type PlayerFateCategory =
  | 'CORNERSTONE_LOCK'
  | 'RESTRUCTURE_PILLAR'
  | 'PRIME_EXTENSION'
  | 'TAG_OR_TENDER'
  | 'CAP_CASUALTY_RISK'
  | 'WALK_CANDIDATE';

export interface PlayerFateForecast {
  fate: PlayerFateCategory;
  badgeLabel: string;
  shortActionLabel: string;
  recommendedActionTab: 'restructure' | 'cut' | 'extend' | 'trade';
  stayProbability: number; // 0-100% chance player remains on the team
  maxRestructureSavings2026: number;
  bestCutSavings2026: number;
  bestCutSavings2027: number;
  projectedMarketApy: number;
  rationale: string;
}

export function evaluateRosterPlayerFate(
  player: Player,
  teamCapSpace2026: number = 15.0
): PlayerFateForecast {
  const longevity = evaluatePlayerLongevity(player);
  const curve = POSITIONAL_AGING_CURVES[player.position];
  const cy2026 = player.contractYears[2026];
  const cy2027 = player.contractYears[2027];
  const hit2026 = getContractYearCapHit(cy2026);
  const hit2027 = getContractYearCapHit(cy2027);

  const restructure2026 = simulateRestructure(player, 2026, 1.0, 1);
  const preCut2026 = simulateCutOrTrade(player, 2026, 'PRE_JUNE_1_CUT');
  const postCut2026 = simulateCutOrTrade(player, 2026, 'POST_JUNE_1_CUT');
  const bestCutSavings2026 = roundCap(
    Math.max(preCut2026.currentYearCapSavings, postCut2026.currentYearCapSavings)
  );

  const preCut2027 = simulateCutOrTrade(player, 2027, 'PRE_JUNE_1_CUT');
  const postCut2027 = simulateCutOrTrade(player, 2027, 'POST_JUNE_1_CUT');
  const bestCutSavings2027 = roundCap(
    Math.max(preCut2027.currentYearCapSavings, postCut2027.currentYearCapSavings)
  );

  const isExpiringAfter2026 = !cy2027 || cy2027.isVoidYear;
  const isExpiringAfter2027 =
    !isExpiringAfter2026 &&
    (!player.contractYears[2028] || player.contractYears[2028]?.isVoidYear);

  const projectedMarketApy = roundCap(
    Math.max(4.5, Math.max(hit2026 * 0.9, (player.overallRating - 68) * 1.15))
  );

  // 1. Check for high Cap Casualty / Release Risk in 2026
  const yearsFromCliff = player.ageIn2026 - curve.cliffAge;
  if (
    bestCutSavings2026 >= 5.5 &&
    ((yearsFromCliff >= 0 && preCut2026.currentYearCapSavings >= 4.0) ||
      (bestCutSavings2026 >= 10.0 && player.overallRating <= 85) ||
      (teamCapSpace2026 < 8.0 && bestCutSavings2026 >= 7.5 && player.overallRating < 89))
  ) {
    const stayProb = Math.max(18, Math.min(48, 55 - Math.round(bestCutSavings2026 * 1.5)));
    return {
      fate: 'CAP_CASUALTY_RISK',
      badgeLabel: `Cut Watch (${100 - stayProb}% Let Go)`,
      shortActionLabel: `Cut Saves +$${bestCutSavings2026.toFixed(1)}M`,
      recommendedActionTab: 'cut',
      stayProbability: stayProb,
      maxRestructureSavings2026: restructure2026.currentYearCapSavings,
      bestCutSavings2026,
      bestCutSavings2027,
      projectedMarketApy,
      rationale: `Carries a $${hit2026.toFixed(1)}M cap hit at Age ${player.ageIn2026} (cliff @${curve.cliffAge}); releasing unlocks +$${bestCutSavings2026.toFixed(1)}M in 2026 cap space.`,
    };
  }

  // 2. Expiring after 2026: Extension Priority vs Tag vs Walk Candidate
  if (isExpiringAfter2026) {
    if (yearsFromCliff >= 0 || longevity.postContractViableYears === 0) {
      return {
        fate: 'WALK_CANDIDATE',
        badgeLabel: 'UFA Walk Risk (72% Let Go)',
        shortActionLabel: 'Expiring @ Age Cliff',
        recommendedActionTab: 'extend',
        stayProbability: 28,
        maxRestructureSavings2026: restructure2026.currentYearCapSavings,
        bestCutSavings2026,
        bestCutSavings2027,
        projectedMarketApy,
        rationale: `Contract expires after 2026 at Age ${player.ageIn2026 + 1} (${player.position} cliff @${curve.cliffAge}) — front office likely lets contract expire for Comp Pick value.`,
      };
    }

    if (player.overallRating >= 84 || longevity.postContractViableYears >= 2) {
      return {
        fate: 'PRIME_EXTENSION',
        badgeLabel: 'Prime Extension (86% Re-Sign)',
        shortActionLabel: `Extend (~$${projectedMarketApy.toFixed(1)}M/yr)`,
        recommendedActionTab: 'extend',
        stayProbability: 86,
        maxRestructureSavings2026: restructure2026.currentYearCapSavings,
        bestCutSavings2026,
        bestCutSavings2027,
        projectedMarketApy,
        rationale: `Entering final contract year with +${longevity.postContractViableYears} prime starter seasons before Age-${curve.cliffAge} cliff; prime candidate for a multi-year extension (~$${projectedMarketApy.toFixed(1)}M/yr).`,
      };
    }

    return {
      fate: 'TAG_OR_TENDER',
      badgeLabel: 'Expiring Starter (55% Re-Sign)',
      shortActionLabel: `Extend (~$${projectedMarketApy.toFixed(1)}M/yr)`,
      recommendedActionTab: 'extend',
      stayProbability: 55,
      maxRestructureSavings2026: restructure2026.currentYearCapSavings,
      bestCutSavings2026,
      bestCutSavings2027,
      projectedMarketApy,
      rationale: `Unsigned for 2027; candidate for a short-term bridge extension or open-market test depending on draft replacements.`,
    };
  }

  // 3. Under contract through 2027+ with high 2026 base salary: Prime Restructure Lever
  if (restructure2026.currentYearCapSavings >= 4.0) {
    return {
      fate: 'RESTRUCTURE_PILLAR',
      badgeLabel: 'Restructure Lever (94% Stay)',
      shortActionLabel: `Restructure +$${restructure2026.currentYearCapSavings.toFixed(1)}M`,
      recommendedActionTab: 'restructure',
      stayProbability: 94,
      maxRestructureSavings2026: restructure2026.currentYearCapSavings,
      bestCutSavings2026,
      bestCutSavings2027,
      projectedMarketApy,
      rationale: `Core pillar with $${(cy2026?.baseSalary ?? 0).toFixed(1)}M base salary in 2026; converting base to bonus immediately clears +$${restructure2026.currentYearCapSavings.toFixed(1)}M in 2026 cap room.`,
    };
  }

  // 4. Expiring after 2027 & high-end young player: Early Extension Window
  if (
    isExpiringAfter2027 &&
    longevity.postContractViableYears >= 2 &&
    player.overallRating >= 85
  ) {
    return {
      fate: 'PRIME_EXTENSION',
      badgeLabel: 'Early Extension Window (90% Stay)',
      shortActionLabel: `Extend (~$${projectedMarketApy.toFixed(1)}M/yr)`,
      recommendedActionTab: 'extend',
      stayProbability: 90,
      maxRestructureSavings2026: restructure2026.currentYearCapSavings,
      bestCutSavings2026,
      bestCutSavings2027,
      projectedMarketApy,
      rationale: `Entering extension-eligible window with +${longevity.postContractViableYears} prime seasons ahead of Age-${curve.cliffAge} cliff; locking in now beats 2027 cap inflation.`,
    };
  }

  // 5. Default: Protected Cornerstone / Cost-Controlled Lock
  return {
    fate: 'CORNERSTONE_LOCK',
    badgeLabel: player.isRookieContract
      ? 'Rookie Deal Lock (98% Stay)'
      : 'Roster Lock (92% Stay)',
    shortActionLabel:
      bestCutSavings2027 >= 8.0
        ? `'27 Cut Watch (+$${bestCutSavings2027.toFixed(1)}M)`
        : 'Protected Deal',
    recommendedActionTab:
      restructure2026.currentYearCapSavings >= 1.5 ? 'restructure' : 'extend',
    stayProbability: player.isRookieContract ? 98 : 92,
    maxRestructureSavings2026: restructure2026.currentYearCapSavings,
    bestCutSavings2026,
    bestCutSavings2027,
    projectedMarketApy,
    rationale: player.isRookieContract
      ? `Cost-controlled rookie contract ($${hit2026.toFixed(2)}M hit in 2026) providing elite surplus value.`
      : `Protected multi-year deal ($${preCut2026.currentYearDeadCap.toFixed(1)}M dead cap if cut in 2026 vs $${hit2026.toFixed(1)}M cap hit).`,
  };
}

// ============================================================================
// Team Cap Health & Offseason Executive Brief
// ("Is my team in a cap crunch or do they have lots of space?")
// ============================================================================

export type TeamCapHealthTier =
  | 'SEVERE_CRUNCH'
  | 'TIGHT_SQUEEZE'
  | 'HEALTHY_FLEXIBLE'
  | 'CAP_WARCHEST';

export interface TeamCapHealthDiagnostic {
  tier: TeamCapHealthTier;
  tierLabel: string;
  headlineAnswer: string;
  subheadlineAnswer: string;
  maxTop3RestructurePower: number;
  maxTop3CutRelief: number;
  cleanBooksYear: LeagueYear;
  cleanBooksNote: string;
  roomWeCouldCreate: {
    restructuresOnly: number;
    cutsOnly: number;
    combinedMaxFlex: number;
  };
  secondContractWall: {
    player: Player;
    decisionYear: LeagueYear;
    projectedMarketApy: number;
    note: string;
  }[];
  topRestructureLevers: { player: Player; forecast: PlayerFateForecast }[];
  topExtensionCandidates: { player: Player; forecast: PlayerFateForecast }[];
  topCutWatchCandidates: { player: Player; forecast: PlayerFateForecast }[];
}

export function evaluateTeamCapHealth(
  derivedState: DerivedTeamCapState
): TeamCapHealthDiagnostic {
  const space2026 = derivedState.years[2026].effectiveCapSpace;
  const space2027 = derivedState.years[2027].effectiveCapSpace;

  const evaluated = derivedState.roster.map((player) => ({
    player,
    forecast: evaluateRosterPlayerFate(player, space2026),
  }));

  const allRestructurable = [...evaluated]
    .filter((x) => x.forecast.maxRestructureSavings2026 >= 1.5)
    .sort(
      (a, b) =>
        b.forecast.maxRestructureSavings2026 - a.forecast.maxRestructureSavings2026
    );

  const topRestructureLevers = allRestructurable.slice(0, 3);

  const maxTop3RestructurePower = roundCap(
    topRestructureLevers.reduce(
      (acc, x) => acc + x.forecast.maxRestructureSavings2026,
      0
    )
  );

  const restructuresOnlyTotal = roundCap(
    allRestructurable
      .slice(0, 6)
      .reduce((acc, x) => acc + x.forecast.maxRestructureSavings2026, 0)
  );

  const topExtensionCandidates = [...evaluated]
    .filter(
      (x) =>
        x.forecast.fate === 'PRIME_EXTENSION' ||
        x.forecast.fate === 'TAG_OR_TENDER'
    )
    .sort((a, b) => b.player.overallRating - a.player.overallRating)
    .slice(0, 3);

  const allCutCandidates = [...evaluated]
    .filter(
      (x) =>
        x.forecast.fate === 'CAP_CASUALTY_RISK' ||
        x.forecast.fate === 'WALK_CANDIDATE' ||
        x.forecast.bestCutSavings2026 >= 4.0
    )
    .sort((a, b) => b.forecast.bestCutSavings2026 - a.forecast.bestCutSavings2026);

  const topCutWatchCandidates = allCutCandidates.slice(0, 3);

  const maxTop3CutRelief = roundCap(
    topCutWatchCandidates.reduce(
      (acc, x) => acc + Math.max(0, x.forecast.bestCutSavings2026),
      0
    )
  );

  const cutsOnlyTotal = roundCap(
    allCutCandidates
      .slice(0, 5)
      .reduce((acc, x) => acc + Math.max(0, x.forecast.bestCutSavings2026), 0)
  );

  // Avoid double-counting any player who is in both lists
  const cutIds = new Set(allCutCandidates.slice(0, 4).map((x) => x.player.id));
  const nonOverlappingRestructures = allRestructurable
    .filter((x) => !cutIds.has(x.player.id))
    .slice(0, 5)
    .reduce((acc, x) => acc + x.forecast.maxRestructureSavings2026, 0);

  const combinedMaxFlex = roundCap(cutsOnlyTotal + nonOverlappingRestructures);

  // Determine "Clean Books Year" (first season dead money < 5% of cap & effective space >= $20M)
  let cleanBooksYear: LeagueYear = 2028;
  for (const yr of [2026, 2027, 2028, 2029] as LeagueYear[]) {
    const yData = derivedState.years[yr];
    const deadShare = yData.deadMoneyTotal / Math.max(1, yData.adjustedCapCeiling);
    if (deadShare <= 0.05 && yData.effectiveCapSpace >= 20.0) {
      cleanBooksYear = yr;
      break;
    }
  }
  const cleanYrData = derivedState.years[cleanBooksYear];
  const cleanBooksNote =
    cleanBooksYear === 2026
      ? `Books are clean now ($${cleanYrData.deadMoneyTotal.toFixed(1)}M dead cap, +$${cleanYrData.effectiveCapSpace.toFixed(1)}M Spendable Now).`
      : `Books clear in ${cleanBooksYear} (+$${cleanYrData.effectiveCapSpace.toFixed(1)}M projected space, $${cleanYrData.deadMoneyTotal.toFixed(1)}M dead money).`;

  // Compute "Second-Contract Wall" (Young core / rookie deals hitting paydays in 2027–2028)
  const secondContractWall = evaluated
    .filter(({ player }) => {
      const isYoungCore =
        player.isRookieContract || (player.ageIn2026 <= 25 && player.overallRating >= 78);
      if (!isYoungCore) return false;
      const expAfter26 = !player.contractYears[2027] || player.contractYears[2027]?.isVoidYear;
      const expAfter27 =
        !expAfter26 &&
        (!player.contractYears[2028] || player.contractYears[2028]?.isVoidYear);
      return expAfter26 || expAfter27;
    })
    .sort((a, b) => b.player.overallRating - a.player.overallRating)
    .slice(0, 3)
    .map(({ player, forecast }) => {
      const expAfter26 = !player.contractYears[2027] || player.contractYears[2027]?.isVoidYear;
      const decisionYear: LeagueYear = expAfter26 ? 2027 : 2028;
      return {
        player,
        decisionYear,
        projectedMarketApy: forecast.projectedMarketApy,
        note:
          player.draftRound === 1 && !player.fifthYearOptionExercised
            ? `5th-Yr Option or ~${forecast.projectedMarketApy.toFixed(1)}M/yr extension by ${decisionYear}`
            : `Hits market in ${decisionYear} (~$${forecast.projectedMarketApy.toFixed(1)}M/yr)`,
      };
    });

  let tier: TeamCapHealthTier = 'HEALTHY_FLEXIBLE';
  let tierLabel = 'Healthy Cap Flexibility';
  let headlineAnswer = '';

  if (space2026 < 5.0 || space2027 < 0) {
    tier = 'SEVERE_CRUNCH';
    tierLabel = 'Cap Crunch — Restructuring Required';
    headlineAnswer =
      space2026 < 0
        ? `${derivedState.teamName} are $${Math.abs(space2026).toFixed(1)}M OVER the 2026 cap.`
        : `${derivedState.teamName} are in a tight cap crunch ($${space2026.toFixed(1)}M space in '26, ${space2027 < 0 ? `-$${Math.abs(space2027).toFixed(1)}M` : `+$${space2027.toFixed(1)}M`} in '27).`;
  } else if (space2026 < 18.0) {
    tier = 'TIGHT_SQUEEZE';
    tierLabel = 'Tight Contender Window';
    headlineAnswer = `${derivedState.teamName} have limited baseline room ($${space2026.toFixed(1)}M in 2026), but hold +$${maxTop3RestructurePower.toFixed(1)}M in restructure power.`;
  } else if (space2026 >= 38.0) {
    tier = 'CAP_WARCHEST';
    tierLabel = 'Open Cap Warchest';
    headlineAnswer = `${derivedState.teamName} hold a massive $${space2026.toFixed(1)}M warchest in 2026 (+$${space2027.toFixed(1)}M projected in 2027).`;
  } else {
    tier = 'HEALTHY_FLEXIBLE';
    tierLabel = 'Balanced Cap Space';
    headlineAnswer = `${derivedState.teamName} have a healthy $${space2026.toFixed(1)}M in 2026 cap space with +$${maxTop3RestructurePower.toFixed(1)}M in optional restructure levers.`;
  }

  const subheadlineAnswer = `You can immediately unlock +$${maxTop3RestructurePower.toFixed(1)}M via Top-3 Simple Restructures or clear +$${maxTop3CutRelief.toFixed(1)}M via veteran releases.`;

  return {
    tier,
    tierLabel,
    headlineAnswer,
    subheadlineAnswer,
    maxTop3RestructurePower,
    maxTop3CutRelief,
    cleanBooksYear,
    cleanBooksNote,
    roomWeCouldCreate: {
      restructuresOnly: restructuresOnlyTotal,
      cutsOnly: cutsOnlyTotal,
      combinedMaxFlex,
    },
    secondContractWall,
    topRestructureLevers,
    topExtensionCandidates,
    topCutWatchCandidates,
  };
}

// ============================================================================
// Multi-Year Future Roster Projection (2026–2029)
// ("View a team's projected roster in future years: Under Contract, Likely Cuts,
//  Off-Contract Free Agents, and Void-Year Ghost Bills")
// ============================================================================

export type FutureRosterBucket =
  | 'SAFE_UNDER_CONTRACT'
  | 'LIKELY_CAP_CUT'
  | 'OFF_CONTRACT_FA'
  | 'VOID_GHOST_BILL';

export interface FutureSeasonPlayerEvaluation {
  player: Player;
  targetYear: LeagueYear;
  ageInTargetYear: number;
  bucket: FutureRosterBucket;
  badgeLabel: string;
  subStatusLabel: string;
  rationale: string;
  capHitInTargetYear: number;
  baseSalaryInTargetYear: number;
  proratedBonusInTargetYear: number;
  guaranteedSalaryInTargetYear: number;
  deadCapIfCutPreJune1: number;
  capSavingsIfCutPreJune1: number;
  capSavingsIfCutPostJune1: number;
  restructureSavingsInTargetYear: number;
  projectedMarketApy: number;
  expiredEnteringYear: LeagueYear | null;
  isNewlyExpiredInTargetYear: boolean;
  isPrimeResignCandidate: boolean;
  voidBillAccelerating: number;
  recommendedActionTab: 'cut' | 'restructure' | 'extend' | 'trade';
}

export interface FutureSeasonRosterOutlook {
  targetYear: LeagueYear;
  safeUnderContract: FutureSeasonPlayerEvaluation[];
  likelyCapCuts: FutureSeasonPlayerEvaluation[];
  offContractFreeAgents: FutureSeasonPlayerEvaluation[];
  voidYearGhostBills: FutureSeasonPlayerEvaluation[];
  totals: {
    underContractCount: number;
    safeContractCapTotal: number;
    likelyCutsCount: number;
    likelyCutsCapTotal: number;
    likelyCutsPotentialSavings: number;
    offContractCount: number;
    newlyExpiredCount: number;
    primeResignCount: number;
    voidGhostBillsCount: number;
    voidGhostBillsTotal: number;
  };
}

export function evaluateFutureSeasonRosterOutlook(
  derivedState: DerivedTeamCapState,
  targetYear: LeagueYear
): FutureSeasonRosterOutlook {
  const yearCapSpace = derivedState.years[targetYear].effectiveCapSpace;

  const safeUnderContract: FutureSeasonPlayerEvaluation[] = [];
  const likelyCapCuts: FutureSeasonPlayerEvaluation[] = [];
  const offContractFreeAgents: FutureSeasonPlayerEvaluation[] = [];
  const voidYearGhostBills: FutureSeasonPlayerEvaluation[] = [];

  for (const player of derivedState.roster) {
    const yearOffset = targetYear - 2026;
    const ageInTargetYear = player.ageIn2026 + yearOffset;
    const curve = POSITIONAL_AGING_CURVES[player.position];
    const longevity = evaluatePlayerLongevity(player);
    const baseForecast = evaluateRosterPlayerFate(
      player,
      derivedState.years[2026].effectiveCapSpace
    );
    const projectedMarketApy = baseForecast.projectedMarketApy;

    const cy = player.contractYears[targetYear];

    // Find last active (non-void) year on contract
    let lastActiveYear: LeagueYear = 2026;
    for (const y of LEAGUE_YEARS) {
      const c = player.contractYears[y];
      if (c && !c.isVoidYear) {
        lastActiveYear = y;
      }
    }
    const expiredEnteringYear =
      lastActiveYear < 2029 ? ((lastActiveYear + 1) as LeagueYear) : null;
    const isNewlyExpiredInTargetYear = expiredEnteringYear === targetYear;

    // CASE 1: Void Year Ghost Bill in targetYear (or first void year after lastActiveYear)
    if (cy && cy.isVoidYear) {
      // Sum all remaining void proration from (lastActiveYear + 1)..2029 if this is the year the contract voids,
      // or show this year's scheduled void proration
      let voidBillAccelerating = cy.proratedBonus;
      if (isNewlyExpiredInTargetYear) {
        let sumVoid = 0;
        for (const y of LEAGUE_YEARS) {
          if (y >= targetYear && player.contractYears[y]?.isVoidYear) {
            sumVoid += player.contractYears[y]!.proratedBonus;
          }
        }
        voidBillAccelerating = roundCap(sumVoid);
      }

      const isPrimeResign =
        ageInTargetYear < curve.cliffAge && player.overallRating >= 78;

      voidYearGhostBills.push({
        player,
        targetYear,
        ageInTargetYear,
        bucket: 'VOID_GHOST_BILL',
        badgeLabel: isNewlyExpiredInTargetYear
          ? `Contract Voids in ${targetYear}`
          : `Void Year #${targetYear - lastActiveYear}`,
        subStatusLabel: `$${voidBillAccelerating.toFixed(1)}M Ghost Bill`,
        rationale: isNewlyExpiredInTargetYear
          ? `${player.name}'s active deal ended after ${lastActiveYear}, triggering $${voidBillAccelerating.toFixed(1)}M in deferred Void-Year bonus money unless extended before the league year.`
          : `Scheduled $${cy.proratedBonus.toFixed(1)}M dummy void-year proration from prior bonus restructures.`,
        capHitInTargetYear: roundCap(cy.proratedBonus),
        baseSalaryInTargetYear: 0,
        proratedBonusInTargetYear: cy.proratedBonus,
        guaranteedSalaryInTargetYear: 0,
        deadCapIfCutPreJune1: voidBillAccelerating,
        capSavingsIfCutPreJune1: 0,
        capSavingsIfCutPostJune1: 0,
        restructureSavingsInTargetYear: 0,
        projectedMarketApy,
        expiredEnteringYear,
        isNewlyExpiredInTargetYear,
        isPrimeResignCandidate: isPrimeResign,
        voidBillAccelerating,
        recommendedActionTab: 'extend',
      });
      continue;
    }

    // CASE 2: Off-Contract / Free Agent in targetYear (!cy)
    if (!cy) {
      const isPrimeResign =
        ageInTargetYear < curve.cliffAge && player.overallRating >= 77;

      offContractFreeAgents.push({
        player,
        targetYear,
        ageInTargetYear,
        bucket: 'OFF_CONTRACT_FA',
        badgeLabel: isNewlyExpiredInTargetYear
          ? `${targetYear} Free Agent (Just Expired)`
          : `Expired in ${expiredEnteringYear ?? 2027}`,
        subStatusLabel: isPrimeResign
          ? `Prime Re-Sign (~$${projectedMarketApy.toFixed(1)}M/yr)`
          : `Likely Walk / Market FA`,
        rationale: isPrimeResign
          ? `Off contract in ${targetYear} at Age ${ageInTargetYear} (${curve.cliffAge - ageInTargetYear} yrs before ${player.position} cliff). Projecting ~$${projectedMarketApy.toFixed(1)}M/yr to re-sign.`
          : `Contract expired after ${lastActiveYear}; at Age ${ageInTargetYear} in ${targetYear}, projected to test the open market or be replaced via the draft.`,
        capHitInTargetYear: 0,
        baseSalaryInTargetYear: 0,
        proratedBonusInTargetYear: 0,
        guaranteedSalaryInTargetYear: 0,
        deadCapIfCutPreJune1: 0,
        capSavingsIfCutPreJune1: 0,
        capSavingsIfCutPostJune1: 0,
        restructureSavingsInTargetYear: 0,
        projectedMarketApy,
        expiredEnteringYear,
        isNewlyExpiredInTargetYear,
        isPrimeResignCandidate: isPrimeResign,
        voidBillAccelerating: 0,
        recommendedActionTab: 'extend',
      });
      continue;
    }

    // CASE 3: Active Contract in targetYear
    const capHit = getContractYearCapHit(cy);
    const preCut = simulateCutOrTrade(player, targetYear, 'PRE_JUNE_1_CUT');
    const postCut = simulateCutOrTrade(player, targetYear, 'POST_JUNE_1_CUT');
    const restSim = simulateRestructure(player, targetYear, 1.0, 2);

    const bestCutSavings = Math.max(
      preCut.currentYearCapSavings,
      postCut.currentYearCapSavings
    );

    const isFinalActiveYear = lastActiveYear === targetYear;
    const isAtOrPastCliff = ageInTargetYear >= curve.cliffAge;
    const isBloatedVsMarket =
      capHit >= projectedMarketApy * 1.18 && preCut.currentYearCapSavings >= 5.5;
    const isUnprotectedBackEnd =
      cy.guaranteedSalary === 0 &&
      preCut.currentYearCapSavings >= 6.5 &&
      preCut.currentYearCapSavings >= preCut.currentYearDeadCap * 1.25 &&
      player.overallRating < 89;
    const isAgingCutTarget =
      isAtOrPastCliff && preCut.currentYearCapSavings >= 4.0 && player.overallRating < 88;
    const isCapSqueezeCasualty =
      yearCapSpace < 15.0 &&
      preCut.currentYearCapSavings >= 7.5 &&
      player.overallRating < 84;

    if (
      isBloatedVsMarket ||
      isUnprotectedBackEnd ||
      isAgingCutTarget ||
      isCapSqueezeCasualty
    ) {
      let cutReason = '';
      if (isAgingCutTarget) {
        cutReason = `Turns ${ageInTargetYear} in ${targetYear} (at/past ${player.position} Age-${curve.cliffAge} cliff) with $${cy.baseSalary.toFixed(1)}M unguaranteed base; releasing saves +$${preCut.currentYearCapSavings.toFixed(1)}M.`;
      } else if (isBloatedVsMarket) {
        cutReason = `${targetYear} cap hit spikes to $${capHit.toFixed(1)}M vs ~$${projectedMarketApy.toFixed(1)}M market value; cutting clears +$${preCut.currentYearCapSavings.toFixed(1)}M (only $${preCut.currentYearDeadCap.toFixed(1)}M dead).`;
      } else {
        cutReason = `Unguaranteed $${cy.baseSalary.toFixed(1)}M base salary in ${targetYear} ("paper back-end year"); team can exit for +$${preCut.currentYearCapSavings.toFixed(1)}M net cap savings.`;
      }

      likelyCapCuts.push({
        player,
        targetYear,
        ageInTargetYear,
        bucket: 'LIKELY_CAP_CUT',
        badgeLabel:
          preCut.currentYearDeadCap <= 2.5
            ? `Clean Exit Year (+$${preCut.currentYearCapSavings.toFixed(1)}M)`
            : `Likely ${targetYear} Cut / Pay-Cut Target`,
        subStatusLabel: `Saves +$${bestCutSavings.toFixed(1)}M (${preCut.currentYearDeadCap.toFixed(1)}M Dead)`,
        rationale: cutReason,
        capHitInTargetYear: capHit,
        baseSalaryInTargetYear: cy.baseSalary,
        proratedBonusInTargetYear: cy.proratedBonus,
        guaranteedSalaryInTargetYear: cy.guaranteedSalary,
        deadCapIfCutPreJune1: preCut.currentYearDeadCap,
        capSavingsIfCutPreJune1: preCut.currentYearCapSavings,
        capSavingsIfCutPostJune1: postCut.currentYearCapSavings,
        restructureSavingsInTargetYear: restSim.currentYearCapSavings,
        projectedMarketApy,
        expiredEnteringYear,
        isNewlyExpiredInTargetYear: false,
        isPrimeResignCandidate: false,
        voidBillAccelerating: 0,
        recommendedActionTab: 'cut',
      });
    } else {
      // Safe Under Contract in targetYear
      let badgeLabel = `Locked Under Contract`;
      let subStatusLabel = `Hit $${capHit.toFixed(1)}M · Dead $${preCut.currentYearDeadCap.toFixed(1)}M`;
      let rationale = `Protected ${targetYear} contract ($${preCut.currentYearDeadCap.toFixed(1)}M dead money if cut vs $${capHit.toFixed(1)}M cap hit).`;
      let recommendedTab: 'cut' | 'restructure' | 'extend' | 'trade' =
        restSim.currentYearCapSavings >= 3.0 ? 'restructure' : 'extend';

      if (player.isRookieContract) {
        badgeLabel = isFinalActiveYear
          ? `Final Rookie Year (Ext. Window)`
          : `Cost-Controlled Rookie Deal`;
        subStatusLabel = `$${capHit.toFixed(2)}M Cap Hit`;
        rationale = isFinalActiveYear
          ? `Entering final year of rookie deal in ${targetYear} at Age ${ageInTargetYear}; prime extension candidate (~$${projectedMarketApy.toFixed(1)}M/yr).`
          : `High-surplus rookie scale contract ($${capHit.toFixed(2)}M in ${targetYear}) at Age ${ageInTargetYear}.`;
        recommendedTab = 'extend';
      } else if (isFinalActiveYear && longevity.postContractViableYears >= 1) {
        badgeLabel = `Contract Year in ${targetYear}`;
        subStatusLabel = `Ext. Target (~$${projectedMarketApy.toFixed(1)}M/yr)`;
        rationale = `Entering final under-contract season in ${targetYear} at Age ${ageInTargetYear}; candidate for an extension before hitting ${targetYear + 1} free agency.`;
        recommendedTab = 'extend';
      } else if (restSim.currentYearCapSavings >= 4.0) {
        badgeLabel = `${targetYear} Restructure Pillar`;
        subStatusLabel = `Can Clear +$${restSim.currentYearCapSavings.toFixed(1)}M`;
        rationale = `Core starter under contract in ${targetYear} with $${cy.baseSalary.toFixed(1)}M base salary; restructuring clears +$${restSim.currentYearCapSavings.toFixed(1)}M in ${targetYear} room.`;
        recommendedTab = 'restructure';
      }

      safeUnderContract.push({
        player,
        targetYear,
        ageInTargetYear,
        bucket: 'SAFE_UNDER_CONTRACT',
        badgeLabel,
        subStatusLabel,
        rationale,
        capHitInTargetYear: capHit,
        baseSalaryInTargetYear: cy.baseSalary,
        proratedBonusInTargetYear: cy.proratedBonus,
        guaranteedSalaryInTargetYear: cy.guaranteedSalary,
        deadCapIfCutPreJune1: preCut.currentYearDeadCap,
        capSavingsIfCutPreJune1: preCut.currentYearCapSavings,
        capSavingsIfCutPostJune1: postCut.currentYearCapSavings,
        restructureSavingsInTargetYear: restSim.currentYearCapSavings,
        projectedMarketApy,
        expiredEnteringYear,
        isNewlyExpiredInTargetYear: false,
        isPrimeResignCandidate: isFinalActiveYear,
        voidBillAccelerating: 0,
        recommendedActionTab: recommendedTab,
      });
    }
  }

  // Sort each bucket logically
  safeUnderContract.sort((a, b) => b.capHitInTargetYear - a.capHitInTargetYear);
  likelyCapCuts.sort(
    (a, b) => b.capSavingsIfCutPreJune1 - a.capSavingsIfCutPreJune1
  );
  offContractFreeAgents.sort((a, b) => {
    if (a.isNewlyExpiredInTargetYear !== b.isNewlyExpiredInTargetYear) {
      return a.isNewlyExpiredInTargetYear ? -1 : 1;
    }
    return b.projectedMarketApy - a.projectedMarketApy;
  });
  voidYearGhostBills.sort(
    (a, b) => b.voidBillAccelerating - a.voidBillAccelerating
  );

  const safeContractCapTotal = roundCap(
    safeUnderContract.reduce((sum, x) => sum + x.capHitInTargetYear, 0)
  );
  const likelyCutsCapTotal = roundCap(
    likelyCapCuts.reduce((sum, x) => sum + x.capHitInTargetYear, 0)
  );
  const likelyCutsPotentialSavings = roundCap(
    likelyCapCuts.reduce((sum, x) => sum + x.capSavingsIfCutPreJune1, 0)
  );
  const voidGhostBillsTotal = roundCap(
    voidYearGhostBills.reduce((sum, x) => sum + x.voidBillAccelerating, 0)
  );

  return {
    targetYear,
    safeUnderContract,
    likelyCapCuts,
    offContractFreeAgents,
    voidYearGhostBills,
    totals: {
      underContractCount: safeUnderContract.length + likelyCapCuts.length,
      safeContractCapTotal,
      likelyCutsCount: likelyCapCuts.length,
      likelyCutsCapTotal,
      likelyCutsPotentialSavings,
      offContractCount: offContractFreeAgents.length,
      newlyExpiredCount: offContractFreeAgents.filter(
        (x) => x.isNewlyExpiredInTargetYear
      ).length,
      primeResignCount: offContractFreeAgents.filter(
        (x) => x.isPrimeResignCandidate
      ).length,
      voidGhostBillsCount: voidYearGhostBills.length,
      voidGhostBillsTotal,
    },
  };
}

