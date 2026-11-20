/**
 * NFL Contract Insurance & CBA Article 13 Cap-Credit Engine
 *
 * Models how NFL clubs purchase off-cap disability/injury insurance policies
 * on high-value contracts and receive future-year salary cap credits under
 * the CBA "refund from player" mechanism when covered injuries occur.
 *
 * Explicitly distinguishes between:
 *  - Publicly documented real-world contract insurance clauses / NFLPA cap credits
 *    (e.g., Aidan Hutchinson's Clause 54 with Detroit; Deshaun Watson's record
 *    multi-year CBA cap credits with Cleveland), and
 *  - Deterministic CBA eligibility estimates for high-guarantee contracts league-wide.
 */

import { DerivedTeamCapState, LEAGUE_YEARS, Player } from './types';
import { roundCap } from './constants';
import { getContractYearCapHit } from './contractEngine';

export type ContractInsuranceTier =
  | 'DOCUMENTED_CLAUSE'
  | 'PRIME_INSURABLE'
  | 'MODERATE_INSURABLE'
  | 'MINIMAL_EXPOSURE';

export interface InsuranceComponent {
  label: string;
  amount: number; // $M
}

export interface ContractInsuranceProfile {
  playerId: string;
  playerName: string;
  position: Player['position'];
  tier: ContractInsuranceTier;
  isDocumentedRealClause: boolean;
  badgeLabel: string;
  clauseReference: string | null;
  insurableWindowLabel: string;
  /** Maximum dollar pool ($M) insurable for the active 2026–2027 window */
  maxInsurablePool2026: number;
  /** Multi-year total insurable ceiling ($M) where documented or estimated (2026–2028) */
  multiYearInsurableCeiling: number;
  /**
   * Maximum estimated next-year CBA salary cap credit ($M) if 100% insured
   * and the player misses an entire 17-game season due to a covered injury.
   */
  maxFullSeasonCapCredit: number;
  /** Estimated annual owner cash premium range ($M, 0% cap hit) */
  estimatedOwnerPremiumLow: number;
  estimatedOwnerPremiumHigh: number;
  componentBreakdown: InsuranceComponent[];
  summary: string;
  cbaRuleNote: string;
}

export interface InsuranceSimulationResult {
  gamesMissed: number;
  policyCoveragePct: number;
  projectedNextYearCapCredit: number;
  projectedCashReimbursement: number;
  estimatedOwnerPremium: number;
}

export interface TeamInsuranceOverview {
  documentedClauses: { player: Player; profile: ContractInsuranceProfile }[];
  primeInsurable: { player: Player; profile: ContractInsuranceProfile }[];
  allTracked: { player: Player; profile: ContractInsuranceProfile }[];
  totalInsurablePool2026: number;
  totalMaxPotentialCapCredit: number;
  voidYearContractsCount: number;
  totalVoidGhostBills: number;
  cutRiskContractsCount: number;
}

const STANDARD_CBA_RULE_NOTE =
  'Under NFL CBA Article 13, teams pay third-party disability insurance premiums out of owner cash (0% salary cap hit). If a covered injury causes missed games, the insurer payout is treated as a "refund from the player" and returned to the club as a salary cap credit in the following league year.';

interface DocumentedInsuranceRecord {
  normalizedName: string;
  teamAbbr: string;
  badgeLabel: string;
  clauseReference: string;
  insurableWindowLabel: string;
  maxInsurablePool2026: number;
  multiYearInsurableCeiling: number;
  maxFullSeasonCapCredit: number;
  componentBreakdown: InsuranceComponent[];
  summary: string;
}

const DOCUMENTED_INSURANCE_RECORDS: DocumentedInsuranceRecord[] = [
  {
    normalizedName: 'aidan hutchinson',
    teamAbbr: 'DET',
    badgeLabel: 'Documented Policy · Clause 54',
    clauseReference: 'Clause 54 — Club Disability & Injury Insurance Rights',
    insurableWindowLabel:
      'May 31, 2026 – May 31, 2027 (up to $60.0M total across 2026–2028)',
    maxInsurablePool2026: 44.62,
    multiYearInsurableCeiling: 60.0,
    maxFullSeasonCapCredit: 19.83,
    componentBreakdown: [
      { label: 'Signing Bonus Slice (2026–27 Window)', amount: 15.0 },
      { label: '2026 Option Bonus Trigger', amount: 28.41 },
      { label: '2026 Base Salary', amount: 1.22 },
    ],
    summary:
      'Clause 54 of Aidan Hutchinson’s Detroit extension explicitly entitles the Lions to buy third-party injury/disability policies naming the club as beneficiary—up to $60M across 2026–2028 and up to $45M ($44.62M exact eligible block) in the May 2026–May 2027 window. Whether Detroit maxed every policy tier is private, but full collection on a season-ending injury projects up to ~$19.83M in future CBA salary cap credits.',
  },
  {
    normalizedName: 'deshaun watson',
    teamAbbr: 'CLE',
    badgeLabel: 'Documented NFLPA Cap Credits',
    clauseReference: 'Fully Guaranteed Contract Insurance Addendums ($88.78M NFLPA Record)',
    insurableWindowLabel:
      'Multi-year CBA cap credits tracked across 2024–2029 ledgers',
    maxInsurablePool2026: 46.0,
    multiYearInsurableCeiling: 88.78,
    maxFullSeasonCapCredit: 30.0,
    componentBreakdown: [
      { label: 'Documented Cumulative NFLPA Cap Credits (2024–2029)', amount: 88.78 },
      { label: '2026 Scheduled Base Salary Exposure', amount: 46.0 },
    ],
    summary:
      'The largest contract insurance credit case in NFL history: Cleveland heavily insured Deshaun Watson’s $230M fully guaranteed deal. Shoulder and Achilles injuries triggered insurance payouts yielding $88.781M in cumulative CBA salary cap credits spread across the Browns’ 2024–2029 cap books.',
  },
];

export const LEAGUE_DOCUMENTED_INSURANCE_SPOTLIGHTS = [
  {
    playerName: 'Aidan Hutchinson',
    teamId: 'DET',
    teamLabel: 'Detroit Lions',
    headline: 'Clause 54 · Up to $45M Insurable (2026–27) / ~$19.8M Max Cap Credit',
    detail:
      'Covers $15.0M signing bonus slice + $28.41M option bonus + $1.22M base salary ($60M ceiling across 2026–2028).',
  },
  {
    playerName: 'Deshaun Watson',
    teamId: 'CLE',
    teamLabel: 'Cleveland Browns',
    headline: 'NFLPA Record · $88.78M Cumulative CBA Insurance Cap Credits',
    detail:
      'Heavily insured $230M fully guaranteed contract produced multi-year salary cap credits from 2024 through 2029.',
  },
] as const;

export function evaluatePlayerContractInsurance(
  player: Player
): ContractInsuranceProfile {
  const norm = player.name.trim().toLowerCase();
  const documented = DOCUMENTED_INSURANCE_RECORDS.find(
    (rec) => rec.normalizedName === norm
  );

  if (documented) {
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      tier: 'DOCUMENTED_CLAUSE',
      isDocumentedRealClause: true,
      badgeLabel: documented.badgeLabel,
      clauseReference: documented.clauseReference,
      insurableWindowLabel: documented.insurableWindowLabel,
      maxInsurablePool2026: documented.maxInsurablePool2026,
      multiYearInsurableCeiling: documented.multiYearInsurableCeiling,
      maxFullSeasonCapCredit: documented.maxFullSeasonCapCredit,
      estimatedOwnerPremiumLow: roundCap(documented.maxInsurablePool2026 * 0.025),
      estimatedOwnerPremiumHigh: roundCap(documented.maxInsurablePool2026 * 0.045),
      componentBreakdown: documented.componentBreakdown,
      summary: documented.summary,
      cbaRuleNote: STANDARD_CBA_RULE_NOTE,
    };
  }

  const cy26 = player.contractYears[2026];
  const cy27 = player.contractYears[2027];
  const cy28 = player.contractYears[2028];

  const gtd26 = cy26 && !cy26.isVoidYear ? cy26.guaranteedSalary : 0;
  const bonus26 = cy26 && !cy26.isVoidYear ? cy26.proratedBonus : 0;
  const roster26 = cy26 && !cy26.isVoidYear ? cy26.rosterBonus : 0;
  const base26 = cy26 && !cy26.isVoidYear ? cy26.baseSalary : 0;
  const capHit26 = getContractYearCapHit(cy26);

  // Remaining prorated bonus exposure across 2026–2029 (approximate remaining bonus block)
  const remainingBonusTotal = LEAGUE_YEARS.reduce((sum, yr) => {
    const cy = player.contractYears[yr];
    return sum + (cy ? cy.proratedBonus : 0);
  }, 0);

  const gtd27 = cy27 && !cy27.isVoidYear ? cy27.guaranteedSalary : 0;
  const gtd28 = cy28 && !cy28.isVoidYear ? cy28.guaranteedSalary : 0;

  // Insurable 2026 cash/guarantee exposure: guaranteed base + roster bonus + current-year bonus share
  const insurable2026Cash = roundCap(
    Math.max(gtd26, base26 > 0 && bonus26 >= 8 ? base26 : 0) +
      roster26 +
      Math.min(remainingBonusTotal * 0.5, bonus26 * 2.2)
  );
  const multiYearCeiling = roundCap(
    gtd26 + gtd27 + gtd28 + remainingBonusTotal
  );

  // Under CBA insurance rules, teams typically insure 50-100% of current-year guaranteed compensation
  // and prorated bonus slices, generating a cap credit bounded by actual cap-counted exposure (~45-65% of insured pool, capped near cap hit + next-yr bonus slice)
  const maxFullSeasonCapCredit = roundCap(
    Math.min(
      capHit26 + bonus26 * 0.5,
      Math.max(gtd26 + roster26, insurable2026Cash * 0.48)
    )
  );

  const components: InsuranceComponent[] = [];
  if (gtd26 > 0) {
    components.push({ label: '2026 Guaranteed Base Salary', amount: roundCap(gtd26) });
  } else if (base26 > 0) {
    components.push({ label: '2026 Base Salary (Unprotected)', amount: roundCap(base26) });
  }
  if (roster26 > 0) {
    components.push({ label: '2026 Roster Bonus', amount: roundCap(roster26) });
  }
  if (bonus26 > 0) {
    components.push({
      label: '2026 Prorated Signing/Option Bonus',
      amount: roundCap(bonus26),
    });
  }
  if (remainingBonusTotal > bonus26 + 0.5) {
    components.push({
      label: 'Future Unamortized Bonus Balance (2027–29)',
      amount: roundCap(remainingBonusTotal - bonus26),
    });
  }

  let tier: ContractInsuranceTier = 'MINIMAL_EXPOSURE';
  let badgeLabel = 'Standard Contract';
  let summary =
    'Relatively low guaranteed cap exposure in 2026; clubs rarely pay third-party disability insurance premiums on deals at this cap tier.';

  if (
    insurable2026Cash >= 18 ||
    multiYearCeiling >= 40 ||
    (capHit26 >= 20 && remainingBonusTotal >= 15)
  ) {
    tier = 'PRIME_INSURABLE';
    badgeLabel = 'Prime Club Insurance Candidate';
    summary = `High-value contract with $${multiYearCeiling.toFixed(1)}M in remaining guaranteed salary & prorated bonus exposure (2026–2029). While individual club insurance purchases are private unless disclosed, deals in this tier are prime candidates for off-cap disability coverage to unlock next-year CBA cap credits if a major injury occurs.`;
  } else if (insurable2026Cash >= 8 || multiYearCeiling >= 18) {
    tier = 'MODERATE_INSURABLE';
    badgeLabel = 'Insurable Starter Exposure';
    summary = `Moderate guaranteed/bonus exposure ($${multiYearCeiling.toFixed(1)}M remaining). Clubs selectively insure starters at this level depending on ownership cash appetite and injury history.`;
  }

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    tier,
    isDocumentedRealClause: false,
    badgeLabel,
    clauseReference: null,
    insurableWindowLabel: '2026 League Year (CBA Article 13 Estimate)',
    maxInsurablePool2026: insurable2026Cash,
    multiYearInsurableCeiling: multiYearCeiling,
    maxFullSeasonCapCredit,
    estimatedOwnerPremiumLow: roundCap(insurable2026Cash * 0.025),
    estimatedOwnerPremiumHigh: roundCap(insurable2026Cash * 0.045),
    componentBreakdown: components,
    summary,
    cbaRuleNote: STANDARD_CBA_RULE_NOTE,
  };
}

export function simulateInsuranceCapCredit(
  profile: ContractInsuranceProfile,
  gamesMissed: number,
  policyCoveragePct: number
): InsuranceSimulationResult {
  const clampedGames = Math.max(0, Math.min(17, gamesMissed));
  const clampedCoverage = Math.max(0, Math.min(1, policyCoveragePct));
  const seasonFraction = clampedGames / 17;

  const projectedNextYearCapCredit = roundCap(
    profile.maxFullSeasonCapCredit * seasonFraction * clampedCoverage
  );
  const projectedCashReimbursement = roundCap(
    profile.maxInsurablePool2026 * seasonFraction * clampedCoverage
  );
  const estimatedOwnerPremium = roundCap(
    profile.maxInsurablePool2026 * clampedCoverage * 0.035
  );

  return {
    gamesMissed: clampedGames,
    policyCoveragePct: clampedCoverage,
    projectedNextYearCapCredit,
    projectedCashReimbursement,
    estimatedOwnerPremium,
  };
}

export function evaluateTeamInsuranceOverview(
  teamState: DerivedTeamCapState
): TeamInsuranceOverview {
  const evaluated = teamState.roster.map((player) => ({
    player,
    profile: evaluatePlayerContractInsurance(player),
  }));

  const documentedClauses = evaluated.filter(
    (e) => e.profile.tier === 'DOCUMENTED_CLAUSE'
  );
  const primeInsurable = evaluated
    .filter((e) => e.profile.tier === 'PRIME_INSURABLE')
    .sort(
      (a, b) =>
        b.profile.maxFullSeasonCapCredit - a.profile.maxFullSeasonCapCredit
    );

  const allTracked = [
    ...documentedClauses,
    ...primeInsurable,
    ...evaluated
      .filter((e) => e.profile.tier === 'MODERATE_INSURABLE')
      .sort(
        (a, b) =>
          b.profile.maxFullSeasonCapCredit - a.profile.maxFullSeasonCapCredit
      ),
  ];

  const primaryGroup = [...documentedClauses, ...primeInsurable];
  const totalInsurablePool2026 = roundCap(
    primaryGroup.reduce((sum, e) => sum + e.profile.maxInsurablePool2026, 0)
  );
  const totalMaxPotentialCapCredit = roundCap(
    primaryGroup.reduce((sum, e) => sum + e.profile.maxFullSeasonCapCredit, 0)
  );

  let voidYearContractsCount = 0;
  let totalVoidGhostBills = 0;
  let cutRiskContractsCount = 0;

  for (const player of teamState.roster) {
    let hasVoid = false;
    let hasCutRisk = false;
    for (const yr of LEAGUE_YEARS) {
      const cy = player.contractYears[yr];
      if (!cy) continue;
      if (cy.isVoidYear && cy.proratedBonus > 0) {
        hasVoid = true;
        totalVoidGhostBills += cy.proratedBonus;
      }
      if (!cy.isVoidYear && yr >= 2027 && cy.baseSalary >= 6 && cy.guaranteedSalary === 0) {
        hasCutRisk = true;
      }
    }
    if (hasVoid) voidYearContractsCount += 1;
    if (hasCutRisk) cutRiskContractsCount += 1;
  }

  return {
    documentedClauses,
    primeInsurable,
    allTracked,
    totalInsurablePool2026,
    totalMaxPotentialCapCredit,
    voidYearContractsCount,
    totalVoidGhostBills: roundCap(totalVoidGhostBills),
    cutRiskContractsCount,
  };
}
