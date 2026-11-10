'use client';

import { create } from 'zustand';
import {
  applyPlayerExtension,
  computeDerivedTeamCapState,
  ContractStructureTemplate,
  createSignedFreeAgentPlayer,
  DEFAULT_CAP_GROWTH_RATE,
  DerivedTeamCapState,
  evaluateFreeAgentTarget,
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
import { SEED_TEAMS } from '@/data/seed/teams';

export type ActiveTab =
  | 'cap-checkup'
  | 'player-fate'
  | 'free-agency'
  | 'draft'
  | 'matrix'
  | 'predictor';

interface GMStoreState {
  selectedTeamId: string;
  baseTeam: TeamSeedData;
  capGrowthRate: number;
  transactions: Transaction[];
  derivedState: DerivedTeamCapState;

  // UI Navigation & Drawers
  activeTab: ActiveTab;
  ledgerMode: 'CAP' | 'CASH';
  selectedPlayerId: string | null;
  initialDrawerTab: 'cut' | 'restructure' | 'extend' | 'trade' | null;
  initialActionYear: LeagueYear | null;
  preselectedFreeAgentId: string | null;
  freeAgencyPositionFilter: PositionGroup | 'ALL';
  isScenarioDrawerOpen: boolean;
  isFreeAgencyModalOpen: boolean;
  positionFilter: PositionGroup | 'ALL';
  searchQuery: string;

  // Actions
  selectTeam: (teamId: string) => void;
  setCapGrowthRate: (rate: number) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setLedgerMode: (mode: 'CAP' | 'CASH') => void;
  selectPlayer: (
    playerId: string | null,
    initialTab?: 'cut' | 'restructure' | 'extend' | 'trade' | null,
    initialActionYear?: LeagueYear | null
  ) => void;
  openFreeAgencyModal: (options?: {
    freeAgentId?: string | null;
    position?: PositionGroup | 'ALL';
  }) => void;
  applyMaxTopRestructures: () => void;
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

const initialTeam = SEED_TEAMS['DET'];
const initialDerived = computeDerivedTeamCapState(
  initialTeam,
  [],
  DEFAULT_CAP_GROWTH_RATE
);

export const useGMStore = create<GMStoreState>((set, get) => {
  const recompute = (
    baseTeam: TeamSeedData,
    transactions: Transaction[],
    capGrowthRate: number
  ) => computeDerivedTeamCapState(baseTeam, transactions, capGrowthRate);

  return {
    selectedTeamId: 'DET',
    baseTeam: initialTeam,
    capGrowthRate: DEFAULT_CAP_GROWTH_RATE,
    transactions: [],
    derivedState: initialDerived,

    activeTab: 'cap-checkup',
    ledgerMode: 'CAP',
    selectedPlayerId: null,
    initialDrawerTab: null,
    initialActionYear: null,
    preselectedFreeAgentId: null,
    freeAgencyPositionFilter: 'ALL',
    isScenarioDrawerOpen: false,
    isFreeAgencyModalOpen: false,
    positionFilter: 'ALL',
    searchQuery: '',

    selectTeam: (teamId) => {
      const nextTeam = SEED_TEAMS[teamId] ?? SEED_TEAMS['DET'];
      const rate = get().capGrowthRate;
      set({
        selectedTeamId: nextTeam.id,
        baseTeam: nextTeam,
        transactions: [],
        selectedPlayerId: null,
        initialDrawerTab: null,
        derivedState: recompute(nextTeam, [], rate),
      });
    },

    setCapGrowthRate: (rate) => {
      const { baseTeam, transactions } = get();
      set({
        capGrowthRate: rate,
        derivedState: recompute(baseTeam, transactions, rate),
      });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setLedgerMode: (mode) => set({ ledgerMode: mode }),
    selectPlayer: (playerId, initialTab = null, initialActionYear = null) =>
      set({
        selectedPlayerId: playerId,
        initialDrawerTab: initialTab,
        initialActionYear,
      }),
    openFreeAgencyModal: (options) =>
      set({
        isFreeAgencyModalOpen: true,
        preselectedFreeAgentId: options?.freeAgentId ?? null,
        freeAgencyPositionFilter: options?.position ?? 'ALL',
      }),
    applyMaxTopRestructures: () => {
      const { derivedState, transactions, baseTeam, capGrowthRate } = get();
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

      const addedTxs: Transaction[] = candidates.map(({ player, sim }, idx) => ({
        id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'RESTRUCTURE',
        timestamp: Date.now() + idx,
        enabled: true,
        actionYear: 2026,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        convertPercentage: 1.0,
        addVoidYears: 1,
        label: `Restructured ${player.name} (100% Max)`,
        sublabel: `Converted $${sim.convertedBonusAmount.toFixed(2)}M over ${sim.prorationYearsCount} yrs (+$${sim.annualProrationAdded.toFixed(2)}M/yr future proration)`,
        capDelta2026: sim.currentYearCapSavings,
      }));

      const nextTx = [...transactions, ...addedTxs];
      set({
        transactions: nextTx,
        derivedState: recompute(baseTeam, nextTx, capGrowthRate),
      });
    },
    setScenarioDrawerOpen: (open) => set({ isScenarioDrawerOpen: open }),
    setFreeAgencyModalOpen: (open) => set({ isFreeAgencyModalOpen: open }),
    setPositionFilter: (pos) => set({ positionFilter: pos }),
    setSearchQuery: (q) => set({ searchQuery: q }),

    addCutTransaction: (player, mode, actionYear = 2026) => {
      const sim = simulateCutOrTrade(player, actionYear, mode);
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        selectedPlayerId: null,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    addRestructureTransaction: (
      player,
      convertPercentage,
      addVoidYears,
      actionYear = 2026
    ) => {
      const sim = simulateRestructure(
        player,
        actionYear,
        convertPercentage,
        addVoidYears
      );
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'RESTRUCTURE',
        timestamp: Date.now(),
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

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        selectedPlayerId: null,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
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
      const { capDeltaByYear } = applyPlayerExtension(
        player,
        actionYear,
        newYearsAdded,
        apy,
        guaranteedPct,
        structure
      );
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'EXTENSION',
        timestamp: Date.now(),
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

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        selectedPlayerId: null,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    addFranchiseTagTransaction: (
      player,
      tagType,
      tagSalary,
      targetYear = 2027
    ) => {
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        selectedPlayerId: null,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    addSignFATransaction: (freeAgent, years, apy, guaranteedPct, structure) => {
      const signed = createSignedFreeAgentPlayer(
        freeAgent,
        2026,
        years,
        apy,
        guaranteedPct,
        structure
      );
      const hit2026 = getContractYearCapHit(signed.contractYears[2026]);
      const cutoff = get().derivedState.years[2026].replacementLevelCutoff;
      const netImpact2026 = roundCap(Math.max(0, hit2026 - cutoff));
      const pred = evaluateFreeAgentTarget(freeAgent);

      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'SIGN_FA',
        timestamp: Date.now(),
        enabled: true,
        actionYear: 2026,
        freeAgent,
        years,
        apy,
        guaranteedPct,
        structure,
        countsTowardCompPickFormula: pred.countsTowardCompFormula,
        label: `Signed ${pred.countsTowardCompFormula ? 'UFA' : 'Street FA'} ${freeAgent.name} (${freeAgent.position})`,
        sublabel: `${years} yrs, $${(years * apy).toFixed(1)}M | 2026 Net: -$${netImpact2026.toFixed(2)}M | ${pred.countsTowardCompFormula ? 'Counts vs Comp Pick' : 'Comp-Pick Safe'}`,
        capDelta2026: roundCap(-netImpact2026),
      };

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        isFreeAgencyModalOpen: false,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
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
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        selectedPlayerId: null,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    addDraftSigningTransaction: ({
      pickId,
      overallPick,
      round,
      prospectName,
      position,
    }) => {
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'DRAFT_SIGNING',
        timestamp: Date.now(),
        enabled: true,
        actionYear: 2026,
        pickId,
        overallPick,
        round,
        prospectName,
        position,
        label: `Drafted #${overallPick} ${prospectName} (${position})`,
        sublabel: `Round ${round}, Pick #${overallPick} signed to 4-year rookie scale`,
        capDelta2026: 0,
      };

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    addFifthYearOptionTransaction: (player, optionYear, optionAmount) => {
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

      const nextTx = [...get().transactions, tx];
      set({
        transactions: nextTx,
        selectedPlayerId: null,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    toggleTransaction: (txId) => {
      const nextTx = get().transactions.map((t) =>
        t.id === txId ? { ...t, enabled: !t.enabled } : t
      );
      set({
        transactions: nextTx,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    removeTransaction: (txId) => {
      const nextTx = get().transactions.filter((t) => t.id !== txId);
      set({
        transactions: nextTx,
        derivedState: recompute(get().baseTeam, nextTx, get().capGrowthRate),
      });
    },

    resetScenarioStack: () => {
      set({
        transactions: [],
        derivedState: recompute(get().baseTeam, [], get().capGrowthRate),
      });
    },
  };
});
