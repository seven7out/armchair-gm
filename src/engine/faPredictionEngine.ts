import { POSITIONAL_AGING_CURVES, roundCap } from './constants';
import { getContractYearCapHit, simulateCutOrTrade } from './contractEngine';
import {
  FreeAgentOriginType,
  FreeAgentTarget,
  LeagueYear,
  Player,
  PositionGroup,
  PredictedMarketClassification,
  TeamSeedData,
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
