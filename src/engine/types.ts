/**
 * Pure TypeScript Domain Types for Armchair GM
 * Structured to map cleanly to nflverse (Over The Cap + draft picks) schemas.
 * All dollar figures are expressed in Millions ($M), e.g., 301.2 = $301,200,000.
 */

export type LeagueYear = 2026 | 2027 | 2028 | 2029;

export const LEAGUE_YEARS: readonly LeagueYear[] = [2026, 2027, 2028, 2029] as const;

export type PositionGroup =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'EDGE'
  | 'IDL'
  | 'LB'
  | 'CB'
  | 'S'
  | 'ST';

export const POSITION_GROUPS: readonly PositionGroup[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'EDGE',
  'IDL',
  'LB',
  'CB',
  'S',
  'ST',
] as const;

export type PlayerTier = 'Elite' | 'Starter' | 'Rotation' | 'Depth' | 'Rookie';

export type AgingStatus = 'Ascent' | 'Prime' | 'CliffWarning' | 'Decline';

export type ContractStructureTemplate = 'Flat' | 'Backloaded' | 'FrontLoaded' | 'VoidHeavy';

export interface ContractYear {
  year: LeagueYear;
  baseSalary: number;           // P5 Base Salary ($M)
  guaranteedSalary: number;     // Portion of baseSalary guaranteed ($M)
  proratedBonus: number;        // Signing + option bonus proration for this year ($M)
  rosterBonus: number;          // Roster bonus ($M)
  workoutBonus: number;         // Workout bonus ($M)
  isVoidYear: boolean;          // True if contract year exists only to hold bonus proration
  isFifthYearOption?: boolean;  // True for Round 1 5th-year option
}

export interface Player {
  id: string;                   // Maps to nflverse gsis_id / otc_id
  name: string;
  position: PositionGroup;
  ageIn2026: number;
  tier: PlayerTier;
  overallRating: number;        // 60-99 scale
  accruedSeasons: number;       // Used to compute exact CBA Veteran Minimum floor
  draftRound?: number;
  draftPick?: number;
  isRookieContract?: boolean;
  fifthYearOptionExercised?: boolean;
  notes?: string;
  contractYears: Record<LeagueYear, ContractYear | null>;
}

export interface DeadCapEntry {
  id: string;
  playerId: string;
  playerName: string;
  position: PositionGroup;
  reason: string;               // e.g., 'Pre-June 1 Cut', 'Post-June 1 Cut', 'Trade', 'Void Acceleration', 'Prior Dead Money'
  amountsByYear: Record<LeagueYear, number>;
}

export interface DraftPick {
  id: string;
  year: LeagueYear;
  round: number;                // 1 - 7
  overallPick: number;          // 1 - 262
  originalTeamId: string;
  currentTeamId: string;
  selectedPlayerName?: string;
  selectedPosition?: PositionGroup;
}

export interface FreeAgentTarget {
  id: string;
  name: string;
  position: PositionGroup;
  ageIn2026: number;
  tier: PlayerTier;
  overallRating: number;
  accruedSeasons: number;
  previousTeam: string;
  marketApy: number;            // Expected Annual Value ($M)
  marketYears: number;          // Expected Contract Length (1-4)
  marketGuaranteedPct: number;  // Expected % of total deal guaranteed (0-1)
  scoutingNote: string;
}

export interface TradePartnerTeam {
  id: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  availablePlayers: Player[];
  availablePicks: DraftPick[];
}

// ============================================================================
// Reversible Scenario Stack Transactions
// ============================================================================

export type TransactionType =
  | 'PRE_JUNE_1_CUT'
  | 'POST_JUNE_1_CUT'
  | 'RESTRUCTURE'
  | 'EXTENSION'
  | 'SIGN_FA'
  | 'TRADE'
  | 'DRAFT_SIGNING'
  | 'FIFTH_YEAR_OPTION';

export interface BaseTransaction {
  id: string;
  type: TransactionType;
  timestamp: number;
  enabled: boolean;
  actionYear: LeagueYear;
  label: string;
  sublabel: string;
  capDelta2026: number;         // Quick summary of 2026 impact for Scenario Stack badge
}

export interface CutTransaction extends BaseTransaction {
  type: 'PRE_JUNE_1_CUT' | 'POST_JUNE_1_CUT';
  playerId: string;
  playerName: string;
  position: PositionGroup;
}

export interface RestructureTransaction extends BaseTransaction {
  type: 'RESTRUCTURE';
  playerId: string;
  playerName: string;
  position: PositionGroup;
  convertPercentage: number;    // 0.10 to 1.00 of restructurable salary
  addVoidYears: number;         // 0 to 2 additional void years within 2026-2029 horizon
}

export interface ExtensionTransaction extends BaseTransaction {
  type: 'EXTENSION';
  playerId: string;
  playerName: string;
  position: PositionGroup;
  newYearsAdded: number;        // 1 to 3 years added
  apy: number;                  // New money APY ($M)
  guaranteedPct: number;        // 0 to 0.85
  structure: ContractStructureTemplate;
}

export interface SignFATransaction extends BaseTransaction {
  type: 'SIGN_FA';
  freeAgent: FreeAgentTarget;
  years: number;                // 1 to 4 years
  apy: number;                  // Annual average value ($M)
  guaranteedPct: number;        // 0 to 0.85
  structure: ContractStructureTemplate;
}

export interface TradeTransaction extends BaseTransaction {
  type: 'TRADE';
  partnerTeamId: string;
  partnerTeamName: string;
  designation: 'PRE_JUNE_1' | 'POST_JUNE_1';
  outgoingPlayerIds: string[];
  incomingPlayers: Player[];
  outgoingPickIds: string[];
  incomingPicks: DraftPick[];
  tradeValueSent: number;
  tradeValueReceived: number;
}

export interface DraftSigningTransaction extends BaseTransaction {
  type: 'DRAFT_SIGNING';
  pickId: string;
  overallPick: number;
  round: number;
  prospectName: string;
  position: PositionGroup;
}

export interface FifthYearOptionTransaction extends BaseTransaction {
  type: 'FIFTH_YEAR_OPTION';
  playerId: string;
  playerName: string;
  position: PositionGroup;
  optionAmount: number;
}

export type Transaction =
  | CutTransaction
  | RestructureTransaction
  | ExtensionTransaction
  | SignFATransaction
  | TradeTransaction
  | DraftSigningTransaction
  | FifthYearOptionTransaction;

// ============================================================================
// Derived Cap State Interfaces
// ============================================================================

export interface YearCapBreakdown {
  year: LeagueYear;
  baseLeagueCap: number;        // e.g. $301.2M in 2026, growing ~7.5%/yr
  rolloverFromPriorYear: number;// Carryover cap space
  adjustedCapCeiling: number;   // baseLeagueCap + rolloverFromPriorYear
  activeTop51Cap: number;       // Sum of top 51 non-void cap hits (padded with min contracts if < 51)
  allRosterCap: number;         // Sum of all active contracts
  deadMoneyTotal: number;       // Pre-existing dead cap + cut/trade/void accelerations
  rookiePoolReserve: number;    // Gross cost of unsigned draft picks; net displacement cost
  netRookiePoolImpact: number;  // Rookie pool after displacing 51st minimum slots
  totalCapCommitments: number;  // activeTop51Cap + deadMoneyTotal + netRookiePoolImpact
  effectiveCapSpace: number;    // adjustedCapCeiling - totalCapCommitments
  replacementLevelCutoff: number;// Cap hit of the 51st player (used for net marginal FA/Draft math)
  activeRosterCount: number;    // Count of players with non-void contract in this year
  topPositionAllocation: {
    position: PositionGroup;
    capSpend: number;
    pctOfCap: number;
  }[];
}

export interface TeamSeedData {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  archetypeLabel: string;
  archetypeDescription: string;
  primaryColor: string;
  secondaryColor: string;
  initialRollover2026: number;  // Rollover carried from 2025 into 2026 ($M)
  priorDeadMoney: DeadCapEntry[];
  roster: Player[];
  draftPicks: DraftPick[];
}

export interface DerivedTeamCapState {
  teamId: string;
  teamName: string;
  capGrowthRate: number;        // Default 0.075 (7.5% annual cap growth)
  roster: Player[];
  deadCapLedger: DeadCapEntry[];
  draftPicks: DraftPick[];
  years: Record<LeagueYear, YearCapBreakdown>;
}
