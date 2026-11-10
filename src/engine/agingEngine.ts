import { POSITIONAL_AGING_CURVES } from './constants';
import { AgingStatus, LEAGUE_YEARS, LeagueYear, Player, PositionGroup } from './types';

export interface YearAgingAssessment {
  year: LeagueYear;
  age: number;
  status: AgingStatus;
  statusLabel: string;
  isAtOrPastCliff: boolean;
  yearsToCliff: number;
}

export interface PlayerLongevityReport {
  playerId: string;
  position: PositionGroup;
  cliffAge: number;
  peakWindowLabel: string;
  contractExpirationYear: LeagueYear | null;
  ageAtExpiration: number;
  postContractViableYears: number;      // Number of starter-level seasons projected after contract expires
  extensionRecommendation: 'Prime Extension Candidate' | 'Short Bridge Deal' | 'Walk / Draft Replacement' | 'Locked Up Through Prime';
  yearlyAssessments: Record<LeagueYear, YearAgingAssessment>;
}

/**
 * Evaluate a player's age status for a single league year based on positional aging curves.
 */
export function getAgingStatusForAge(
  position: PositionGroup,
  age: number
): { status: AgingStatus; statusLabel: string } {
  const curve = POSITIONAL_AGING_CURVES[position];

  if (age < curve.peakStartAge) {
    return { status: 'Ascent', statusLabel: `Ascending (<${curve.peakStartAge})` };
  }
  if (age <= curve.peakEndAge) {
    return { status: 'Prime', statusLabel: `Prime Window (${curve.peakStartAge}–${curve.peakEndAge})` };
  }
  if (age < curve.severeDeclineAge) {
    return { status: 'CliffWarning', statusLabel: `Age Cliff (${curve.cliffAge}+)` };
  }
  return { status: 'Decline', statusLabel: `Severe Regression (${curve.severeDeclineAge}+)` };
}

/**
 * Compute a complete multi-year longevity and post-contract viability report for a player.
 * Gives visual intuition into whether a player has unprotected starter years left after their deal expires
 * (prime extension candidate) or if their current deal already runs right into their positional cliff.
 */
export function evaluatePlayerLongevity(player: Player): PlayerLongevityReport {
  const curve = POSITIONAL_AGING_CURVES[player.position];

  const yearlyAssessments = {} as Record<LeagueYear, YearAgingAssessment>;
  let lastActiveContractYear: LeagueYear | null = null;

  for (const year of LEAGUE_YEARS) {
    const age = player.ageIn2026 + (year - 2026);
    const { status, statusLabel } = getAgingStatusForAge(player.position, age);
    const cy = player.contractYears[year];
    if (cy && !cy.isVoidYear) {
      lastActiveContractYear = year;
    }

    yearlyAssessments[year] = {
      year,
      age,
      status,
      statusLabel,
      isAtOrPastCliff: age >= curve.cliffAge,
      yearsToCliff: curve.cliffAge - age,
    };
  }

  const expirationYear = lastActiveContractYear ?? 2026;
  const ageAtExpiration = player.ageIn2026 + (expirationYear - 2026) + 1; // Age entering first free-agent season

  // Elite players tend to beat their positional cliff by ~1 season
  const tierBonus = player.tier === 'Elite' ? 1 : 0;
  const effectiveCeilingAge = curve.cliffAge + tierBonus;

  const rawViableRemaining = Math.max(0, effectiveCeilingAge - ageAtExpiration + 1);
  const postContractViableYears =
    player.tier === 'Depth' ? Math.min(1, rawViableRemaining) : rawViableRemaining;

  let extensionRecommendation: PlayerLongevityReport['extensionRecommendation'] =
    'Walk / Draft Replacement';

  if (lastActiveContractYear === 2029 && postContractViableYears <= 1) {
    extensionRecommendation = 'Locked Up Through Prime';
  } else if (postContractViableYears >= 2 && (player.tier === 'Elite' || player.tier === 'Starter' || player.tier === 'Rookie')) {
    extensionRecommendation = 'Prime Extension Candidate';
  } else if (postContractViableYears === 1 && (player.tier === 'Elite' || player.tier === 'Starter')) {
    extensionRecommendation = 'Short Bridge Deal';
  }

  return {
    playerId: player.id,
    position: player.position,
    cliffAge: curve.cliffAge,
    peakWindowLabel: `${curve.peakStartAge}–${curve.peakEndAge}`,
    contractExpirationYear: lastActiveContractYear,
    ageAtExpiration,
    postContractViableYears,
    extensionRecommendation,
    yearlyAssessments,
  };
}

export interface CareerTimelineNode {
  year: number;
  age: number;
  phase: 'ASCENT' | 'PEAK_PRIME' | 'CLIFF_WARNING' | 'TWILIGHT_DECLINE' | 'RETIRED_OR_VET_MIN';
  phaseLabel: string;
  contractStatus: 'UNDER_CONTRACT' | 'VOID_YEAR' | 'UNPROTECTED_PRIME_FA' | 'UNSIGNED_LATE_CAREER';
  contractStatusLabel: string;
  capHit: number | null;
}

export interface CareerLongevityProjection {
  currentAge: number;
  accruedSeasons: number;
  positionPeakWindow: string;
  positionCliffAge: number;
  positionSevereDeclineAge: number;
  expectedRemainingStarterYears: number;
  expectedTotalCareerYearsLeft: number;
  projectedFinalStarterSeason: number;
  projectedRetirementAge: number;
  projectedRetirementSeason: number;
  careerHeadline: string;
  careerSummaryVerdict: string;
  timeline: CareerTimelineNode[];
}

/**
 * Computes a comprehensive career longevity & retirement projection for any NFL player,
 * answering "How much longer is this player expected to play at a high level and in the NFL?"
 */
export function projectPlayerCareerHorizon(player: Player): CareerLongevityProjection {
  const curve = POSITIONAL_AGING_CURVES[player.position];
  const longevity = evaluatePlayerLongevity(player);

  // Elite/high-OVR players historically play ~1-2 years longer than average positional cliff
  const eliteBonus =
    player.overallRating >= 90 ? 2 : player.overallRating >= 83 ? 1 : 0;

  const effectiveStarterCeilingAge = curve.cliffAge + (eliteBonus > 0 ? 1 : 0);
  const projectedRetirementAge = Math.max(
    player.ageIn2026 + 1,
    curve.severeDeclineAge + eliteBonus
  );

  const expectedRemainingStarterYears = Math.max(
    0,
    effectiveStarterCeilingAge - player.ageIn2026 + 1
  );
  const expectedTotalCareerYearsLeft = Math.max(
    1,
    projectedRetirementAge - player.ageIn2026 + 1
  );

  const projectedFinalStarterSeason =
    2026 + Math.max(0, expectedRemainingStarterYears - 1);
  const projectedRetirementSeason =
    2026 + Math.max(0, expectedTotalCareerYearsLeft - 1);

  let careerHeadline = '';
  if (expectedRemainingStarterYears >= 5) {
    careerHeadline = `${expectedRemainingStarterYears} Prime Starter Seasons Left (~${expectedTotalCareerYearsLeft} Total Yrs)`;
  } else if (expectedRemainingStarterYears >= 2) {
    careerHeadline = `${expectedRemainingStarterYears} Viable Starter Seasons Left (Through ~${projectedFinalStarterSeason})`;
  } else if (expectedRemainingStarterYears === 1) {
    careerHeadline = `Entering Final Pre-Cliff Starter Season (Age ${player.ageIn2026})`;
  } else {
    careerHeadline = `Year-to-Year Veteran (${expectedTotalCareerYearsLeft} Est. NFL Yr${expectedTotalCareerYearsLeft > 1 ? 's' : ''} Left)`;
  }

  const lastContractYr = longevity.contractExpirationYear ?? 2026;
  const careerSummaryVerdict =
    expectedRemainingStarterYears >= 2
      ? `At Age ${player.ageIn2026} (${player.accruedSeasons} NFL seasons), ${player.name} projects for ~${expectedRemainingStarterYears} more starter-level seasons before the ${player.position} Age-${curve.cliffAge} cliff and ~${expectedTotalCareerYearsLeft} total seasons before retirement around Age ${projectedRetirementAge} (${projectedRetirementSeason}). Current deal runs through ${lastContractYr}.`
      : `At Age ${player.ageIn2026} (${player.accruedSeasons} NFL seasons), ${player.name} is near or past the typical ${player.position} Age-${curve.cliffAge} cliff (${curve.peakStartAge}–${curve.peakEndAge} peak). Projects as a year-to-year contributor through ~Age ${projectedRetirementAge} (${projectedRetirementSeason}).`;

  const timeline: CareerTimelineNode[] = [];
  for (let yr = 2026; yr <= 2031; yr++) {
    const age = player.ageIn2026 + (yr - 2026);
    const cy =
      yr <= 2029 ? player.contractYears[yr as LeagueYear] ?? null : null;

    let phase: CareerTimelineNode['phase'] = 'PEAK_PRIME';
    let phaseLabel = 'Prime Window';
    if (age > projectedRetirementAge) {
      phase = 'RETIRED_OR_VET_MIN';
      phaseLabel = 'Est. Retired';
    } else if (age < curve.peakStartAge) {
      phase = 'ASCENT';
      phaseLabel = 'Ascending';
    } else if (age <= curve.peakEndAge) {
      phase = 'PEAK_PRIME';
      phaseLabel = 'Peak Prime';
    } else if (age <= effectiveStarterCeilingAge) {
      phase = 'CLIFF_WARNING';
      phaseLabel = `Cliff Watch (Age ${age})`;
    } else {
      phase = 'TWILIGHT_DECLINE';
      phaseLabel = 'Late-Career Twilight';
    }

    let contractStatus: CareerTimelineNode['contractStatus'] =
      'UNSIGNED_LATE_CAREER';
    let contractStatusLabel = 'Unsigned FA';
    let capHit: number | null = null;

    if (cy && !cy.isVoidYear) {
      contractStatus = 'UNDER_CONTRACT';
      capHit =
        Math.round(
          (cy.baseSalary +
            cy.proratedBonus +
            cy.rosterBonus +
            cy.workoutBonus) *
            100
        ) / 100;
      contractStatusLabel = `Under Contract ($${capHit.toFixed(1)}M)`;
    } else if (cy && cy.isVoidYear) {
      contractStatus = 'VOID_YEAR';
      capHit = cy.proratedBonus;
      contractStatusLabel = `Void Ghost Yr ($${cy.proratedBonus.toFixed(1)}M)`;
    } else if (age <= effectiveStarterCeilingAge) {
      contractStatus = 'UNPROTECTED_PRIME_FA';
      contractStatusLabel = 'Unprotected Prime FA';
    } else {
      contractStatus = 'UNSIGNED_LATE_CAREER';
      contractStatusLabel =
        age > projectedRetirementAge ? 'Projected Retired' : 'Unsigned Vet';
    }

    timeline.push({
      year: yr,
      age,
      phase,
      phaseLabel,
      contractStatus,
      contractStatusLabel,
      capHit,
    });
  }

  return {
    currentAge: player.ageIn2026,
    accruedSeasons: player.accruedSeasons,
    positionPeakWindow: `${curve.peakStartAge}–${curve.peakEndAge}`,
    positionCliffAge: curve.cliffAge,
    positionSevereDeclineAge: curve.severeDeclineAge,
    expectedRemainingStarterYears,
    expectedTotalCareerYearsLeft,
    projectedFinalStarterSeason,
    projectedRetirementAge,
    projectedRetirementSeason,
    careerHeadline,
    careerSummaryVerdict,
    timeline,
  };
}
