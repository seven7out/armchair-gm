/**
 * Pure TypeScript Domain Types for Armchair GM (v2)
 * Includes Free Agent Availability & Cap Casualty Prediction schemas,
 * Compensatory Pick Cancellation tracking, Franchise/Transition Tags,
 * and Positional Market Comps.
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
  isFranchiseTag?: boolean;     // True if playing on Franchise or Transition Tag
}

export interface Player {
  id: string;                   // Maps to nflverse gsis_id / otc_id
  name: string;
  position: PositionGroup;
  ageIn2026: number;
  tier: PlayerTier;
  overallRating: number;        // 60-99 scale
  accruedSeasons: number;       // Used to compute exact CBA Veteran Minimum floor
  headshotUrl?: string | null;  // Official ESPN / NFL.com player headshot URL
  draftRound?: number | null;
  draftPick?: number | null;
  isRookieContract?: boolean;
  fifthYearOptionExercised?: boolean;
  priorTagsCount?: number;      // Number of prior Franchise Tags (triggers 120% or 144% escalation)
  notes?: string;
  contractYears: Record<LeagueYear, ContractYear | null>;
}

export interface DeadCapEntry {
  id: string;
  playerId: string;
  playerName: string;
  position: PositionGroup;
  reason: string;
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

// ============================================================================
// v2 Free Agent Availability & Cap Casualty Predictor Types
// ============================================================================

export type FreeAgentOriginType =
  | 'EXPIRING_CONTRACT'         // Standard UFA whose contract expires
  | 'UNDER_CONTRACT_VETERAN';   // Currently under contract; evaluated for Cap Casualty / Street FA release

export type PredictedMarketClassification =
  | 'LIKELY_UFA'                // >= 60% probability of hitting open market as standard UFA
  | 'CAP_CASUALTY_STREET_FA'    // High probability of being cut (Street FA — does NOT cost a Comp Pick!)
  | 'TAG_OR_EXTEND_TRAP'        // < 45% market availability (likely Franchise Tagged or Extended in-house)
  | 'TRADE_OR_RELEASE_BRIDGE';  // Productive starter on unguaranteed high base salary; prime March trade/cut target

export interface FreeAgentPredictionFeatures {
  originType: FreeAgentOriginType;
  incumbentTeamCapSpace: number;        // Incumbent team's effective cap space ($M)
  scheduledCapHit: number;              // Scheduled cap hit if under contract, or prior cap hit ($M)
  netCutSavings: number;                // Cap savings if released by incumbent team ($M)
  deadCapOnCut: number;                 // Dead cap left behind if released ($M)
  franchiseTagCost: number;             // Projected 1-year Franchise Tag cost ($M)
  priorTagsCount: number;               // 0, 1 (120% escalator), or 2 (144% prohibitive escalator)
  hasPositionalSuccessorOrBlock: boolean;// True if incumbent team already paid another star at this position
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
  headshotUrl?: string | null;
  marketApy: number;            // Expected Annual Value ($M)
  marketYears: number;          // Expected Contract Length (1-4)
  marketGuaranteedPct: number;  // Expected % of total deal guaranteed (0-1)
  scoutingNote: string;
  predictionFeatures: FreeAgentPredictionFeatures;
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
  | 'FIFTH_YEAR_OPTION'
  | 'FRANCHISE_TAG';

export interface BaseTransaction {
  id: string;
  type: TransactionType;
  timestamp: number;
  enabled: boolean;
  actionYear: LeagueYear;
  label: string;
  sublabel: string;
  capDelta2026: number;
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
  convertPercentage: number;
  addVoidYears: number;
}

export interface ExtensionTransaction extends BaseTransaction {
  type: 'EXTENSION';
  playerId: string;
  playerName: string;
  position: PositionGroup;
  newYearsAdded: number;
  apy: number;
  guaranteedPct: number;
  structure: ContractStructureTemplate;
}

export interface SignFATransaction extends BaseTransaction {
  type: 'SIGN_FA';
  freeAgent: FreeAgentTarget;
  years: number;
  apy: number;
  guaranteedPct: number;
  structure: ContractStructureTemplate;
  countsTowardCompPickFormula: boolean;
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

export interface FranchiseTagTransaction extends BaseTransaction {
  type: 'FRANCHISE_TAG';
  playerId: string;
  playerName: string;
  position: PositionGroup;
  tagType: 'NON_EXCLUSIVE_FRANCHISE' | 'TRANSITION';
  tagSalary: number;
}

export type Transaction =
  | CutTransaction
  | RestructureTransaction
  | ExtensionTransaction
  | SignFATransaction
  | TradeTransaction
  | DraftSigningTransaction
  | FifthYearOptionTransaction
  | FranchiseTagTransaction;

// ============================================================================
// Derived Cap State Interfaces
// ============================================================================

export interface CompPickTrackerSummary {
  cfaQualifyingLosses: { name: string; position: PositionGroup; estApy: number; projectedRound: number }[];
  cfaQualifyingSignings: { name: string; position: PositionGroup; apy: number }[];
  streetFASigningsCount: number;        // Cap casualties signed (Comp-Pick Safe!)
  netProjectedCompPicks: string[];      // e.g. ['2027 Rd 4 Comp', '2027 Rd 5 Comp']
  postJune1DesignationsUsed: number;    // CBA max 2 per offseason
}

export interface YearCapBreakdown {
  year: LeagueYear;
  baseLeagueCap: number;
  rolloverFromPriorYear: number;
  adjustedCapCeiling: number;
  activeTop51Cap: number;
  allRosterCap: number;
  totalCashSpend: number;               // Owner's actual cash outlay in this year ($M)
  deadMoneyTotal: number;
  rookiePoolReserve: number;
  netRookiePoolImpact: number;
  totalCapCommitments: number;
  effectiveCapSpace: number;
  replacementLevelCutoff: number;
  activeRosterCount: number;
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
  division?: string;
  logoUrl?: string;
  archetypeLabel: string;
  archetypeDescription: string;
  primaryColor: string;
  secondaryColor: string;
  initialRollover2026: number;
  priorDeadMoney: DeadCapEntry[];
  departingCfaLosses?: { name: string; position: PositionGroup; estApy: number; projectedRound: number }[];
  roster: Player[];
  draftPicks: DraftPick[];
}

export interface DerivedTeamCapState {
  teamId: string;
  teamName: string;
  capGrowthRate: number;
  roster: Player[];
  deadCapLedger: DeadCapEntry[];
  draftPicks: DraftPick[];
  compPickSummary: CompPickTrackerSummary;
  years: Record<LeagueYear, YearCapBreakdown>;
}
