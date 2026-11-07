import { getVeteranMinimumSalary, roundCap } from './constants';
import { getContractYearCapHit } from './contractEngine';
import {
  ContractStructureTemplate,
  ContractYear,
  FreeAgentTarget,
  LEAGUE_YEARS,
  LeagueYear,
  Player,
} from './types';

/**
 * Hypothetical Free Agent & Extension Contract Builder (`freeAgencyEngine.ts`).
 *
 * Generates authentic NFL multi-year contract structures:
 * - 'Backloaded' (Team-Friendly): Year 1 minimum-near base salary + large signing bonus prorated across all years (+ optional void year).
 * - 'Flat': Evenly distributed base salaries + moderate signing bonus.
 * - 'FrontLoaded': High Year 1 base salary with zero dead cap risk in Years 3–4.
 * - 'VoidHeavy': Maximum cap deferral using automatic void years at the back end of the 2026–2029 horizon.
 */

export interface GeneratedContractOffer {
  totalValue: number;
  apy: number;
  years: number;
  totalGuaranteed: number;
  signingBonusTotal: number;
  structure: ContractStructureTemplate;
  contractYears: Record<LeagueYear, ContractYear | null>;
  capHitsByYear: Record<LeagueYear, number>;
}

/**
 * Build a multi-year NFL contract starting in `startYear` for `years` length at `apy` ($M),
 * `guaranteedPct` (0..0.85), and `structure` template.
 */
export function buildStructuredContract(
  startYear: LeagueYear,
  years: number,
  apy: number,
  guaranteedPct: number,
  structure: ContractStructureTemplate,
  accruedSeasons: number = 4
): GeneratedContractOffer {
  const clampedYears = Math.max(1, Math.min(4, Math.round(years)));
  const totalValue = roundCap(apy * clampedYears);
  const totalGuaranteed = roundCap(totalValue * Math.min(0.9, Math.max(0, guaranteedPct)));

  // Determine signing bonus share based on structure template
  let signingBonusShareOfTotal = 0.25;
  if (structure === 'Backloaded') signingBonusShareOfTotal = 0.34;
  else if (structure === 'Flat') signingBonusShareOfTotal = 0.20;
  else if (structure === 'FrontLoaded') signingBonusShareOfTotal = 0.12;
  else if (structure === 'VoidHeavy') signingBonusShareOfTotal = 0.42;

  const signingBonusTotal = roundCap(
    Math.min(totalGuaranteed, totalValue * signingBonusShareOfTotal)
  );
  const remainingBasePool = roundCap(Math.max(clampedYears * 1.2, totalValue - signingBonusTotal));

  // Base salary weights by template across `clampedYears`
  const weightsByLength: Record<ContractStructureTemplate, Record<number, number[]>> = {
    Backloaded: {
      1: [1.0],
      2: [0.32, 0.68],
      3: [0.16, 0.36, 0.48],
      4: [0.11, 0.23, 0.31, 0.35],
    },
    Flat: {
      1: [1.0],
      2: [0.49, 0.51],
      3: [0.32, 0.33, 0.35],
      4: [0.24, 0.25, 0.25, 0.26],
    },
    FrontLoaded: {
      1: [1.0],
      2: [0.64, 0.36],
      3: [0.48, 0.30, 0.22],
      4: [0.40, 0.26, 0.19, 0.15],
    },
    VoidHeavy: {
      1: [1.0],
      2: [0.28, 0.72],
      3: [0.14, 0.34, 0.52],
      4: [0.10, 0.20, 0.32, 0.38],
    },
  };

  const weights = weightsByLength[structure][clampedYears] ?? [0.25, 0.25, 0.25, 0.25];

  // Determine proration years (including void years if VoidHeavy and within 2026–2029)
  const activeYears: LeagueYear[] = [];
  const voidYears: LeagueYear[] = [];

  for (let i = 0; i < clampedYears; i++) {
    const y = (startYear + i) as LeagueYear;
    if (LEAGUE_YEARS.includes(y)) {
      activeYears.push(y);
    }
  }

  if (structure === 'VoidHeavy') {
    for (const y of LEAGUE_YEARS) {
      if (y > activeYears[activeYears.length - 1]) {
        voidYears.push(y);
      }
    }
  }

  const totalProrationDenominator = Math.min(
    5,
    clampedYears + (structure === 'VoidHeavy' ? Math.max(1, voidYears.length) : 0)
  );
  const annualProratedBonus = roundCap(signingBonusTotal / totalProrationDenominator);

  let remainingGuaranteeToAllocate = roundCap(Math.max(0, totalGuaranteed - signingBonusTotal));

  const contractYears: Record<LeagueYear, ContractYear | null> = {
    2026: null,
    2027: null,
    2028: null,
    2029: null,
  };

  activeYears.forEach((y, idx) => {
    const vetMin = getVeteranMinimumSalary(accruedSeasons + idx, y);
    const rawBase = Math.max(vetMin, remainingBasePool * (weights[idx] ?? 0.25));
    const baseSalary = roundCap(rawBase);

    const guaranteedSalary = roundCap(Math.min(baseSalary, remainingGuaranteeToAllocate));
    remainingGuaranteeToAllocate = roundCap(
      Math.max(0, remainingGuaranteeToAllocate - guaranteedSalary)
    );

    contractYears[y] = {
      year: y,
      baseSalary,
      guaranteedSalary,
      proratedBonus: annualProratedBonus,
      rosterBonus: 0,
      workoutBonus: 0,
      isVoidYear: false,
    };
  });

  for (const vy of voidYears) {
    contractYears[vy] = {
      year: vy,
      baseSalary: 0,
      guaranteedSalary: 0,
      proratedBonus: annualProratedBonus,
      rosterBonus: 0,
      workoutBonus: 0,
      isVoidYear: true,
    };
  }

  const capHitsByYear: Record<LeagueYear, number> = {
    2026: getContractYearCapHit(contractYears[2026]),
    2027: getContractYearCapHit(contractYears[2027]),
    2028: getContractYearCapHit(contractYears[2028]),
    2029: getContractYearCapHit(contractYears[2029]),
  };

  return {
    totalValue,
    apy,
    years: clampedYears,
    totalGuaranteed,
    signingBonusTotal,
    structure,
    contractYears,
    capHitsByYear,
  };
}

/**
 * Create a new `Player` on the active roster from a `FreeAgentTarget` and contract terms.
 */
export function createSignedFreeAgentPlayer(
  fa: FreeAgentTarget,
  startYear: LeagueYear,
  years: number,
  apy: number,
  guaranteedPct: number,
  structure: ContractStructureTemplate
): Player {
  const offer = buildStructuredContract(
    startYear,
    years,
    apy,
    guaranteedPct,
    structure,
    fa.accruedSeasons
  );

  return {
    id: `fa-signed-${fa.id}`,
    name: fa.name,
    position: fa.position,
    ageIn2026: fa.ageIn2026,
    tier: fa.tier,
    overallRating: fa.overallRating,
    accruedSeasons: fa.accruedSeasons,
    notes: `Signed in FA (${years} yr, $${offer.totalValue.toFixed(1)}M)`,
    contractYears: offer.contractYears,
  };
}

/**
 * Apply an in-house Contract Extension to an existing `Player`:
 * Can also smooth out the final existing contract year by spreading the new signing bonus proration
 * starting immediately in `actionYear` (just like real NFL extensions do).
 */
export function applyPlayerExtension(
  player: Player,
  actionYear: LeagueYear,
  newYearsAdded: number,
  apy: number,
  guaranteedPct: number,
  structure: ContractStructureTemplate
): { updatedPlayer: Player; capDeltaByYear: Record<LeagueYear, number> } {
  // Find last active (non-void) year on current contract
  let lastActiveYear: LeagueYear = actionYear;
  for (const y of LEAGUE_YEARS) {
    const cy = player.contractYears[y];
    if (cy && !cy.isVoidYear) {
      lastActiveYear = y;
    }
  }

  const totalNewValue = roundCap(apy * newYearsAdded);
  const totalNewGuaranteed = roundCap(totalNewValue * guaranteedPct);
  const signingBonusShare =
    structure === 'Backloaded' || structure === 'VoidHeavy'
      ? 0.32
      : structure === 'Flat'
      ? 0.22
      : 0.14;
  const newSigningBonus = roundCap(Math.min(totalNewGuaranteed, totalNewValue * signingBonusShare));

  const newContractYears: Record<LeagueYear, ContractYear | null> = {
    2026: player.contractYears[2026] ? { ...player.contractYears[2026]! } : null,
    2027: player.contractYears[2027] ? { ...player.contractYears[2027]! } : null,
    2028: player.contractYears[2028] ? { ...player.contractYears[2028]! } : null,
    2029: player.contractYears[2029] ? { ...player.contractYears[2029]! } : null,
  };

  // Years after lastActiveYear up to 2029 become the new extension seasons
  const extensionYearsInHorizon: LeagueYear[] = [];
  for (const y of LEAGUE_YEARS) {
    if (y > lastActiveYear && extensionYearsInHorizon.length < newYearsAdded) {
      extensionYearsInHorizon.push(y);
    }
  }

  // If the player was already signed through 2029 or expiring in 2026, ensure extension years populate
  if (extensionYearsInHorizon.length === 0 && lastActiveYear < 2029) {
    extensionYearsInHorizon.push((lastActiveYear + 1) as LeagueYear);
  }

  const prorationSpan = Math.min(5, 1 + newYearsAdded);
  const annualBonusAdded = roundCap(newSigningBonus / prorationSpan);

  // If extending before expiration, reduce current year's base salary slightly if Backloaded/VoidHeavy
  if (
    newContractYears[actionYear] &&
    !newContractYears[actionYear]!.isVoidYear &&
    (structure === 'Backloaded' || structure === 'VoidHeavy')
  ) {
    const cur = newContractYears[actionYear]!;
    const vetMin = getVeteranMinimumSalary(player.accruedSeasons, actionYear);
    if (cur.baseSalary > vetMin + 3.0) {
      const reduction = roundCap((cur.baseSalary - vetMin) * 0.35);
      cur.baseSalary = roundCap(cur.baseSalary - reduction);
      cur.proratedBonus = roundCap(cur.proratedBonus + roundCap(reduction / prorationSpan));
    }
  }

  // Populate new extension years in 2026-2029
  extensionYearsInHorizon.forEach((y, idx) => {
    const existingVoidProration = newContractYears[y]?.isVoidYear
      ? newContractYears[y]!.proratedBonus
      : 0;

    const yearFactor =
      structure === 'Backloaded' || structure === 'VoidHeavy'
        ? 0.72 + idx * 0.22
        : structure === 'FrontLoaded'
        ? 1.15 - idx * 0.18
        : 0.92 + idx * 0.08;

    const baseSalary = roundCap(Math.max(2.0, (apy - annualBonusAdded) * yearFactor));
    const guaranteedSalary = idx === 0 ? roundCap(baseSalary * Math.min(1, guaranteedPct * 1.3)) : 0;

    newContractYears[y] = {
      year: y,
      baseSalary,
      guaranteedSalary,
      proratedBonus: roundCap(existingVoidProration + annualBonusAdded),
      rosterBonus: 0,
      workoutBonus: 0.25,
      isVoidYear: false,
    };
  });

  // Also add the new signing bonus proration to existing active years from actionYear..lastActiveYear
  for (const y of LEAGUE_YEARS) {
    if (y >= actionYear && y <= lastActiveYear && newContractYears[y]) {
      newContractYears[y]!.proratedBonus = roundCap(
        newContractYears[y]!.proratedBonus + annualBonusAdded
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
    capDeltaByYear[y] = roundCap(
      getContractYearCapHit(newContractYears[y]) - getContractYearCapHit(player.contractYears[y])
    );
  }

  return {
    updatedPlayer: {
      ...player,
      contractYears: newContractYears,
    },
    capDeltaByYear,
  };
}
