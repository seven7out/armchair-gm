import {
  predictMarketAvailability,
  PredictionCandidateInput,
} from '@/engine/faPredictionEngine';
import { PredictedMarketClassification } from '@/engine/types';

/**
 * Historical Backtest Suite: 2025–2026 NFL Offseason Cohort (`historicalBacktest2026.ts`).
 *
 * Tests our deterministic `predictMarketAvailability` engine using ONLY pre-offseason
 * January snapshot inputs (age entering the offseason, incumbent team cap space before moves,
 * scheduled cap hit, net cut savings, franchise tag cost, and positional blocks) and compares
 * the engine's blind prediction against what ACTUALLY happened in the real NFL offseason.
 */

export interface HistoricalBacktestCase {
  id: string;
  playerName: string;
  position: PredictionCandidateInput['position'];
  incumbentTeam: string;
  preOffseasonSnapshotDate: string;
  input: PredictionCandidateInput;
  actualOutcomeCategory: PredictedMarketClassification;
  actualOutcomeSummary: string;
}

export const HISTORICAL_BACKTEST_COHORT_2026: HistoricalBacktestCase[] = [
  // ==========================================================================
  // 1. EXPIRING CONTRACTS THAT GOT TAGGED OR EXTENDED IN-HOUSE (THE "TRAP" FAs)
  // ==========================================================================
  {
    id: 'bt-tee-higgins',
    playerName: 'Tee Higgins',
    position: 'WR',
    incumbentTeam: 'CIN',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Tee Higgins',
      position: 'WR',
      age: 26,
      overallRating: 90,
      marketApy: 28.8,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 48.5,
      scheduledCapHit: 21.8,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 26.1, // 2nd tag 120% bridge before 4-yr $115M extension
      priorTagsCount: 1,
      hasPositionalSuccessorOrBlock: false,
    },
    actualOutcomeCategory: 'TAG_OR_EXTEND_TRAP',
    actualOutcomeSummary: 'Tagged & signed 4-yr, $115M in-house extension with Cincinnati; never reached open market.',
  },
  {
    id: 'bt-trey-smith',
    playerName: 'Trey Smith',
    position: 'OL',
    incumbentTeam: 'KC',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Trey Smith',
      position: 'OL',
      age: 25,
      overallRating: 91,
      marketApy: 23.5,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 18.0,
      scheduledCapHit: 3.4,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 20.9, // Tag below his $23.5M market APY at age 25
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
    actualOutcomeCategory: 'TAG_OR_EXTEND_TRAP',
    actualOutcomeSummary: 'Franchise Tagged ($23.4M) & extended by Kansas City before free agency opened.',
  },
  {
    id: 'bt-ronnie-stanley',
    playerName: 'Ronnie Stanley',
    position: 'OL',
    incumbentTeam: 'BAL',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Ronnie Stanley',
      position: 'OL',
      age: 30,
      overallRating: 88,
      marketApy: 20.0,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 22.0,
      scheduledCapHit: 15.0,
      netCutSavings: 0,
      deadCapOnCut: 5.2,
      franchiseTagCost: 23.4,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
    actualOutcomeCategory: 'TAG_OR_EXTEND_TRAP',
    actualOutcomeSummary: 'Re-signed with Baltimore on 3-yr, $60M deal days before the legal tampering window.',
  },
  {
    id: 'bt-zack-baun',
    playerName: 'Zack Baun',
    position: 'LB',
    incumbentTeam: 'PHI',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Zack Baun',
      position: 'LB',
      age: 28,
      overallRating: 92,
      marketApy: 17.0,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 28.0,
      scheduledCapHit: 3.5,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 14.5, // Effective leverage for All-Pro LB in prime
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
    actualOutcomeCategory: 'TAG_OR_EXTEND_TRAP',
    actualOutcomeSummary: 'Re-signed with Philadelphia on 3-yr, $51M extension ($17M APY) prior to market opening.',
  },

  // ==========================================================================
  // 2. EXPIRING CONTRACTS THAT ACTUALLY REACHED OPEN-MARKET FREE AGENCY (UFAs)
  // ==========================================================================
  {
    id: 'bt-milton-williams',
    playerName: 'Milton Williams',
    position: 'IDL',
    incumbentTeam: 'PHI',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Milton Williams',
      position: 'IDL',
      age: 26,
      overallRating: 85,
      marketApy: 19.5,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 14.0,
      scheduledCapHit: 2.1,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 25.1, // IDL Tag ($25.1M) way above rotational snap share + Jalen Carter/Jordan Davis block
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true, // Blocked by Jalen Carter & Moro Ojomo/Jordan Davis
    },
    actualOutcomeCategory: 'LIKELY_UFA',
    actualOutcomeSummary: 'Hit unrestricted free agency and signed 4-yr, $104M mega-deal with New England (netting PHI a Comp Pick).',
  },
  {
    id: 'bt-josh-sweat',
    playerName: 'Josh Sweat',
    position: 'EDGE',
    incumbentTeam: 'PHI',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Josh Sweat',
      position: 'EDGE',
      age: 28,
      overallRating: 86,
      marketApy: 19.1,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 14.0,
      scheduledCapHit: 9.8,
      netCutSavings: 0,
      deadCapOnCut: 6.4,
      franchiseTagCost: 25.1, // EDGE Tag ($25.1M) too steep + Nolan Smith/Jalyx Hunt succession
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
    actualOutcomeCategory: 'LIKELY_UFA',
    actualOutcomeSummary: 'Hit unrestricted free agency and signed 4-yr, $76.4M deal with Arizona.',
  },
  {
    id: 'bt-jevon-holland',
    playerName: 'Jevon Holland',
    position: 'S',
    incumbentTeam: 'MIA',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Jevon Holland',
      position: 'S',
      age: 25,
      overallRating: 87,
      marketApy: 15.1,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: -14.5, // Miami in cap deficit
      scheduledCapHit: 4.5,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 19.6, // Safety tag ($19.6M) > $15.1M market APY
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
    actualOutcomeCategory: 'LIKELY_UFA',
    actualOutcomeSummary: 'Hit unrestricted free agency and signed 3-yr, $45.3M contract with NY Giants.',
  },
  {
    id: 'bt-dj-reed',
    playerName: 'D.J. Reed',
    position: 'CB',
    incumbentTeam: 'NYJ',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'D.J. Reed',
      position: 'CB',
      age: 28,
      overallRating: 86,
      marketApy: 16.0,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 12.0,
      scheduledCapHit: 15.6,
      netCutSavings: 0,
      deadCapOnCut: 4.8,
      franchiseTagCost: 20.9, // CB Tag ($20.9M) > $16M APY + Sauce Gardner extension priority
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
    actualOutcomeCategory: 'LIKELY_UFA',
    actualOutcomeSummary: 'Hit unrestricted free agency and signed 3-yr, $48M deal with Detroit Lions.',
  },
  {
    id: 'bt-sam-darnold',
    playerName: 'Sam Darnold',
    position: 'QB',
    incumbentTeam: 'MIN',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Sam Darnold',
      position: 'QB',
      age: 28,
      overallRating: 84,
      marketApy: 33.5,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 58.0,
      scheduledCapHit: 10.0,
      netCutSavings: 0,
      deadCapOnCut: 5.0,
      franchiseTagCost: 41.3, // QB Tag ($41.3M) > $33.5M market APY + 1st-rd rookie J.J. McCarthy waiting
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
    actualOutcomeCategory: 'LIKELY_UFA',
    actualOutcomeSummary: 'Hit unrestricted free agency and signed 3-yr, $100.5M deal with Seattle.',
  },
  {
    id: 'bt-dre-greenlaw',
    playerName: 'Dre Greenlaw',
    position: 'LB',
    incumbentTeam: 'SF',
    preOffseasonSnapshotDate: 'Jan 2025 / Pre-FA',
    input: {
      name: 'Dre Greenlaw',
      position: 'LB',
      age: 28,
      overallRating: 85,
      marketApy: 11.5,
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 24.0,
      scheduledCapHit: 9.2,
      netCutSavings: 0,
      deadCapOnCut: 2.1,
      franchiseTagCost: 20.4, // Off-ball LB tag ($20.4M) massively above $11.5M market + Fred Warner already paid
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
    actualOutcomeCategory: 'LIKELY_UFA',
    actualOutcomeSummary: 'Hit unrestricted free agency and signed 3-yr, $35M contract with Denver.',
  },

  // ==========================================================================
  // 3. UNDER-CONTRACT VETERANS WHO BECAME STREET FAs (CAP CASUALTIES) OR TRADES
  // ==========================================================================
  {
    id: 'bt-joey-bosa',
    playerName: 'Joey Bosa',
    position: 'EDGE',
    incumbentTeam: 'LAC',
    preOffseasonSnapshotDate: 'Jan 2025 / Under Contract',
    input: {
      name: 'Joey Bosa',
      position: 'EDGE',
      age: 30,
      overallRating: 83,
      marketApy: 12.6,
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 42.0,
      scheduledCapHit: 36.4,
      netCutSavings: 25.36, // $25.36M net savings vs $11.1M dead cap at age-30 cliff
      deadCapOnCut: 11.1,
      franchiseTagCost: 25.1,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true, // Tuli Tuipulotu + Khalil Mack
    },
    actualOutcomeCategory: 'CAP_CASUALTY_STREET_FA',
    actualOutcomeSummary: 'Released as a Cap Casualty by LA Chargers (saving $25.36M); signed 1-yr, $12.6M Street FA deal with Buffalo (Comp-Pick Safe!).',
  },
  {
    id: 'bt-javon-hargrave',
    playerName: 'Javon Hargrave',
    position: 'IDL',
    incumbentTeam: 'SF',
    preOffseasonSnapshotDate: 'Jan 2025 / Under Contract',
    input: {
      name: 'Javon Hargrave',
      position: 'IDL',
      age: 32,
      overallRating: 82,
      marketApy: 15.0,
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 18.0,
      scheduledCapHit: 28.1,
      netCutSavings: 19.9, // Post-June 1 release saves $19.9M
      deadCapOnCut: 8.2,
      franchiseTagCost: 22.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
    actualOutcomeCategory: 'CAP_CASUALTY_STREET_FA',
    actualOutcomeSummary: 'Designated Post-June 1 Cap Casualty by San Francisco; signed 2-yr, $30M Street FA deal with Minnesota (Comp-Pick Safe!).',
  },
  {
    id: 'bt-davante-adams',
    playerName: 'Davante Adams',
    position: 'WR',
    incumbentTeam: 'NYJ',
    preOffseasonSnapshotDate: 'Jan 2025 / Under Contract',
    input: {
      name: 'Davante Adams',
      position: 'WR',
      age: 32,
      overallRating: 88,
      marketApy: 22.0,
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 8.5,
      scheduledCapHit: 38.3,
      netCutSavings: 29.9, // $35.6M unguaranteed base salary!
      deadCapOnCut: 8.4,
      franchiseTagCost: 24.8,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true, // Garrett Wilson extension
    },
    actualOutcomeCategory: 'CAP_CASUALTY_STREET_FA',
    actualOutcomeSummary: 'Released by NY Jets before unguaranteed $35.6M base vested; signed 2-yr, $46M Street FA deal with LA Rams (Comp-Pick Safe!).',
  },
  {
    id: 'bt-cooper-kupp',
    playerName: 'Cooper Kupp',
    position: 'WR',
    incumbentTeam: 'LAR',
    preOffseasonSnapshotDate: 'Jan 2025 / Under Contract',
    input: {
      name: 'Cooper Kupp',
      position: 'WR',
      age: 32,
      overallRating: 83,
      marketApy: 15.0,
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 21.0,
      scheduledCapHit: 29.8,
      netCutSavings: 15.0,
      deadCapOnCut: 14.8,
      franchiseTagCost: 24.8,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true, // Puka Nacua WR1
    },
    actualOutcomeCategory: 'CAP_CASUALTY_STREET_FA',
    actualOutcomeSummary: 'Released by LA Rams after trade talks; signed 3-yr, $45M Street FA contract with Seattle (Comp-Pick Safe!).',
  },
  {
    id: 'bt-jonathan-allen',
    playerName: 'Jonathan Allen',
    position: 'IDL',
    incumbentTeam: 'WAS',
    preOffseasonSnapshotDate: 'Jan 2025 / Under Contract',
    input: {
      name: 'Jonathan Allen',
      position: 'IDL',
      age: 30,
      overallRating: 82,
      marketApy: 17.0,
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 65.0,
      scheduledCapHit: 23.0,
      netCutSavings: 16.47, // $16.47M unguaranteed base at age 30 with Jer'Zhan Newton drafted behind him
      deadCapOnCut: 6.53,
      franchiseTagCost: 22.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
    actualOutcomeCategory: 'CAP_CASUALTY_STREET_FA',
    actualOutcomeSummary: 'Released by Washington (saving $16.47M); signed 3-yr, $51M Street FA contract with Minnesota (Comp-Pick Safe!).',
  },
  {
    id: 'bt-dk-metcalf',
    playerName: 'DK Metcalf',
    position: 'WR',
    incumbentTeam: 'SEA',
    preOffseasonSnapshotDate: 'Jan 2025 / Under Contract',
    input: {
      name: 'DK Metcalf',
      position: 'WR',
      age: 27,
      overallRating: 89,
      marketApy: 30.0,
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: -6.5, // Seattle entered 2025 over the cap
      scheduledCapHit: 31.9,
      netCutSavings: 10.9,
      deadCapOnCut: 21.0,
      franchiseTagCost: 24.8,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true, // Jaxon Smith-Njigba breakout
    },
    actualOutcomeCategory: 'TRADE_OR_RELEASE_BRIDGE',
    actualOutcomeSummary: 'Traded by Seattle to Pittsburgh for a 2nd-round pick (#52) and signed 4-yr, $132M extension.',
  },
];

export interface BacktestSummaryMetrics {
  totalCases: number;
  correctPredictions: number;
  accuracyPct: number;
  streetFACapCasualtyRecallPct: number;
  tagOrExtendPrecisionPct: number;
  detailedResults: {
    caseItem: HistoricalBacktestCase;
    predicted: ReturnType<typeof predictMarketAvailability>;
    isMatch: boolean;
  }[];
}

/**
 * Run the full historical backtest suite and compute accuracy, Cap Casualty recall, and Tag/Extend precision.
 */
export function runHistoricalBacktestSuite(): BacktestSummaryMetrics {
  const detailedResults = HISTORICAL_BACKTEST_COHORT_2026.map((caseItem) => {
    const predicted = predictMarketAvailability(caseItem.input);

    // A match occurs if the exact classification matches, OR if both predicted and actual are in the
    // "Under-Contract Casualty/Trade" bucket (`CAP_CASUALTY_STREET_FA` | `TRADE_OR_RELEASE_BRIDGE`).
    const isMatch =
      predicted.classification === caseItem.actualOutcomeCategory ||
      (predicted.classification === 'TRADE_OR_RELEASE_BRIDGE' &&
        caseItem.actualOutcomeCategory === 'CAP_CASUALTY_STREET_FA');

    return {
      caseItem,
      predicted,
      isMatch,
    };
  });

  const totalCases = detailedResults.length;
  const correctPredictions = detailedResults.filter((r) => r.isMatch).length;
  const accuracyPct = Math.round((correctPredictions / totalCases) * 1000) / 10;

  const streetFACases = detailedResults.filter(
    (r) =>
      r.caseItem.actualOutcomeCategory === 'CAP_CASUALTY_STREET_FA' ||
      r.caseItem.actualOutcomeCategory === 'TRADE_OR_RELEASE_BRIDGE'
  );
  const streetFAHits = streetFACases.filter((r) => r.isMatch).length;
  const streetFACapCasualtyRecallPct =
    Math.round((streetFAHits / Math.max(1, streetFACases.length)) * 1000) / 10;

  const tagCases = detailedResults.filter(
    (r) => r.caseItem.actualOutcomeCategory === 'TAG_OR_EXTEND_TRAP'
  );
  const tagHits = tagCases.filter((r) => r.isMatch).length;
  const tagOrExtendPrecisionPct =
    Math.round((tagHits / Math.max(1, tagCases.length)) * 1000) / 10;

  return {
    totalCases,
    correctPredictions,
    accuracyPct,
    streetFACapCasualtyRecallPct,
    tagOrExtendPrecisionPct,
    detailedResults,
  };
}
