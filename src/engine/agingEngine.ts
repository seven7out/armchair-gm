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
