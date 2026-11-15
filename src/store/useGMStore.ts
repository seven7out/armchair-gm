'use client';

import { create } from 'zustand';
import {
  applyPlayerExtension,
  CapCalculationMode,
  computeDerivedTeamCapState,
  ContractStructureTemplate,
  createSignedFreeAgentPlayer,
  DEFAULT_CAP_GROWTH_RATE,
  DerivedTeamCapState,
  evaluateFreeAgentTarget,
  evaluateRosterPlayerFate,
  FreeAgentTarget,
  getContractYearCapHit,
  LeagueYear,
  Player,
  PositionGroup,
  roundCap,
  simulateCutOrTrade,
  simulateRestructure,
  TeamSeedData,
  Transaction,
} from '@/engine';
import {
  getLeagueWideFreeAgentPool,
  getTeamInternalFreeAgents,
} from '@/data/seed/freeAgents';
import { SEED_TEAMS } from '@/data/seed/teams';

export type ActiveTab =
  | 'player-fate'
  | 'team-builder'
  | 'cap-checkup'
  | 'free-agency'
  | 'draft'
  | 'matrix'
  | 'predictor';

export type TeamBuilderSubTab =
  | 'fa-dock'
  | 'cap-fixes'
  | 'draft-trade'
  | 'ledger';

interface GMStoreState {
  selectedTeamId: string;
  baseTeam: TeamSeedData;
  capGrowthRate: number;
  capCalculationMode: CapCalculationMode;
  compareOriginalBaseline: boolean;
  transactions: Transaction[];
  baselineState: DerivedTeamCapState;
  derivedState: DerivedTeamCapState;

  // UI Navigation & Drawers
  activeTab: ActiveTab;
  teamBuilderSubTab: TeamBuilderSubTab;
  teamBuilderPosFilter: PositionGroup | 'ALL';
  navHistory: ActiveTab[];
  ledgerMode: 'CAP' | 'CASH';
  selectedPlayerId: string | null;
  initialDrawerTab: 'cut' | 'restructure' | 'extend' | 'trade' | null;
  initialActionYear: LeagueYear | null;
  preselectedFreeAgentId: string | null;
  freeAgencyPositionFilter: PositionGroup | 'ALL';
  isScenarioDrawerOpen: boolean;
  isFreeAgencyModalOpen: boolean;
  dossierPlayer: { player: Player; teamId: string } | null;
  positionFilter: PositionGroup | 'ALL';
  searchQuery: string;

  // Actions
  selectTeam: (teamId: string) => void;
  setCapGrowthRate: (rate: number) => void;
  setCapCalculationMode: (mode: CapCalculationMode) => void;
  setCompareOriginalBaseline: (val: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setTeamBuilderSubTab: (sub: TeamBuilderSubTab) => void;
  setTeamBuilderPosFilter: (pos: PositionGroup | 'ALL') => void;
  openInTeamBuilder: (options?: {
    subTab?: TeamBuilderSubTab;
    position?: PositionGroup | 'ALL';
    playerId?: string | null;
    drawerTab?: 'cut' | 'restructure' | 'extend' | 'trade' | null;
    actionYear?: LeagueYear | null;
  }) => void;
  goBack: () => void;
  goHome: () => void;
  setLedgerMode: (mode: 'CAP' | 'CASH') => void;
  selectPlayer: (
    playerId: string | null,
    initialTab?: 'cut' | 'restructure' | 'extend' | 'trade' | null,
    initialActionYear?: LeagueYear | null
  ) => void;
  openPlayerDossier: (player: Player, teamId?: string) => void;
  closePlayerDossier: () => void;
  openFreeAgencyModal: (options?: {
    freeAgentId?: string | null;
    position?: PositionGroup | 'ALL';
  }) => void;
  applyMaxTopRestructures: () => void;
  applyAutoCapReliefPlaybook: () => void;
  applyExtendCorePillarsPlaybook: () => void;
  hydrateScenarioFromUrlSearch: (search: string) => void;
  setScenarioDrawerOpen: (open: boolean) => void;
  setFreeAgencyModalOpen: (open: boolean) => void;
  setPositionFilter: (pos: PositionGroup | 'ALL') => void;
  setSearchQuery: (q: string) => void;

  // Scenario Stack Transaction Dispatchers
  addCutTransaction: (
    player: Player,
    mode: 'PRE_JUNE_1_CUT' | 'POST_JUNE_1_CUT',
    actionYear?: LeagueYear
  ) => void;
  addRestructureTransaction: (
    player: Player,
    convertPercentage: number,
    addVoidYears: number,
    actionYear?: LeagueYear
  ) => void;
  addExtensionTransaction: (
    player: Player,
    newYearsAdded: number,
    apy: number,
    guaranteedPct: number,
    structure: ContractStructureTemplate,
    actionYear?: LeagueYear
  ) => void;
  addFranchiseTagTransaction: (
    player: Player,
    tagType: 'NON_EXCLUSIVE_FRANCHISE' | 'TRANSITION',
    tagSalary: number,
    targetYear?: LeagueYear
  ) => void;
  addSignFATransaction: (
    freeAgent: FreeAgentTarget,
    years: number,
    apy: number,
    guaranteedPct: number,
    structure: ContractStructureTemplate
  ) => void;
  addTradeTransaction: (params: {
    partnerTeamId: string;
    partnerTeamName: string;
    designation: 'PRE_JUNE_1' | 'POST_JUNE_1';
    outgoingPlayers: Player[];
    incomingPlayers: Player[];
    outgoingPickIds: string[];
    incomingPicks: import('@/engine').DraftPick[];
    tradeValueSent: number;
    tradeValueReceived: number;
  }) => void;
  addQuickTradeTransaction: (
    player: Player,
    designation?: 'PRE_JUNE_1' | 'POST_JUNE_1',
    actionYear?: LeagueYear
  ) => void;
  addDraftSigningTransaction: (params: {
    pickId: string;
    overallPick: number;
    round: number;
    prospectName: string;
    position: PositionGroup;
  }) => void;
  addFifthYearOptionTransaction: (
    player: Player,
    optionYear: LeagueYear,
    optionAmount: number
  ) => void;

  // Scenario Stack Controls
  toggleTransaction: (txId: string) => void;
  removeTransaction: (txId: string) => void;
  resetScenarioStack: () => void;
}

type CompactScenarioItem =
  | ['cut', 0 | 1, string, LeagueYear]
  | ['res', string, number, number, LeagueYear]
  | ['ext', string, number, number, number, ContractStructureTemplate, LeagueYear]
  | ['tag', string, 0 | 1, number, LeagueYear]
  | ['opt', string, LeagueYear, number]
  | ['fa', string, number, number, number, ContractStructureTemplate]
  | ['dr', string, number, number, string, PositionGroup]
  | ['qtr', string, 0 | 1, LeagueYear];

function nextTxId(suffix = ''): string {
  return `tx-${Date.now()}${suffix}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildCutTx(
  player: Player,
  mode: 'PRE_JUNE_1_CUT' | 'POST_JUNE_1_CUT',
  actionYear: LeagueYear = 2026
): Transaction {
  const sim = simulateCutOrTrade(player, actionYear, mode);
  return {
    id: nextTxId(),
    type: mode,
    timestamp: Date.now(),
    enabled: true,
    actionYear,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    label: `${mode === 'POST_JUNE_1_CUT' ? 'Post-June 1 Cut' : 'Pre-June 1 Cut'}: ${player.name}`,
    sublabel: `${actionYear} Savings: $${sim.currentYearCapSavings.toFixed(2)}M | Dead Cap: $${sim.currentYearDeadCap.toFixed(2)}M${sim.nextYearDeadCap > 0 ? ` (+$${sim.nextYearDeadCap.toFixed(2)}M in ${actionYear + 1})` : ''}`,
    capDelta2026: actionYear === 2026 ? sim.currentYearCapSavings : 0,
  };
}

function buildRestructureTx(
  player: Player,
  convertPercentage: number,
  addVoidYears: number,
  actionYear: LeagueYear = 2026,
  idx = 0
): Transaction {
  const sim = simulateRestructure(player, actionYear, convertPercentage, addVoidYears);
  return {
    id: nextTxId(`-${idx}`),
    type: 'RESTRUCTURE',
    timestamp: Date.now() + idx,
    enabled: true,
    actionYear,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    convertPercentage,
    addVoidYears,
    label: `Restructured ${player.name} (${Math.round(convertPercentage * 100)}%)`,
    sublabel: `Converted $${sim.convertedBonusAmount.toFixed(2)}M over ${sim.prorationYearsCount} yrs (+$${sim.annualProrationAdded.toFixed(2)}M/yr future proration)`,
    capDelta2026: actionYear === 2026 ? sim.currentYearCapSavings : 0,
  };
}

function buildExtensionTx(
  player: Player,
  newYearsAdded: number,
  apy: number,
  guaranteedPct: number,
  structure: ContractStructureTemplate,
  actionYear: LeagueYear = 2026,
  idx = 0
): Transaction {
  const { capDeltaByYear } = applyPlayerExtension(
    player,
    actionYear,
    newYearsAdded,
    apy,
    guaranteedPct,
    structure
  );
  return {
    id: nextTxId(`-${idx}`),
    type: 'EXTENSION',
    timestamp: Date.now() + idx,
    enabled: true,
    actionYear,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    newYearsAdded,
    apy,
    guaranteedPct,
    structure,
    label: `Extended ${player.name} (+${newYearsAdded} yrs @ $${apy.toFixed(1)}M APY)`,
    sublabel: `${structure} structure | ${Math.round(guaranteedPct * 100)}% Guaranteed`,
    capDelta2026: roundCap(-capDeltaByYear[2026]),
  };
}

function buildTagTx(
  player: Player,
  tagType: 'NON_EXCLUSIVE_FRANCHISE' | 'TRANSITION',
  tagSalary: number,
  targetYear: LeagueYear = 2027
): Transaction {
  return {
    id: nextTxId(),
    type: 'FRANCHISE_TAG',
    timestamp: Date.now(),
    enabled: true,
    actionYear: targetYear,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    tagType,
    tagSalary,
    label: `${tagType === 'TRANSITION' ? 'Transition' : 'Franchise'} Tag: ${player.name} (${targetYear})`,
    sublabel: `1-yr fully guaranteed tender @ $${tagSalary.toFixed(2)}M in ${targetYear}`,
    capDelta2026: targetYear === 2026 ? roundCap(-tagSalary) : 0,
  };
}

function buildSignFATx(
  freeAgent: FreeAgentTarget,
  years: number,
  apy: number,
  guaranteedPct: number,
  structure: ContractStructureTemplate,
  teamAbbr: string,
  replacementLevelCutoff: number
): Transaction {
  const signed = createSignedFreeAgentPlayer(
    freeAgent,
    2026,
    years,
    apy,
    guaranteedPct,
    structure
  );
  const hit2026 = getContractYearCapHit(signed.contractYears[2026]);
  const netImpact2026 = roundCap(Math.max(0, hit2026 - replacementLevelCutoff));
  const pred = evaluateFreeAgentTarget(freeAgent);
  const isInternalResign =
    freeAgent.previousTeam.toUpperCase() === teamAbbr.toUpperCase() ||
    freeAgent.id.startsWith('fa-internal-');
  const countsTowardCompPickFormula = isInternalResign
    ? false
    : pred.countsTowardCompFormula;

  return {
    id: nextTxId(),
    type: 'SIGN_FA',
    timestamp: Date.now(),
    enabled: true,
    actionYear: 2026,
    freeAgent,
    years,
    apy,
    guaranteedPct,
    structure,
    countsTowardCompPickFormula,
    label: isInternalResign
      ? `Re-Signed ${freeAgent.name} (${freeAgent.position})`
      : `Signed ${countsTowardCompPickFormula ? 'UFA' : 'Street FA'} ${freeAgent.name} (${freeAgent.position})`,
    sublabel: `${years} yrs, $${(years * apy).toFixed(1)}M | 2026 Net: -$${netImpact2026.toFixed(2)}M | ${isInternalResign ? 'Internal Re-Sign · Comp-Pick Safe' : countsTowardCompPickFormula ? 'Counts vs Comp Pick' : 'Comp-Pick Safe'}`,
    capDelta2026: roundCap(-netImpact2026),
  };
}

function buildQuickTradeTx(
  player: Player,
  designation: 'PRE_JUNE_1' | 'POST_JUNE_1' = 'PRE_JUNE_1',
  actionYear: LeagueYear = 2026
): Transaction {
  const mode =
    designation === 'POST_JUNE_1' ? 'POST_JUNE_1_TRADE' : 'PRE_JUNE_1_TRADE';
  const sim = simulateCutOrTrade(player, actionYear, mode);
  return {
    id: nextTxId(),
    type: 'TRADE',
    timestamp: Date.now(),
    enabled: true,
    actionYear,
    partnerTeamId: 'OPEN_MARKET',
    partnerTeamName: 'Trade Partner (Quick Sim)',
    designation,
    outgoingPlayerIds: [player.id],
    incomingPlayers: [],
    outgoingPickIds: [],
    incomingPicks: [],
    tradeValueSent: 0,
    tradeValueReceived: 0,
    label: `Traded ${player.name} (${designation === 'POST_JUNE_1' ? 'Post-6/1' : 'Quick Sim'})`,
    sublabel: `${actionYear} Savings: ${sim.currentYearCapSavings >= 0 ? '+' : '-'}$${Math.abs(sim.currentYearCapSavings).toFixed(2)}M | Dead Cap: $${sim.currentYearDeadCap.toFixed(2)}M`,
    capDelta2026: actionYear === 2026 ? sim.currentYearCapSavings : 0,
  };
}

function buildDraftSigningTx(params: {
  pickId: string;
  overallPick: number;
  round: number;
  prospectName: string;
  position: PositionGroup;
}): Transaction {
  return {
    id: nextTxId(),
    type: 'DRAFT_SIGNING',
    timestamp: Date.now(),
    enabled: true,
    actionYear: 2026,
    pickId: params.pickId,
    overallPick: params.overallPick,
    round: params.round,
    prospectName: params.prospectName,
    position: params.position,
    label: `Drafted #${params.overallPick} ${params.prospectName} (${params.position})`,
    sublabel: `Round ${params.round}, Pick #${params.overallPick} signed to 4-year rookie scale`,
    capDelta2026: 0,
  };
}

function buildFifthYrOptionTx(
  player: Player,
  optionYear: LeagueYear,
  optionAmount: number
): Transaction {
  return {
    id: nextTxId(),
    type: 'FIFTH_YEAR_OPTION',
    timestamp: Date.now(),
    enabled: true,
    actionYear: optionYear,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    optionAmount,
    label: `Exercised ${optionYear} 5th-Yr Option: ${player.name}`,
    sublabel: `Fully guaranteed $${optionAmount.toFixed(2)}M in ${optionYear}`,
    capDelta2026: 0,
  };
}

export function encodeScenarioToUrlParam(
  _teamId: string,
  transactions: Transaction[]
): string {
  const compact: CompactScenarioItem[] = [];
  for (const tx of transactions) {
    if (!tx.enabled) continue;
    if (tx.type === 'PRE_JUNE_1_CUT' || tx.type === 'POST_JUNE_1_CUT') {
      compact.push([
        'cut',
        tx.type === 'POST_JUNE_1_CUT' ? 1 : 0,
        tx.playerId,
        tx.actionYear,
      ]);
    } else if (tx.type === 'RESTRUCTURE') {
      compact.push([
        'res',
        tx.playerId,
        tx.convertPercentage,
        tx.addVoidYears,
        tx.actionYear,
      ]);
    } else if (tx.type === 'EXTENSION') {
      compact.push([
        'ext',
        tx.playerId,
        tx.newYearsAdded,
        tx.apy,
        tx.guaranteedPct,
        tx.structure,
        tx.actionYear,
      ]);
    } else if (tx.type === 'FRANCHISE_TAG') {
      compact.push([
        'tag',
        tx.playerId,
        tx.tagType === 'TRANSITION' ? 1 : 0,
        tx.tagSalary,
        tx.actionYear,
      ]);
    } else if (tx.type === 'FIFTH_YEAR_OPTION') {
      compact.push(['opt', tx.playerId, tx.actionYear, tx.optionAmount]);
    } else if (tx.type === 'SIGN_FA') {
      compact.push([
        'fa',
        tx.freeAgent.id,
        tx.years,
        tx.apy,
        tx.guaranteedPct,
        tx.structure,
      ]);
    } else if (tx.type === 'DRAFT_SIGNING') {
      compact.push([
        'dr',
        tx.pickId,
        tx.overallPick,
        tx.round,
        tx.prospectName,
        tx.position,
      ]);
    } else if (
      tx.type === 'TRADE' &&
      tx.incomingPlayers.length === 0 &&
      tx.outgoingPlayerIds.length === 1
    ) {
      compact.push([
        'qtr',
        tx.outgoingPlayerIds[0],
        tx.designation === 'POST_JUNE_1' ? 1 : 0,
        tx.actionYear,
      ]);
    }
  }
  if (compact.length === 0) return '';
  try {
    return btoa(encodeURIComponent(JSON.stringify(compact)));
  } catch {
    return '';
  }
}

export function buildShareableScenarioUrl(
  baseUrl: string,
  teamId: string,
  transactions: Transaction[]
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('team', teamId);
  const encoded = encodeScenarioToUrlParam(teamId, transactions);
  if (encoded) {
    url.searchParams.set('s', encoded);
  } else {
    url.searchParams.delete('s');
  }
  return url.toString();
}

const initialTeam = SEED_TEAMS['DET'];
const initialDerived = computeDerivedTeamCapState(
  initialTeam,
  [],
  DEFAULT_CAP_GROWTH_RATE,
  'TOP_51'
);

export const useGMStore = create<GMStoreState>((set, get) => {
  const recompute = (
    baseTeam: TeamSeedData,
    transactions: Transaction[],
    capGrowthRate: number,
    capCalculationMode: CapCalculationMode = get().capCalculationMode
  ) =>
    computeDerivedTeamCapState(
      baseTeam,
      transactions,
      capGrowthRate,
      capCalculationMode
    );

  const commitTransactions = (
    nextTx: Transaction[],
    extra: Partial<GMStoreState> = {}
  ) => {
    const { baseTeam, capGrowthRate, capCalculationMode } = get();
    set({
      transactions: nextTx,
      compareOriginalBaseline: false,
      derivedState: recompute(baseTeam, nextTx, capGrowthRate, capCalculationMode),
      ...extra,
    });
  };

  return {
    selectedTeamId: 'DET',
    baseTeam: initialTeam,
    capGrowthRate: DEFAULT_CAP_GROWTH_RATE,
    capCalculationMode: 'TOP_51',
    compareOriginalBaseline: false,
    transactions: [],
    baselineState: initialDerived,
    derivedState: initialDerived,

    activeTab: 'team-builder',
    teamBuilderSubTab: 'fa-dock',
    teamBuilderPosFilter: 'ALL',
    navHistory: [],
    ledgerMode: 'CAP',
    selectedPlayerId: null,
    initialDrawerTab: null,
    initialActionYear: null,
    preselectedFreeAgentId: null,
    freeAgencyPositionFilter: 'ALL',
    isScenarioDrawerOpen: false,
    isFreeAgencyModalOpen: false,
    dossierPlayer: null,
    positionFilter: 'ALL',
    searchQuery: '',

    selectTeam: (teamId) => {
      const nextTeam = SEED_TEAMS[teamId] ?? SEED_TEAMS['DET'];
      const rate = get().capGrowthRate;
      const mode = get().capCalculationMode;
      const freshBaseline = recompute(nextTeam, [], rate, mode);
      set({
        selectedTeamId: nextTeam.id,
        baseTeam: nextTeam,
        transactions: [],
        compareOriginalBaseline: false,
        selectedPlayerId: null,
        initialDrawerTab: null,
        baselineState: freshBaseline,
        derivedState: freshBaseline,
      });
    },

    setCapGrowthRate: (rate) => {
      const { baseTeam, transactions, capCalculationMode } = get();
      set({
        capGrowthRate: rate,
        baselineState: recompute(baseTeam, [], rate, capCalculationMode),
        derivedState: recompute(baseTeam, transactions, rate, capCalculationMode),
      });
    },

    setCapCalculationMode: (mode) => {
      const { baseTeam, transactions, capGrowthRate } = get();
      set({
        capCalculationMode: mode,
        baselineState: recompute(baseTeam, [], capGrowthRate, mode),
        derivedState: recompute(baseTeam, transactions, capGrowthRate, mode),
      });
    },

    setCompareOriginalBaseline: (val) =>
      set({ compareOriginalBaseline: val }),

    setActiveTab: (tab) => {
      const current = get().activeTab;
      if (current === tab) return;
      const nextHistory = [...get().navHistory, current];
      if (typeof window !== 'undefined') {
        window.history.pushState({ tab }, '', `#${tab}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      set({ activeTab: tab, navHistory: nextHistory });
    },
    setTeamBuilderSubTab: (sub) => set({ teamBuilderSubTab: sub }),
    setTeamBuilderPosFilter: (pos) => set({ teamBuilderPosFilter: pos }),
    openInTeamBuilder: (options) => {
      const current = get().activeTab;
      const nextHistory =
        current !== 'team-builder'
          ? [...get().navHistory, current]
          : get().navHistory;
      if (typeof window !== 'undefined' && current !== 'team-builder') {
        window.history.pushState({ tab: 'team-builder' }, '', '#team-builder');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      set({
        activeTab: 'team-builder',
        compareOriginalBaseline: false,
        navHistory: nextHistory,
        teamBuilderSubTab: options?.subTab ?? get().teamBuilderSubTab,
        teamBuilderPosFilter:
          options?.position !== undefined
            ? options.position
            : get().teamBuilderPosFilter,
        selectedPlayerId:
          options?.playerId !== undefined ? options.playerId : null,
        initialDrawerTab:
          options?.drawerTab !== undefined ? options.drawerTab : null,
        initialActionYear:
          options?.actionYear !== undefined ? options.actionYear : null,
      });
    },
    goBack: () => {
      const history = get().navHistory;
      if (history.length > 0) {
        const prevTab = history[history.length - 1];
        const nextHistory = history.slice(0, -1);
        if (typeof window !== 'undefined') {
          window.history.pushState({ tab: prevTab }, '', `#${prevTab}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        set({ activeTab: prevTab, navHistory: nextHistory });
      } else {
        if (typeof window !== 'undefined') {
          window.history.pushState({ tab: 'player-fate' }, '', '#player-fate');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        set({ activeTab: 'player-fate', navHistory: [] });
      }
    },
    goHome: () => {
      const current = get().activeTab;
      if (current === 'player-fate') return;
      const nextHistory = [...get().navHistory, current];
      if (typeof window !== 'undefined') {
        window.history.pushState({ tab: 'player-fate' }, '', '#player-fate');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      set({ activeTab: 'player-fate', navHistory: nextHistory });
    },
    setLedgerMode: (mode) => set({ ledgerMode: mode }),
    selectPlayer: (playerId, initialTab = null, initialActionYear = null) =>
      set({
        selectedPlayerId: playerId,
        initialDrawerTab: initialTab,
        initialActionYear,
      }),
    openPlayerDossier: (player, teamId) =>
      set({
        dossierPlayer: {
          player,
          teamId: teamId ?? get().selectedTeamId,
        },
      }),
    closePlayerDossier: () => set({ dossierPlayer: null }),
    openFreeAgencyModal: (options) =>
      set({
        isFreeAgencyModalOpen: true,
        preselectedFreeAgentId: options?.freeAgentId ?? null,
        freeAgencyPositionFilter: options?.position ?? 'ALL',
      }),
    applyMaxTopRestructures: () => {
      const { derivedState, transactions } = get();
      const alreadyRestructuredIds = new Set(
        transactions
          .filter(
            (t): t is import('@/engine').RestructureTransaction =>
              t.type === 'RESTRUCTURE' && t.enabled
          )
          .map((t) => t.playerId)
      );

      const candidates = derivedState.roster
        .filter((p) => !alreadyRestructuredIds.has(p.id))
        .map((p) => ({
          player: p,
          sim: simulateRestructure(p, 2026, 1.0, 1),
        }))
        .filter((x) => x.sim.currentYearCapSavings >= 2.0)
        .sort(
          (a, b) => b.sim.currentYearCapSavings - a.sim.currentYearCapSavings
        )
        .slice(0, 3);

      if (candidates.length === 0) return;

      const addedTxs = candidates.map(({ player }, idx) =>
        buildRestructureTx(player, 1.0, 1, 2026, idx)
      );

      commitTransactions([...transactions, ...addedTxs]);
    },

    applyAutoCapReliefPlaybook: () => {
      const { derivedState, transactions } = get();
      const space2026 = derivedState.years[2026].effectiveCapSpace;
      const touchedIds = new Set<string>();
      for (const t of transactions) {
        if (!t.enabled) continue;
        if ('playerId' in t) touchedIds.add(t.playerId);
        if (t.type === 'TRADE') {
          for (const outId of t.outgoingPlayerIds) touchedIds.add(outId);
        }
      }

      const restructures = derivedState.roster
        .filter((p) => !touchedIds.has(p.id))
        .map((p) => ({
          player: p,
          sim: simulateRestructure(p, 2026, 1.0, 1),
        }))
        .filter((x) => x.sim.currentYearCapSavings >= 2.5)
        .sort((a, b) => b.sim.currentYearCapSavings - a.sim.currentYearCapSavings)
        .slice(0, 3);

      for (const { player } of restructures) {
        touchedIds.add(player.id);
      }

      const cleanCuts = derivedState.roster
        .filter(
          (p) =>
            !touchedIds.has(p.id) &&
            p.overallRating <= 83 &&
            evaluateRosterPlayerFate(p, space2026).fate === 'CAP_CASUALTY_RISK'
        )
        .map((p) => ({
          player: p,
          sim: simulateCutOrTrade(p, 2026, 'PRE_JUNE_1_CUT'),
        }))
        .filter((x) => x.sim.currentYearCapSavings >= 3.0)
        .sort((a, b) => b.sim.currentYearCapSavings - a.sim.currentYearCapSavings)
        .slice(0, 2);

      const addedTxs: Transaction[] = [
        ...restructures.map(({ player }, idx) =>
          buildRestructureTx(player, 1.0, 1, 2026, idx)
        ),
        ...cleanCuts.map(({ player }) =>
          buildCutTx(player, 'PRE_JUNE_1_CUT', 2026)
        ),
      ];

      if (addedTxs.length === 0) return;
      commitTransactions([...transactions, ...addedTxs]);
    },

    applyExtendCorePillarsPlaybook: () => {
      const { derivedState, transactions } = get();
      const space2026 = derivedState.years[2026].effectiveCapSpace;
      const excludedIds = new Set<string>();
      for (const t of transactions) {
        if (!t.enabled) continue;
        if (t.type === 'EXTENSION') excludedIds.add(t.playerId);
        if (
          t.type === 'PRE_JUNE_1_CUT' ||
          t.type === 'POST_JUNE_1_CUT'
        ) {
          excludedIds.add(t.playerId);
        }
        if (t.type === 'TRADE') {
          for (const outId of t.outgoingPlayerIds) excludedIds.add(outId);
        }
      }

      const candidates = derivedState.roster
        .filter((p) => {
          if (excludedIds.has(p.id)) return false;
          if (p.overallRating < 85 || p.ageIn2026 > 27) return false;
          const y27 = p.contractYears[2027];
          const y28 = p.contractYears[2028];
          const open27 = !y27 || y27.isVoidYear;
          const open28 = !y28 || y28.isVoidYear;
          return open27 || open28;
        })
        .sort(
          (a, b) =>
            b.overallRating - a.overallRating || a.ageIn2026 - b.ageIn2026
        )
        .slice(0, 3);

      if (candidates.length === 0) return;

      const addedTxs = candidates.map((player, idx) => {
        const forecast = evaluateRosterPlayerFate(player, space2026);
        const y27 = player.contractYears[2027];
        const anchorYear: LeagueYear = !y27 || y27.isVoidYear ? 2026 : 2027;
        return buildExtensionTx(
          player,
          3,
          forecast.projectedMarketApy,
          0.55,
          'Backloaded',
          anchorYear,
          idx
        );
      });

      commitTransactions([...transactions, ...addedTxs]);
    },

    hydrateScenarioFromUrlSearch: (search) => {
      if (!search) return;
      try {
        const params = new URLSearchParams(search);
        const rawTeam = params.get('team')?.toUpperCase();
        const encoded = params.get('s');
        if (!rawTeam && !encoded) return;

        const targetTeam =
          (rawTeam && SEED_TEAMS[rawTeam]) || get().baseTeam;
        const rate = get().capGrowthRate;
        const mode = get().capCalculationMode;
        const freshBaseline = recompute(targetTeam, [], rate, mode);

        const replayed: Transaction[] = [];
        if (encoded) {
          const parsed = JSON.parse(
            decodeURIComponent(atob(encoded))
          ) as CompactScenarioItem[];
          if (Array.isArray(parsed)) {
            const rosterById = new Map(targetTeam.roster.map((p) => [p.id, p]));
            const faPool = [
              ...getLeagueWideFreeAgentPool(targetTeam.id),
              ...getTeamInternalFreeAgents(targetTeam.id),
            ];
            const faById = new Map(faPool.map((fa) => [fa.id, fa]));
            const cutoff = freshBaseline.years[2026].replacementLevelCutoff;

            for (const item of parsed) {
              if (!Array.isArray(item)) continue;
              const kind = item[0];
              if (kind === 'cut') {
                const [, isPost, playerId, actionYear] = item;
                const player = rosterById.get(playerId);
                if (player) {
                  replayed.push(
                    buildCutTx(
                      player,
                      isPost === 1 ? 'POST_JUNE_1_CUT' : 'PRE_JUNE_1_CUT',
                      actionYear
                    )
                  );
                }
              } else if (kind === 'res') {
                const [, playerId, pct, voidYrs, actionYear] = item;
                const player = rosterById.get(playerId);
                if (player) {
                  replayed.push(
                    buildRestructureTx(player, pct, voidYrs, actionYear)
                  );
                }
              } else if (kind === 'ext') {
                const [, playerId, yrs, apy, gtd, struct, actionYear] = item;
                const player = rosterById.get(playerId);
                if (player) {
                  replayed.push(
                    buildExtensionTx(
                      player,
                      yrs,
                      apy,
                      gtd,
                      struct,
                      actionYear
                    )
                  );
                }
              } else if (kind === 'tag') {
                const [, playerId, isTrans, salary, targetYear] = item;
                const player = rosterById.get(playerId);
                if (player) {
                  replayed.push(
                    buildTagTx(
                      player,
                      isTrans === 1 ? 'TRANSITION' : 'NON_EXCLUSIVE_FRANCHISE',
                      salary,
                      targetYear
                    )
                  );
                }
              } else if (kind === 'opt') {
                const [, playerId, optYr, optAmt] = item;
                const player = rosterById.get(playerId);
                if (player) {
                  replayed.push(buildFifthYrOptionTx(player, optYr, optAmt));
                }
              } else if (kind === 'fa') {
                const [, faId, yrs, apy, gtd, struct] = item;
                const fa = faById.get(faId);
                if (fa) {
                  replayed.push(
                    buildSignFATx(
                      fa,
                      yrs,
                      apy,
                      gtd,
                      struct,
                      targetTeam.abbreviation,
                      cutoff
                    )
                  );
                }
              } else if (kind === 'dr') {
                const [, pickId, overallPick, round, prospectName, position] =
                  item;
                replayed.push(
                  buildDraftSigningTx({
                    pickId,
                    overallPick,
                    round,
                    prospectName,
                    position,
                  })
                );
              } else if (kind === 'qtr') {
                const [, playerId, isPost, actionYear] = item;
                const player = rosterById.get(playerId);
                if (player) {
                  replayed.push(
                    buildQuickTradeTx(
                      player,
                      isPost === 1 ? 'POST_JUNE_1' : 'PRE_JUNE_1',
                      actionYear
                    )
                  );
                }
              }
            }
          }
        }

        set({
          selectedTeamId: targetTeam.id,
          baseTeam: targetTeam,
          transactions: replayed,
          compareOriginalBaseline: false,
          activeTab: 'team-builder',
          selectedPlayerId: null,
          initialDrawerTab: null,
          baselineState: freshBaseline,
          derivedState: recompute(targetTeam, replayed, rate, mode),
        });
      } catch {
        // Ignore malformed share links gracefully
      }
    },

    setScenarioDrawerOpen: (open) => set({ isScenarioDrawerOpen: open }),
    setFreeAgencyModalOpen: (open) => set({ isFreeAgencyModalOpen: open }),
    setPositionFilter: (pos) => set({ positionFilter: pos }),
    setSearchQuery: (q) => set({ searchQuery: q }),

    addCutTransaction: (player, mode, actionYear = 2026) => {
      const tx = buildCutTx(player, mode, actionYear);
      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    addRestructureTransaction: (
      player,
      convertPercentage,
      addVoidYears,
      actionYear = 2026
    ) => {
      const tx = buildRestructureTx(
        player,
        convertPercentage,
        addVoidYears,
        actionYear
      );
      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    addExtensionTransaction: (
      player,
      newYearsAdded,
      apy,
      guaranteedPct,
      structure,
      actionYear = 2026
    ) => {
      const tx = buildExtensionTx(
        player,
        newYearsAdded,
        apy,
        guaranteedPct,
        structure,
        actionYear
      );
      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    addFranchiseTagTransaction: (
      player,
      tagType,
      tagSalary,
      targetYear = 2027
    ) => {
      const tx = buildTagTx(player, tagType, tagSalary, targetYear);
      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    addSignFATransaction: (freeAgent, years, apy, guaranteedPct, structure) => {
      const tx = buildSignFATx(
        freeAgent,
        years,
        apy,
        guaranteedPct,
        structure,
        get().baseTeam.abbreviation,
        get().derivedState.years[2026].replacementLevelCutoff
      );
      commitTransactions([...get().transactions, tx], {
        isFreeAgencyModalOpen: false,
      });
    },

    addTradeTransaction: ({
      partnerTeamId,
      partnerTeamName,
      designation,
      outgoingPlayers,
      incomingPlayers,
      outgoingPickIds,
      incomingPicks,
      tradeValueSent,
      tradeValueReceived,
    }) => {
      let savings2026 = 0;
      const mode =
        designation === 'POST_JUNE_1' ? 'POST_JUNE_1_TRADE' : 'PRE_JUNE_1_TRADE';
      for (const p of outgoingPlayers) {
        savings2026 += simulateCutOrTrade(p, 2026, mode).currentYearCapSavings;
      }
      for (const inc of incomingPlayers) {
        const cy = inc.contractYears[2026];
        if (cy) {
          savings2026 -= cy.baseSalary + cy.rosterBonus + cy.workoutBonus;
        }
      }

      const sentNames = [
        ...outgoingPlayers.map((p) => p.name),
        ...outgoingPickIds.map((id) => `Pick ${id.split('-').pop()}`),
      ].join(', ');
      const recNames = [
        ...incomingPlayers.map((p) => p.name),
        ...incomingPicks.map((pk) => `Pick #${pk.overallPick}`),
      ].join(', ');

      const tx: Transaction = {
        id: nextTxId(),
        type: 'TRADE',
        timestamp: Date.now(),
        enabled: true,
        actionYear: 2026,
        partnerTeamId,
        partnerTeamName,
        designation,
        outgoingPlayerIds: outgoingPlayers.map((p) => p.id),
        incomingPlayers,
        outgoingPickIds,
        incomingPicks,
        tradeValueSent,
        tradeValueReceived,
        label: `Trade with ${partnerTeamName}`,
        sublabel: `Acquired: ${recNames || 'None'} | Sent: ${sentNames || 'None'}`,
        capDelta2026: roundCap(savings2026),
      };

      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    addQuickTradeTransaction: (
      player,
      designation = 'PRE_JUNE_1',
      actionYear = 2026
    ) => {
      const tx = buildQuickTradeTx(player, designation, actionYear);
      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    addDraftSigningTransaction: (params) => {
      const tx = buildDraftSigningTx(params);
      commitTransactions([...get().transactions, tx]);
    },

    addFifthYearOptionTransaction: (player, optionYear, optionAmount) => {
      const tx = buildFifthYrOptionTx(player, optionYear, optionAmount);
      commitTransactions([...get().transactions, tx], {
        selectedPlayerId: null,
      });
    },

    toggleTransaction: (txId) => {
      const nextTx = get().transactions.map((t) =>
        t.id === txId ? { ...t, enabled: !t.enabled } : t
      );
      commitTransactions(nextTx);
    },

    removeTransaction: (txId) => {
      const nextTx = get().transactions.filter((t) => t.id !== txId);
      commitTransactions(nextTx);
    },

    resetScenarioStack: () => {
      commitTransactions([]);
    },
  };
});
