'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Ghost,
  LayoutGrid,
  Link2,
  Lock,
  Monitor,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  ShieldCheck,
  Smartphone,
  Target,
  UserMinus,
  UserPlus,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  auditFantasyRosterPlayers,
  buildPlayerContractTimelineRow,
  buildStructuredContract,
  computeRealContractXRay,
  evaluateFantasyPlayerSignal,
  evaluateFreeAgentTarget,
  evaluateFreeAgentValueBadge,
  evaluateFutureSeasonRosterOutlook,
  evaluateTeamCampBattles,
  evaluateTeamFantasyEnvironment,
  evaluateTeamPositionalNeedsByYear,
  FantasyPlayerEvaluation,
  FantasySignalType,
  FreeAgentValueBadge,
  FutureRosterBucket,
  FutureSeasonPlayerEvaluation,
  generateRookieContract,
  getContractYearCapHit,
  isFantasySkillPosition,
  LEAGUE_YEARS,
  LeagueYear,
  POSITION_GROUPS,
  PositionGroup,
  projectCompPickRound,
  projectPlayerCareerHorizon,
  SAMPLE_DYNASTY_ROSTER_NAMES,
  scanLeagueFantasyLandingSpots,
  simulateCutOrTrade,
  simulateRestructure,
  TIMELINE_HORIZON_YEARS,
} from '@/engine';
import {
  getLeagueWideFreeAgentPool,
  getTeamInternalFreeAgents,
  SEED_FREE_AGENTS,
} from '@/data/seed/freeAgents';
import { SEED_TEAMS } from '@/data/seed/teams';
import {
  buildShareableScenarioUrl,
  TeamBuilderSubTab,
  useGMStore,
} from '@/store/useGMStore';
import { PlayerAvatar } from './PlayerAvatar';
import { JargonTip } from './JargonTooltip';
import { GlobalPlayerSearch } from './PlayerDossierModal';
import { CapCheckupJourney } from './CapCheckupJourney';
import { DraftTradeSandbox } from './DraftTradeSandbox';
import { RosterMatrix } from './RosterMatrix';

type Journey2ViewMode = 'TIMELINE_BARS' | 'BUCKET_CARDS';
type RosterCategoryTab = 'ACTIVE' | 'DEAD_MONEY' | 'DRAFT_PICKS' | 'MODIFIED';
type BucketFilter = 'ALL_BUCKETS' | FutureRosterBucket;
type TimelineQuickFilter =
  | 'ALL'
  | 'HIGH_EXT_LIKELY'
  | 'CUT_RISK_YEARS'
  | 'EXPIRING_2026'
  | 'VOID_BILLS'
  | 'ADDED_FA';

const ALL_POSITIONS: (PositionGroup | 'ALL')[] = ['ALL', ...POSITION_GROUPS];

function isNewFaPlayerId(id: string): boolean {
  return id.startsWith('fa-tx-') || id.startsWith('fa-signed-');
}

function formatCapDelta(val: number): string {
  const rounded = Math.round(val * 100) / 100;
  return `${rounded >= 0 ? '+$' : '−$'}${Math.abs(rounded).toFixed(2)}M`;
}

type SleeperPlayerRecord = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
};

let sleeperPlayersDirectoryCache: Record<string, SleeperPlayerRecord> | null =
  null;

function getFantasySignalBadgeClass(signal: FantasySignalType): string {
  switch (signal) {
    case 'INSULATED_ALPHA':
      return 'border-[#16a34a] bg-[#dcfce7] text-[#14532d]';
    case 'PAPER_TRAP':
      return 'border-[#dc2626] bg-[#fee2e2] text-[#991b1b]';
    case 'BREAKOUT_STASH':
      return 'border-[#7c3aed] bg-[#ede9fe] text-[#4c1d95]';
    case 'TAG_OR_UFA_WATCH':
      return 'border-[#d97706] bg-[#fef3c7] text-[#92400e]';
    default:
      return 'border-[#94a3b8] bg-[#f1f5f9] text-[#334155]';
  }
}

function getFaValueBadgeClass(tier: FreeAgentValueBadge['tier']): string {
  switch (tier) {
    case 'PRIME_BUY':
    case 'VALUE_STARTER':
      return 'border-[#16a34a]/60 bg-[#f0fdf4] text-[#14532d]';
    case 'CLIFF_TRAP':
      return 'border-[#dc2626]/60 bg-[#fef2f2] text-[#991b1b]';
    default:
      return 'border-[#cbd5e1] bg-[#f8fafc] text-[#334155]';
  }
}

export function PlayerFateJourney({
  mode = 'CURRENT_STATE',
}: {
  mode?: 'CURRENT_STATE' | 'TEAM_BUILDER';
}) {
  const isCurrentState = mode === 'CURRENT_STATE';

  const {
    baseTeam,
    baselineState,
    derivedState,
    transactions,
    teamBuilderSubTab,
    teamBuilderPosFilter,
    setTeamBuilderSubTab,
    setTeamBuilderPosFilter,
    setCompareOriginalBaseline,
    openInTeamBuilder,
    selectTeam,
    selectPlayer,
    addCutTransaction,
    addRestructureTransaction,
    addExtensionTransaction,
    addSignFATransaction,
    addQuickTradeTransaction,
    addDraftSigningTransaction,
    applyAutoCapReliefPlaybook,
    applyExtendCorePillarsPlaybook,
    removeTransaction,
    resetScenarioStack,
    openFreeAgencyModal,
    openPlayerDossier,
  } = useGMStore();

  const [viewMode, setViewMode] = useState<Journey2ViewMode>('TIMELINE_BARS');
  const [rosterCategoryTab, setRosterCategoryTab] =
    useState<RosterCategoryTab>('ACTIVE');
  const [openActionMenuPlayerId, setOpenActionMenuPlayerId] = useState<
    string | null
  >(null);
  const [selectedNeedSolverPos, setSelectedNeedSolverPos] =
    useState<PositionGroup | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [timelineFilter, setTimelineFilter] =
    useState<TimelineQuickFilter>('ALL');
  const [targetYear, setTargetYear] = useState<LeagueYear>(2027);
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('ALL_BUCKETS');
  const [posFilter, setPosFilter] = useState<PositionGroup | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Bottom Free Agent Dock filters
  const faPosFilter = teamBuilderPosFilter;
  const setFaPosFilter = setTeamBuilderPosFilter;
  const [faDockSourceTab, setFaDockSourceTab] = useState<'LEAGUE' | 'INTERNAL'>(
    'LEAGUE'
  );
  const [faSearchQuery, setFaSearchQuery] = useState('');
  const [faShowCount, setFaShowCount] = useState(14);
  const [deviceLayoutMode, setDeviceLayoutMode] = useState<
    'AUTO' | 'PHONE' | 'DESKTOP'
  >('AUTO');
  const [showAllMobileRoster, setShowAllMobileRoster] = useState(false);

  // Fantasy Football Lens state
  const [isFantasyLens, setIsFantasyLens] = useState(false);
  const [fantasyHubTab, setFantasyHubTab] = useState<
    'TEAM_INSULATION' | 'LANDING_SPOTS' | 'ROSTER_AUDIT'
  >('TEAM_INSULATION');
  const [fantasySignalFilter, setFantasySignalFilter] = useState<
    'ALL' | FantasySignalType
  >('ALL');
  const [landingSpotPosFilter, setLandingSpotPosFilter] = useState<
    'ALL' | 'QB' | 'RB' | 'WR' | 'TE'
  >('ALL');
  const [auditedPlayerNames, setAuditedPlayerNames] = useState<string[]>(
    SAMPLE_DYNASTY_ROSTER_NAMES
  );
  const [auditPlayerInput, setAuditPlayerInput] = useState('');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [sleeperLeagues, setSleeperLeagues] = useState<
    { league_id: string; name: string; season: string; userId: string }[]
  >([]);
  const [selectedSleeperLeagueId, setSelectedSleeperLeagueId] = useState<
    string | null
  >(null);
  const [sleeperStatusMsg, setSleeperStatusMsg] = useState<string | null>(null);
  const [sleeperLoading, setSleeperLoading] = useState(false);

  const toggleFantasyLens = () => {
    setIsFantasyLens((prev) => {
      const next = !prev;
      if (next && posFilter !== 'ALL' && !isFantasySkillPosition(posFilter)) {
        setPosFilter('ALL');
      }
      return next;
    });
  };

  useEffect(() => {
    const handleOpenDeadMoney = () => {
      setRosterCategoryTab('DEAD_MONEY');
      setOpenActionMenuPlayerId(null);
      setTimeout(() => {
        document
          .getElementById('dead-money-ledger-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    };
    window.addEventListener('armchair-gm:open-dead-money', handleOpenDeadMoney);
    return () =>
      window.removeEventListener(
        'armchair-gm:open-dead-money',
        handleOpenDeadMoney
      );
  }, []);

  const loadSleeperLeagueRoster = async (
    leagueId: string,
    userId: string,
    leagueName?: string
  ) => {
    setSleeperLoading(true);
    setSelectedSleeperLeagueId(leagueId);
    setSleeperStatusMsg(`Loading roster from ${leagueName ?? 'Sleeper'}...`);
    try {
      const rostersRes = await fetch(
        `https://api.sleeper.app/v1/league/${leagueId}/rosters`
      );
      if (!rostersRes.ok) {
        throw new Error('Could not fetch league rosters from Sleeper.');
      }
      const rosters = (await rostersRes.json()) as {
        owner_id?: string;
        co_owners?: string[];
        players?: string[];
      }[];
      const userRoster = rosters.find(
        (r) =>
          r.owner_id === userId || (r.co_owners ?? []).includes(userId)
      );
      const playerIds = userRoster?.players ?? [];
      if (playerIds.length === 0) {
        setSleeperStatusMsg(
          `Found ${leagueName ?? 'league'}, but your roster has no players listed yet.`
        );
        return;
      }

      if (!sleeperPlayersDirectoryCache) {
        setSleeperStatusMsg('Downloading Sleeper NFL player index (once)...');
        const playersRes = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!playersRes.ok) {
          throw new Error('Could not load Sleeper NFL player directory.');
        }
        sleeperPlayersDirectoryCache =
          (await playersRes.json()) as Record<string, SleeperPlayerRecord>;
      }

      const resolvedNames: string[] = [];
      for (const pid of playerIds) {
        const rec = sleeperPlayersDirectoryCache?.[pid];
        if (!rec) continue;
        if (
          rec.position &&
          !['QB', 'RB', 'WR', 'TE'].includes(rec.position)
        ) {
          continue;
        }
        const fullName =
          rec.full_name ||
          [rec.first_name, rec.last_name].filter(Boolean).join(' ').trim();
        if (fullName) {
          resolvedNames.push(fullName);
        }
      }

      if (resolvedNames.length === 0) {
        setSleeperStatusMsg(
          `Found ${playerIds.length} roster spots in ${leagueName ?? 'league'}, but no skill players (QB/RB/WR/TE) resolved.`
        );
        return;
      }

      setAuditedPlayerNames(resolvedNames);
      setSleeperStatusMsg(
        `Imported ${resolvedNames.length} skill players from "${leagueName ?? leagueId}".`
      );
    } catch (err) {
      setSleeperStatusMsg(
        err instanceof Error
          ? err.message
          : 'Sleeper import failed — try adding players manually below.'
      );
    } finally {
      setSleeperLoading(false);
    }
  };

  const handleImportSleeper = async () => {
    const cleanUser = sleeperUsername.trim();
    if (!cleanUser) {
      setSleeperStatusMsg('Enter a public Sleeper username first.');
      return;
    }
    setSleeperLoading(true);
    setSleeperStatusMsg(`Looking up Sleeper user "${cleanUser}"...`);
    try {
      const userRes = await fetch(
        `https://api.sleeper.app/v1/user/${encodeURIComponent(cleanUser)}`
      );
      if (!userRes.ok) {
        throw new Error(`Sleeper user "${cleanUser}" not found.`);
      }
      const userData = (await userRes.json()) as {
        user_id?: string;
        display_name?: string;
      } | null;
      if (!userData?.user_id) {
        throw new Error(`Sleeper user "${cleanUser}" not found.`);
      }

      let foundLeagues: {
        league_id: string;
        name: string;
        season: string;
      }[] = [];
      for (const season of ['2026', '2025', '2024']) {
        const lgRes = await fetch(
          `https://api.sleeper.app/v1/user/${userData.user_id}/leagues/nfl/${season}`
        );
        if (lgRes.ok) {
          const list = (await lgRes.json()) as {
            league_id: string;
            name: string;
            season: string;
          }[];
          if (Array.isArray(list) && list.length > 0) {
            foundLeagues = list;
            break;
          }
        }
      }

      if (foundLeagues.length === 0) {
        setSleeperLeagues([]);
        setSelectedSleeperLeagueId(null);
        setSleeperStatusMsg(
          `Found Sleeper user ${userData.display_name ?? cleanUser}, but no NFL leagues were found for 2024–2026.`
        );
        setSleeperLoading(false);
        return;
      }

      const mapped = foundLeagues.slice(0, 8).map((l) => ({
        ...l,
        userId: userData.user_id!,
      }));
      setSleeperLeagues(mapped);
      await loadSleeperLeagueRoster(
        mapped[0].league_id,
        userData.user_id,
        mapped[0].name
      );
    } catch (err) {
      setSleeperStatusMsg(
        err instanceof Error
          ? err.message
          : 'Could not reach Sleeper API — use manual player add below.'
      );
      setSleeperLoading(false);
    }
  };

  const activeCapState = isCurrentState ? baselineState : derivedState;
  const space2026 = activeCapState.years[2026].effectiveCapSpace;
  const enabledMovesCount = transactions.filter((t) => t.enabled).length;
  const signedFaCount = transactions.filter(
    (t) => t.enabled && t.type === 'SIGN_FA'
  ).length;

  // Map active SIGN_FA transactions by signed player ID (`fa-${tx.id}-${fa.id}`, `fa-signed-${fa.id}`) and `fa.id`
  const activeSignFaTxByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of transactions) {
      if (tx.enabled && tx.type === 'SIGN_FA') {
        map.set(`fa-${tx.id}-${tx.freeAgent.id}`, tx.id);
        map.set(`fa-signed-${tx.freeAgent.id}`, tx.id);
        map.set(tx.freeAgent.id, tx.id);
      }
    }
    return map;
  }, [transactions]);

  // Map active player modifications (Extension, Restructure, Tag, 5th-Yr Option, Trade In) for Blue highlight & 1-click Undo
  const activePlayerTxMap = useMemo(() => {
    const map = new Map<string, { txId: string; type: string; label: string }>();
    for (const tx of transactions) {
      if (!tx.enabled) continue;
      if (tx.type === 'EXTENSION') {
        map.set(tx.playerId, {
          txId: tx.id,
          type: 'EXTENSION',
          label: `Extended (${tx.newYearsAdded}yr, $${tx.apy}M/yr)`,
        });
      } else if (tx.type === 'RESTRUCTURE') {
        map.set(tx.playerId, {
          txId: tx.id,
          type: 'RESTRUCTURE',
          label: `Restructured (${tx.actionYear})`,
        });
      } else if (tx.type === 'FRANCHISE_TAG') {
        map.set(tx.playerId, {
          txId: tx.id,
          type: 'FRANCHISE_TAG',
          label: `Tagged ($${tx.tagSalary.toFixed(1)}M)`,
        });
      } else if (tx.type === 'FIFTH_YEAR_OPTION') {
        map.set(tx.playerId, {
          txId: tx.id,
          type: '5TH_YR_OPT',
          label: `5th-Yr Opt ($${tx.optionAmount.toFixed(1)}M)`,
        });
      } else if (tx.type === 'TRADE') {
        for (const inc of tx.incomingPlayers) {
          map.set(inc.id, {
            txId: tx.id,
            type: 'TRADE_IN',
            label: `Acquired (${tx.partnerTeamName})`,
          });
        }
      }
    }
    return map;
  }, [transactions]);

  // Map session-created DeadCapEntry IDs back to their Transaction for 1-click Undo / Restore
  const deadCapTxMap = useMemo(() => {
    const map = new Map<string, (typeof transactions)[number]>();
    for (const entry of activeCapState.deadCapLedger) {
      if (!entry.id.startsWith('dead-tx-')) continue;
      const match = transactions.find(
        (tx) => tx.enabled && entry.id.startsWith(`dead-${tx.id}-`)
      );
      if (match) {
        map.set(entry.id, match);
      }
    }
    return map;
  }, [activeCapState.deadCapLedger, transactions]);

  const sortedDeadCapLedger = useMemo(() => {
    return [...activeCapState.deadCapLedger].sort((a, b) => {
      const aSess = deadCapTxMap.has(a.id) ? 1 : 0;
      const bSess = deadCapTxMap.has(b.id) ? 1 : 0;
      if (aSess !== bSess) return bSess - aSess;
      return (b.amountsByYear[2026] ?? 0) - (a.amountsByYear[2026] ?? 0);
    });
  }, [activeCapState.deadCapLedger, deadCapTxMap]);

  // 1. Build 6-Year Visual Contract & Extension Timeline Rows (2026–2031)
  const timelineRows = useMemo(() => {
    return activeCapState.roster
      .map((player) => buildPlayerContractTimelineRow(player, space2026))
      .sort((a, b) => {
        if (!isCurrentState) {
          // Put newly signed Free Agents & Trade Acquisitions right at the top so the user immediately sees them in the grid!
          const aIsNew =
            isNewFaPlayerId(a.player.id) ||
            activePlayerTxMap.get(a.player.id)?.type === 'TRADE_IN'
              ? 1
              : 0;
          const bIsNew =
            isNewFaPlayerId(b.player.id) ||
            activePlayerTxMap.get(b.player.id)?.type === 'TRADE_IN'
              ? 1
              : 0;
          if (aIsNew !== bIsNew) return bIsNew - aIsNew;
        }

        return (
          getContractYearCapHit(b.player.contractYears[2026]) -
          getContractYearCapHit(a.player.contractYears[2026])
        );
      });
  }, [activeCapState.roster, space2026, isCurrentState, activePlayerTxMap]);

  const effectiveTab =
    !isCurrentState && enabledMovesCount === 0 && rosterCategoryTab === 'MODIFIED'
      ? 'ACTIVE'
      : isCurrentState && rosterCategoryTab === 'MODIFIED'
      ? 'ACTIVE'
      : rosterCategoryTab;

  // Fantasy Lens computed signals & league radars (lazy-computed when active)
  const fantasyEvalByPlayerId = useMemo(() => {
    const map = new Map<string, FantasyPlayerEvaluation>();
    if (!isFantasyLens) return map;
    for (const p of activeCapState.roster) {
      if (isFantasySkillPosition(p.position)) {
        map.set(
          p.id,
          evaluateFantasyPlayerSignal(p, activeCapState.roster, space2026)
        );
      }
    }
    return map;
  }, [isFantasyLens, activeCapState.roster, space2026]);

  const teamFantasyEnv = useMemo(
    () => (isFantasyLens ? evaluateTeamFantasyEnvironment(activeCapState) : null),
    [isFantasyLens, activeCapState]
  );

  const teamCampBattles = useMemo(
    () => (isFantasyLens ? evaluateTeamCampBattles(activeCapState) : []),
    [isFantasyLens, activeCapState]
  );

  const playerHeadshotByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of Object.values(SEED_TEAMS)) {
      for (const p of team.roster) {
        if (p.headshotUrl) {
          map.set(p.name.toLowerCase(), p.headshotUrl);
        }
      }
    }
    for (const fa of SEED_FREE_AGENTS) {
      if (fa.headshotUrl) {
        map.set(fa.name.toLowerCase(), fa.headshotUrl);
      }
    }
    for (const p of activeCapState.roster) {
      if (p.headshotUrl) {
        map.set(p.name.toLowerCase(), p.headshotUrl);
      }
    }
    return map;
  }, [activeCapState.roster]);

  const leagueLandingSpots = useMemo(
    () => (isFantasyLens ? scanLeagueFantasyLandingSpots(SEED_TEAMS) : []),
    [isFantasyLens]
  );

  const fantasyAuditReport = useMemo(
    () =>
      isFantasyLens
        ? auditFantasyRosterPlayers(auditedPlayerNames, SEED_TEAMS)
        : null,
    [isFantasyLens, auditedPlayerNames]
  );

  const allSkillPlayerNames = useMemo(() => {
    if (!isFantasyLens) return [] as string[];
    const names = new Set<string>();
    for (const t of Object.values(SEED_TEAMS)) {
      for (const p of t.roster) {
        if (isFantasySkillPosition(p.position)) {
          names.add(p.name);
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [isFantasyLens]);

  const renderFantasyRowSummary = (fEval: FantasyPlayerEvaluation) => (
    <div className="mt-2 border-t border-dashed border-[#cbd5e1] pt-1.5 space-y-1 text-left">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="border border-[#1e3a5f] bg-[#1e3a5f] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-white">
          {fEval.depthChartSlot}
        </span>
        <span
          className={`border px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold ${getFantasySignalBadgeClass(
            fEval.signal
          )}`}
        >
          {fEval.badgeLabel}
        </span>
        <span className="font-mono-ledger text-[10px] font-semibold text-[#334155]">
          Insulation {fEval.insulationScore}/99
        </span>
      </div>
      <p className="text-[11px] leading-snug text-[#1e293b]">
        {fEval.fantasyTakeaway}
      </p>
      <p className="font-mono-ledger text-[10px] text-[#475569]">
        If Cut/Traded: {fEval.rippleIfCutOrTraded}
      </p>
    </div>
  );

  const filteredTimelineRows = useMemo(() => {
    return timelineRows.filter((row) => {
      if (effectiveTab === 'MODIFIED') {
        const isModified =
          activePlayerTxMap.has(row.player.id) ||
          isNewFaPlayerId(row.player.id);
        if (!isModified) return false;
      }
      if (isFantasyLens) {
        if (posFilter === 'ALL' && !isFantasySkillPosition(row.player.position)) {
          return false;
        }
        if (fantasySignalFilter !== 'ALL') {
          const fEval = fantasyEvalByPlayerId.get(row.player.id);
          if (!fEval || fEval.signal !== fantasySignalFilter) {
            return false;
          }
        }
      }
      if (posFilter !== 'ALL' && row.player.position !== posFilter) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !row.player.name
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      if (timelineFilter === 'HIGH_EXT_LIKELY') {
        return row.extensionLikelihoodPct >= 70;
      }
      if (timelineFilter === 'CUT_RISK_YEARS') {
        return row.cells.some((c) => c.segmentType === 'PAPER_CUT_RISK');
      }
      if (timelineFilter === 'EXPIRING_2026') {
        return row.lastActiveContractYear === 2026;
      }
      if (timelineFilter === 'VOID_BILLS') {
        return row.xray.voidYearsCount > 0;
      }
      if (timelineFilter === 'ADDED_FA') {
        return isNewFaPlayerId(row.player.id);
      }
      return true;
    });
  }, [
    timelineRows,
    effectiveTab,
    activePlayerTxMap,
    isFantasyLens,
    fantasySignalFilter,
    fantasyEvalByPlayerId,
    posFilter,
    searchQuery,
    timelineFilter,
  ]);

  // 2. Positional Needs by Year (2026–2029) Matrix
  const baselinePositionalNeeds = useMemo(
    () => evaluateTeamPositionalNeedsByYear(baselineState),
    [baselineState]
  );

  const positionalNeeds = useMemo(
    () =>
      isCurrentState
        ? baselinePositionalNeeds
        : evaluateTeamPositionalNeedsByYear(derivedState),
    [isCurrentState, baselinePositionalNeeds, derivedState]
  );

  const criticalPositions2026Or2027 = useMemo(() => {
    return positionalNeeds
      .filter(
        (r) =>
          r.cellsByYear[2026].urgency === 'CRITICAL_NEED' ||
          r.cellsByYear[2027].urgency === 'CRITICAL_NEED'
      )
      .map((r) => r.position);
  }, [positionalNeeds]);

  // 3. League-Wide & Internal Free Agent Pools for Bottom Dock
  const mapFaList = (rawList: ReturnType<typeof getLeagueWideFreeAgentPool>) =>
    rawList.map((fa) => ({
      fa,
      evalResult: evaluateFreeAgentTarget(fa),
      sampleContract: buildStructuredContract(
        2026,
        fa.marketYears,
        fa.marketApy,
        fa.marketGuaranteedPct,
        'Backloaded',
        fa.accruedSeasons
      ),
    }));

  const faPool = useMemo(
    () => mapFaList(getLeagueWideFreeAgentPool(baseTeam.id)),
    [baseTeam.id]
  );

  const internalFaPool = useMemo(
    () => mapFaList(getTeamInternalFreeAgents(baseTeam.id)),
    [baseTeam.id]
  );

  const activeDockFaPool =
    faDockSourceTab === 'INTERNAL' ? internalFaPool : faPool;

  const filteredFaPool = useMemo(() => {
    return activeDockFaPool.filter(({ fa }) => {
      if (faPosFilter !== 'ALL' && fa.position !== faPosFilter) {
        return false;
      }
      if (
        faSearchQuery.trim() &&
        !fa.name.toLowerCase().includes(faSearchQuery.trim().toLowerCase()) &&
        !fa.previousTeam
          .toLowerCase()
          .includes(faSearchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [activeDockFaPool, faPosFilter, faSearchQuery]);

  const renderPlayerActionMenu = (
    row: (typeof timelineRows)[number],
    alignClass: string = 'left-0 top-full mt-1'
  ) => {
    const { player, forecast, lastActiveContractYear, extensionWindowYears } = row;
    const restr = simulateRestructure(player, 2026, 1.0, 1);
    const preCut = simulateCutOrTrade(player, 2026, 'PRE_JUNE_1_CUT');
    const postCut = simulateCutOrTrade(player, 2026, 'POST_JUNE_1_CUT');
    const quickTrade = simulateCutOrTrade(player, 2026, 'PRE_JUNE_1_TRADE');
    const extYears = Math.min(3, Math.max(1, extensionWindowYears.length || 3));

    return (
      <div
        role="menu"
        aria-label={`Quick actions for ${player.name}`}
        className={`absolute ${alignClass} z-30 w-72 border-2 border-[#111827] bg-white shadow-xl divide-y divide-[#e2e8f0] text-left`}
      >
        <div className="flex items-center justify-between bg-[#f8fafc] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#475569]">
          <span>1-Tap Move ({player.name})</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenActionMenuPlayerId(null);
            }}
            className="text-[#475569] hover:text-[#111827] cursor-pointer px-1"
            aria-label="Close action menu"
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          disabled={restr.currentYearCapSavings <= 0.05}
          onClick={(e) => {
            e.stopPropagation();
            addRestructureTransaction(player, 1.0, 1, 2026);
            setOpenActionMenuPlayerId(null);
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#eff6ff] disabled:opacity-40 cursor-pointer"
        >
          <span className="font-semibold text-[#111827]">Restructure (Max)</span>
          <span className="font-mono-ledger font-bold text-[#15803d]">
            → {formatCapDelta(restr.currentYearCapSavings)}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addCutTransaction(player, 'PRE_JUNE_1_CUT', 2026);
            setOpenActionMenuPlayerId(null);
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#fef3c7] cursor-pointer"
        >
          <span className="font-semibold text-[#111827]">Release (Pre-6/1)</span>
          <span className="font-mono-ledger text-[11px] font-bold text-[#78350f]">
            → {formatCapDelta(preCut.currentYearCapSavings)} (${preCut.currentYearDeadCap.toFixed(1)}M dead)
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addCutTransaction(player, 'POST_JUNE_1_CUT', 2026);
            setOpenActionMenuPlayerId(null);
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#fef3c7] cursor-pointer"
        >
          <span className="font-semibold text-[#111827]">Release (Post-6/1)</span>
          <span className="font-mono-ledger text-[11px] font-bold text-[#78350f]">
            → {formatCapDelta(postCut.currentYearCapSavings)} (${postCut.currentYearDeadCap.toFixed(1)}M dead)
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addQuickTradeTransaction(player, 'PRE_JUNE_1', 2026);
            setOpenActionMenuPlayerId(null);
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#eff6ff] cursor-pointer"
        >
          <span className="font-semibold text-[#111827]">Trade (Quick Sim)</span>
          <span className="font-mono-ledger text-[11px] font-bold text-[#1e3a5f]">
            → {formatCapDelta(quickTrade.currentYearCapSavings)} (${quickTrade.currentYearDeadCap.toFixed(1)}M dead)
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addExtensionTransaction(
              player,
              extYears,
              forecast.projectedMarketApy,
              0.55,
              'Backloaded',
              lastActiveContractYear
            );
            setOpenActionMenuPlayerId(null);
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-[#dcfce7] cursor-pointer"
        >
          <span className="font-semibold text-[#111827]">
            Quick Extend (+{extYears}yr)
          </span>
          <span className="font-mono-ledger font-bold text-[#15803d]">
            → ~${forecast.projectedMarketApy.toFixed(1)}M/yr
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenActionMenuPlayerId(null);
            selectPlayer(player.id, forecast.recommendedActionTab, 2026);
          }}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#1e3a5f] bg-[#f8fafc] hover:bg-[#e2e8f0] cursor-pointer"
        >
          <span>Custom 4-Door Modal…</span>
          <span>→</span>
        </button>
      </div>
    );
  };

  // 2. Build 4-Bucket Future Roster Outlook for `targetYear`
  const outlook = useMemo(
    () => evaluateFutureSeasonRosterOutlook(activeCapState, targetYear),
    [activeCapState, targetYear]
  );

  const filterList = (list: FutureSeasonPlayerEvaluation[]) => {
    return list.filter((item) => {
      if (posFilter !== 'ALL' && item.player.position !== posFilter) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !item.player.name
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  };

  const filteredSafe = useMemo(
    () => filterList(outlook.safeUnderContract),
    [outlook.safeUnderContract, posFilter, searchQuery]
  );
  const filteredCuts = useMemo(
    () => filterList(outlook.likelyCapCuts),
    [outlook.likelyCapCuts, posFilter, searchQuery]
  );
  const filteredOffContract = useMemo(
    () => filterList(outlook.offContractFreeAgents),
    [outlook.offContractFreeAgents, posFilter, searchQuery]
  );
  const filteredVoid = useMemo(
    () => filterList(outlook.voidYearGhostBills),
    [outlook.voidYearGhostBills, posFilter, searchQuery]
  );

  const renderEvaluationCard = (item: FutureSeasonPlayerEvaluation) => {
    const { player, bucket } = item;
    const xray = computeRealContractXRay(player);
    const career = projectPlayerCareerHorizon(player);

    const badgeStyle =
      bucket === 'SAFE_UNDER_CONTRACT'
        ? 'bg-[#2d5a43]/15 text-[#2d5a43] border-[#2d5a43]/40'
        : bucket === 'LIKELY_CAP_CUT'
        ? 'bg-[#b84a27]/15 text-[#b84a27] border-[#b84a27]/40'
        : bucket === 'OFF_CONTRACT_FA'
        ? item.isPrimeResignCandidate
          ? 'bg-[#b57c1e]/15 text-[#b57c1e] border-[#b57c1e]/40'
          : 'bg-[#ede8dd] text-[#57534e] border-[#c7bfb0]'
        : 'bg-[#1c1917] text-[#f6f3ec] border-[#1c1917]';

    return (
      <div
        key={`${player.id}-${targetYear}`}
        className="flex flex-col justify-between border border-[#dfd9cc] bg-[#fcfaf6] p-5 hover:border-[#1c1917] transition-colors"
      >
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dfd9cc] pb-3.5">
            <button
              type="button"
              onClick={() =>
                isCurrentState
                  ? openPlayerDossier(player, baseTeam.id)
                  : selectPlayer(player.id, item.recommendedActionTab, targetYear)
              }
              className="flex items-center gap-3 text-left cursor-pointer"
            >
              <PlayerAvatar
                name={player.name}
                headshotUrl={player.headshotUrl}
                teamId={baseTeam.id}
                teamLogoUrl={baseTeam.logoUrl}
                size="md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-editorial text-xl text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4">
                    {player.name}
                  </span>
                  <span className="border border-[#cbd5e1] bg-[#f8fafc] px-2 py-0.5 font-mono-ledger text-xs font-semibold text-[#334155]">
                    {player.position} · Age {item.ageInTargetYear} in{' '}
                    {targetYear} · Rating {player.overallRating}/99
                  </span>
                  <span className="border border-[#16a34a] bg-[#dcfce7] px-2 py-0.5 font-mono-ledger text-xs font-semibold text-[#14532d]">
                    ~{career.expectedRemainingStarterYears} starter yr
                    {career.expectedRemainingStarterYears === 1 ? '' : 's'} left
                    (thru ~Age {career.projectedRetirementAge})
                  </span>
                </div>

                <div className="mt-1 font-mono-ledger text-xs font-medium text-[#334155]">
                  {bucket === 'OFF_CONTRACT_FA' ? (
                    <>
                      {targetYear} Cap Hit: <strong>$0.00M (Unsigned)</strong> ·
                      Proj. Market:{' '}
                      <strong className="text-[#1c1917]">
                        ~${item.projectedMarketApy.toFixed(1)}M/yr
                      </strong>
                    </>
                  ) : bucket === 'VOID_GHOST_BILL' ? (
                    <>
                      <JargonTip term="VOID_YEARS">
                        {targetYear} Void Ghost Bill
                      </JargonTip>
                      :{' '}
                      <strong className="text-[#b84a27]">
                        ${item.voidBillAccelerating.toFixed(2)}M Dead Cap
                      </strong>{' '}
                      · Re-Sign Est:{' '}
                      <strong>~${item.projectedMarketApy.toFixed(1)}M/yr</strong>
                    </>
                  ) : (
                    <>
                      {targetYear} Cap Hit:{' '}
                      <strong className="text-[#1c1917]">
                        ${item.capHitInTargetYear.toFixed(2)}M
                      </strong>{' '}
                      (Base ${item.baseSalaryInTargetYear.toFixed(1)}M) · Dead
                      if Cut:{' '}
                      <strong className="text-[#b84a27]">
                        ${item.deadCapIfCutPreJune1.toFixed(1)}M
                      </strong>
                    </>
                  )}
                </div>
              </div>
            </button>

            <div className="text-right">
              <span
                className={`inline-block border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${badgeStyle}`}
              >
                {item.badgeLabel}
              </span>
              <div className="mt-1 font-mono-ledger text-[11px] font-semibold text-[#57534e]">
                {item.subStatusLabel}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#44403c]">
            {item.rationale}
          </p>

          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 border border-[#dfd9cc] bg-[#f6f3ec] p-3 text-xs">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                Headline Remaining Deal (2026–2029)
              </div>
              <div className="mt-0.5 font-mono-ledger font-semibold text-[#1c1917]">
                {xray.headlineYears} yr{xray.headlineYears !== 1 ? 's' : ''} · $
                {xray.headlineTotalCap.toFixed(1)}M (
                <JargonTip term="APY">
                  ${xray.headlineApy.toFixed(1)}M/yr
                </JargonTip>
                )
              </div>
            </div>

            <div className="sm:border-l sm:border-[#dfd9cc] sm:pl-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                <span>The Real Contract X-Ray</span>
                {xray.hasFakeBackEnd && (
                  <AlertTriangle className="h-3 w-3 text-[#b57c1e]" />
                )}
              </div>
              <div
                className={`mt-0.5 font-mono-ledger font-semibold ${
                  xray.hasFakeBackEnd ? 'text-[#b57c1e]' : 'text-[#2d5a43]'
                }`}
              >
                {xray.verdictLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#dfd9cc] flex flex-wrap items-center justify-between gap-2">
          {isCurrentState ? (
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => openPlayerDossier(player, baseTeam.id)}
                className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1.5 text-xs font-semibold text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
              >
                Dossier
              </button>
              <button
                type="button"
                onClick={() =>
                  openInTeamBuilder({
                    playerId: player.id,
                    drawerTab: item.recommendedActionTab,
                    actionYear: targetYear,
                  })
                }
                className="inline-flex items-center gap-1 bg-[#1e40af] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e3a8a] transition-colors cursor-pointer"
              >
                <Wrench className="h-3 w-3" />
                <span>Modify</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {bucket === 'LIKELY_CAP_CUT' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        addCutTransaction(player, 'PRE_JUNE_1_CUT', targetYear)
                      }
                      className="border border-[#b84a27] bg-[#b84a27]/10 px-3 py-1.5 font-mono-ledger text-xs font-semibold text-[#b84a27] hover:bg-[#b84a27] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                    >
                      Cut in {targetYear} (+$
                      {item.capSavingsIfCutPreJune1.toFixed(1)}M)
                    </button>
                    {item.capSavingsIfCutPostJune1 >
                      item.capSavingsIfCutPreJune1 + 1.0 && (
                      <button
                        type="button"
                        onClick={() =>
                          addCutTransaction(
                            player,
                            'POST_JUNE_1_CUT',
                            targetYear,
                          )
                        }
                        className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1.5 font-mono-ledger text-[11px] font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
                      >
                        Post-6/1 Cut (+${item.capSavingsIfCutPostJune1.toFixed(1)}M)
                      </button>
                    )}
                  </>
                )}

                {bucket === 'SAFE_UNDER_CONTRACT' && (
                  <>
                    {item.restructureSavingsInTargetYear >= 2.0 && (
                      <button
                        type="button"
                        onClick={() =>
                          addRestructureTransaction(player, 1.0, 2, targetYear)
                        }
                        className="border border-[#2d5a43] bg-[#2d5a43]/10 px-3 py-1.5 font-mono-ledger text-xs font-semibold text-[#2d5a43] hover:bg-[#2d5a43] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                      >
                        Restructure in {targetYear} (+$
                        {item.restructureSavingsInTargetYear.toFixed(1)}M)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => selectPlayer(player.id, 'extend', targetYear)}
                      className="border border-[#1c1917] bg-[#f6f3ec] px-3 py-1.5 text-xs font-semibold text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                    >
                      Model Extension (~${item.projectedMarketApy.toFixed(1)}M/yr)
                    </button>
                  </>
                )}

                {(bucket === 'OFF_CONTRACT_FA' || bucket === 'VOID_GHOST_BILL') && (
                  <>
                    <button
                      type="button"
                      onClick={() => selectPlayer(player.id, 'extend', targetYear)}
                      className="bg-[#1c1917] px-3.5 py-1.5 text-xs font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                    >
                      Re-Sign / Extend (~${item.projectedMarketApy.toFixed(1)}M/yr)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTeamBuilderSubTab('fa-dock');
                        setFaPosFilter(player.position);
                        document
                          .getElementById('team-builder-workbench')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="border border-[#dfd9cc] bg-[#f6f3ec] px-3 py-1.5 text-xs font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
                    >
                      Find {player.position} Replacement in FA
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openPlayerDossier(player, baseTeam.id)}
                  className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1 text-[11px] font-semibold text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
                >
                  Scouting &amp; Longevity Dossier
                </button>
                <button
                  type="button"
                  onClick={() =>
                    selectPlayer(player.id, item.recommendedActionTab, targetYear)
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1c1917] hover:underline cursor-pointer"
                >
                  <span>4-Door X-Ray ({targetYear})</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const desktopBlockClass =
    deviceLayoutMode === 'PHONE'
      ? 'hidden'
      : deviceLayoutMode === 'DESKTOP'
      ? 'block'
      : 'hidden md:block';

  const mobileBlockClass =
    deviceLayoutMode === 'DESKTOP'
      ? 'hidden'
      : deviceLayoutMode === 'PHONE'
      ? 'block max-w-[480px] mx-auto'
      : 'block md:hidden';

  const isFilteredRoster =
    searchQuery.trim().length > 0 ||
    posFilter !== 'ALL' ||
    timelineFilter !== 'ALL';
  const mobileVisibleRows =
    isFilteredRoster || showAllMobileRoster
      ? filteredTimelineRows
      : filteredTimelineRows.slice(0, 15);

  return (
    <div className="mx-auto max-w-[1440px] px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* 1. Unified Header + Smart Playbooks + Mobile Layout Switch */}
      <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {isCurrentState && (
              <span className="bg-[#b45309] px-2 py-0.5 font-mono-ledger text-[10px] font-bold uppercase tracking-[0.12em] text-white shrink-0">
                Original Baseline
              </span>
            )}
            <h1 className="font-editorial text-[clamp(1.35rem,1rem+1.5vw,1.95rem)] font-bold leading-tight text-[#111827]">
              {baseTeam.city} {baseTeam.name} · {activeCapState.roster.length}-Man Roster
            </h1>
          </div>

          {/* 1-Tap GM Playbooks, Share Build & Compact View Toggles */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={applyAutoCapReliefPlaybook}
              title="Auto-apply up to 3 top restructures and clean casualty cuts to clear cap space"
              className="inline-flex items-center gap-1 border border-[#15803d] bg-[#f0fdf4] px-2.5 py-1.5 text-xs font-semibold text-[#14532d] hover:bg-[#15803d] hover:text-white transition-colors cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>⚡ Auto-Clear Cap</span>
            </button>

            <button
              type="button"
              onClick={applyExtendCorePillarsPlaybook}
              title="Extend up to 3 prime young core starters (85+ OVR, age <= 27) entering extension windows"
              className="inline-flex items-center gap-1 border border-[#1e3a5f] bg-[#eff6ff] px-2.5 py-1.5 text-xs font-semibold text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white transition-colors cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>🔒 Extend Core Pillars</span>
            </button>

            <button
              type="button"
              onClick={toggleFantasyLens}
              title="Focus on QB/RB/WR/TE contract insulation, paper-contract traps, rookie landing spots & Sleeper roster audit"
              className={`inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                isFantasyLens
                  ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                  : 'border-[#7c3aed]/60 bg-[#f5f3ff] text-[#4c1d95] hover:bg-[#7c3aed] hover:text-white'
              }`}
            >
              <span>🏈 Fantasy Lens{isFantasyLens ? ' · ON' : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const shareUrl = buildShareableScenarioUrl(
                  window.location.href,
                  baseTeam.id,
                  transactions
                );
                window.history.replaceState(null, '', shareUrl);
                navigator.clipboard?.writeText(shareUrl);
                setCopiedShareUrl(true);
                setTimeout(() => setCopiedShareUrl(false), 2500);
              }}
              title="Copy shareable link with your current team & offseason moves"
              className="inline-flex items-center gap-1 border border-[#111827] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827] hover:bg-[#111827] hover:text-white transition-colors cursor-pointer"
            >
              {copiedShareUrl ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#15803d]" />
                  <span>✓ Link Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  <span>🔗 Share Build</span>
                </>
              )}
            </button>

            {/* Phone vs Desktop Layout Switcher */}
            <div className="hidden md:inline-flex border border-[#c7bfb0] bg-[#f6f3ec] p-0.5">
              <button
                type="button"
                onClick={() =>
                  setDeviceLayoutMode((m) => (m === 'PHONE' ? 'AUTO' : 'PHONE'))
                }
                title="Preview iPhone / Pixel Mobile Card View"
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  deviceLayoutMode === 'PHONE'
                    ? 'bg-[#1c1917] text-[#f6f3ec]'
                    : 'text-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Phone</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeviceLayoutMode((m) =>
                    m === 'DESKTOP' ? 'AUTO' : 'DESKTOP'
                  )
                }
                title="Force Full Desktop Table"
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  deviceLayoutMode === 'DESKTOP'
                    ? 'bg-[#1c1917] text-[#f6f3ec]'
                    : 'text-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
            </div>

            <div className="inline-flex border border-[#dfd9cc] bg-[#f6f3ec] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('TIMELINE_BARS')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'TIMELINE_BARS'
                    ? 'bg-[#1c1917] text-[#f6f3ec]'
                    : 'text-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Timeline</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('BUCKET_CARDS')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'BUCKET_CARDS'
                    ? 'bg-[#1c1917] text-[#f6f3ec]'
                    : 'text-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Buckets</span>
              </button>
            </div>
          </div>
        </div>

        {/* Baseline Peek Banner OR Quick Workbench Jump + Move Log */}
        {isCurrentState ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#dfd9cc] pb-3 text-xs">
            <span className="font-mono-ledger font-semibold text-[#b45309]">
              Comparing untouched baseline ({enabledMovesCount} move
              {enabledMovesCount === 1 ? '' : 's'} paused from view)
            </span>
            <button
              type="button"
              onClick={() => setCompareOriginalBaseline(false)}
              className="border border-[#15803d] bg-[#15803d] px-3 py-1 font-semibold text-white hover:bg-[#14532d] transition-colors cursor-pointer"
            >
              Return to Projected Moves →
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5 border-b border-[#dfd9cc] pb-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#475569]">
                  Tools:
                </span>
                {(
                  [
                    ['fa-dock', '+ Free Agents'],
                    ['cap-fixes', 'Cap Fixes'],
                    ['draft-trade', 'Trades & Draft'],
                    ['ledger', '4-Yr Ledger'],
                  ] as [TeamBuilderSubTab, string][]
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setTeamBuilderSubTab(tabKey);
                      document
                        .getElementById('team-builder-workbench')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      teamBuilderSubTab === tabKey
                        ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                        : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {enabledMovesCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="border border-[#2d5a43]/40 bg-[#2d5a43]/10 px-2.5 py-1 font-mono-ledger text-[11px] font-semibold text-[#2d5a43]">
                    {enabledMovesCount} Active Move
                    {enabledMovesCount === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    onClick={resetScenarioStack}
                    className="inline-flex items-center gap-1 border border-[#b84a27]/40 bg-[#b84a27]/10 px-2.5 py-1 text-[11px] font-semibold text-[#b84a27] hover:bg-[#b84a27] hover:text-[#f6f3ec] cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live Chronological Move Log with Per-Move 1-Tap Undo */}
            {transactions.length > 0 && (
              <div className="pt-0.5">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {transactions.map((tx, idx) => (
                    <div
                      key={tx.id}
                      className={`shrink-0 inline-flex items-center gap-2 border px-2.5 py-1 text-[11px] font-mono-ledger ${
                        tx.enabled
                          ? 'border-[#2563eb]/50 bg-[#eff6ff] text-[#1e3a5f]'
                          : 'border-[#cbd5e1] bg-[#f8fafc] text-[#64748b] opacity-60 line-through'
                      }`}
                    >
                      <span className="font-bold text-[#475569]">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-[#111827]">
                        {tx.label}
                      </span>
                      {tx.capDelta2026 !== 0 && (
                        <span
                          className={`font-bold ${
                            tx.capDelta2026 >= 0
                              ? 'text-[#15803d]'
                              : 'text-[#b91c1c]'
                          }`}
                        >
                          {formatCapDelta(tx.capDelta2026)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTransaction(tx.id)}
                        title={`Undo move #${idx + 1}: ${tx.label}`}
                        className="inline-flex items-center gap-0.5 border border-[#b91c1c]/40 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#b91c1c] hover:bg-[#b91c1c] hover:text-white transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actionable "2026 Team Needs — Tap Any Need to Solve It" Strip */}
        {(() => {
          const urgent2026 = positionalNeeds.filter(
            (r) =>
              r.cellsByYear[2026].urgency === 'CRITICAL_NEED' ||
              r.cellsByYear[2026].urgency === 'DEPTH_NEED'
          );
          const fallback2027 = positionalNeeds.filter(
            (r) => r.cellsByYear[2027].urgency === 'CRITICAL_NEED'
          );
          const needRows = urgent2026.length > 0 ? urgent2026 : fallback2027;

          const solverInternalFas = selectedNeedSolverPos
            ? internalFaPool.filter(
                (item) => item.fa.position === selectedNeedSolverPos
              )
            : [];
          const solverLeagueFas = selectedNeedSolverPos
            ? faPool
                .filter((item) => item.fa.position === selectedNeedSolverPos)
                .slice(0, 3)
            : [];
          const solverDraftPicks = activeCapState.draftPicks
            .filter((pk) => pk.year === 2026 && !pk.selectedPlayerName)
            .slice(0, 2);

          return (
            <div
              id="need-solver-strip"
              className="scroll-mt-24 mt-3 border-b border-[#dfd9cc] pb-3 space-y-2.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#b84a27] mr-1">
                  2026 Needs (Tap to Fill):
                </span>
                {needRows.length === 0 ? (
                  <span className="border border-[#16a34a] bg-[#f0fdf4] px-2.5 py-1 font-mono-ledger text-xs font-semibold text-[#14532d]">
                    ✓ All 2026 Starter Spots Filled
                  </span>
                ) : (
                  needRows.map((row) => {
                    const isCritical =
                      row.cellsByYear[2026].urgency === 'CRITICAL_NEED';
                    const isOpen = selectedNeedSolverPos === row.position;
                    return (
                      <button
                        key={row.position}
                        type="button"
                        onClick={() =>
                          setSelectedNeedSolverPos(
                            isOpen ? null : row.position
                          )
                        }
                        className={`shrink-0 min-h-[34px] border px-2.5 py-1 font-mono-ledger text-xs font-bold transition-colors cursor-pointer ${
                          isOpen
                            ? 'border-[#111827] bg-[#111827] text-white'
                            : isCritical
                            ? 'border-[#dc2626] bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca]'
                            : 'border-[#d97706] bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]'
                        }`}
                      >
                        ★ Need {row.position}
                      </button>
                    );
                  })
                )}
                <a
                  href="#positional-needs-matrix"
                  className="ml-auto font-mono-ledger text-[11px] font-semibold text-[#475569] hover:text-[#111827] underline"
                >
                  Full Needs Grid ↓
                </a>
              </div>

              {selectedNeedSolverPos && (
                <div className="border-2 border-[#111827] bg-white p-3.5 sm:p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-[#dfd9cc] pb-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#b84a27]" />
                      <h3 className="font-editorial text-base sm:text-lg font-bold text-[#111827]">
                        Solve {selectedNeedSolverPos} Need in 1 Tap
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNeedSolverPos(null)}
                      className="inline-flex items-center gap-1 border border-[#cbd5e1] bg-[#f8fafc] px-2 py-1 text-xs font-semibold text-[#334155] hover:border-[#111827] cursor-pointer"
                    >
                      <span>Close</span>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Column 1: Re-Sign Internal Pending FAs */}
                    <div className="border border-[#d6d0c4] bg-[#f0fdf4]/50 p-3 space-y-2">
                      <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#14532d]">
                        1. Re-Sign {baseTeam.abbreviation} Pending FAs (Comp-Pick Safe)
                      </div>
                      {solverInternalFas.length === 0 ? (
                        <div className="text-[11px] text-[#64748b] py-2">
                          No pending {selectedNeedSolverPos} internal free agents listed.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {solverInternalFas.map(({ fa }) => {
                            const existingTx = activeSignFaTxByPlayerId.get(fa.id);
                            const valueBadge = evaluateFreeAgentValueBadge(fa);
                            const compRound = projectCompPickRound(fa.marketApy);
                            return (
                              <div
                                key={`solv-int-${fa.id}`}
                                className="flex items-center justify-between gap-2 border border-[#bbf7d0] bg-white p-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <PlayerAvatar
                                    name={fa.name}
                                    headshotUrl={
                                      fa.headshotUrl ??
                                      playerHeadshotByName.get(
                                        fa.name.toLowerCase()
                                      )
                                    }
                                    teamId={baseTeam.id}
                                    teamLogoUrl={baseTeam.logoUrl}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate font-bold text-[#111827]">
                                      {fa.name}
                                    </div>
                                    <div className="font-mono-ledger text-[10px] text-[#475569]">
                                      Age {fa.ageIn2026} · Mkt {fa.marketYears}yr / $
                                      {fa.marketApy.toFixed(1)}M
                                      {compRound
                                        ? ` · If Walks: Rd ${compRound} Comp`
                                        : ''}
                                    </div>
                                    <span
                                      title={valueBadge.reason}
                                      className={`mt-1 inline-block border px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold ${getFaValueBadgeClass(
                                        valueBadge.tier
                                      )}`}
                                    >
                                      {valueBadge.badgeLabel}
                                    </span>
                                  </div>
                                </div>
                                {existingTx ? (
                                  <button
                                    type="button"
                                    onClick={() => removeTransaction(existingTx)}
                                    className="shrink-0 border border-[#2563eb] bg-[#2563eb] px-2 py-1 font-mono-ledger text-[10px] font-semibold text-white cursor-pointer"
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addSignFATransaction(
                                          fa,
                                          fa.marketYears,
                                          fa.marketApy,
                                          fa.marketGuaranteedPct,
                                          'Backloaded'
                                        )
                                      }
                                      className="bg-[#15803d] px-2 py-1 font-mono-ledger text-[10px] font-bold text-white hover:bg-[#14532d] cursor-pointer"
                                    >
                                      Re-Sign
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addSignFATransaction(fa, 1, 1.2, 0, 'Flat')
                                      }
                                      className="border border-[#15803d] bg-[#f0fdf4] px-1.5 py-1 font-mono-ledger text-[10px] font-bold text-[#14532d] cursor-pointer"
                                    >
                                      $1.2M
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Sign Top Open-Market FAs */}
                    <div className="border border-[#d6d0c4] bg-[#fcfaf6] p-3 space-y-2">
                      <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f]">
                        2. Sign Top League {selectedNeedSolverPos} Free Agents
                      </div>
                      {solverLeagueFas.length === 0 ? (
                        <div className="text-[11px] text-[#64748b] py-2">
                          No open-market {selectedNeedSolverPos} targets matched.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {solverLeagueFas.map(({ fa, evalResult }) => {
                            const existingTx = activeSignFaTxByPlayerId.get(fa.id);
                            const valueBadge = evaluateFreeAgentValueBadge(fa);
                            return (
                              <div
                                key={`solv-lg-${fa.id}`}
                                className="flex items-center justify-between gap-2 border border-[#d6d0c4] bg-white p-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <PlayerAvatar
                                    name={fa.name}
                                    headshotUrl={
                                      fa.headshotUrl ??
                                      playerHeadshotByName.get(
                                        fa.name.toLowerCase()
                                      )
                                    }
                                    teamId={fa.previousTeam.split(' ')[0]}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="truncate font-bold text-[#111827]">
                                      {fa.name}{' '}
                                      <span className="font-mono-ledger text-[10px] font-normal text-[#475569]">
                                        ({fa.previousTeam})
                                      </span>
                                    </div>
                                    <div className="font-mono-ledger text-[10px] text-[#475569]">
                                      Age {fa.ageIn2026} · {fa.marketYears}yr / $
                                      {fa.marketApy.toFixed(1)}M
                                      {evalResult.countsTowardCompFormula &&
                                      evalResult.projectedCompPickRound
                                        ? ` · Proj. Rd ${evalResult.projectedCompPickRound} Comp`
                                        : ' · Comp-Safe'}
                                    </div>
                                    <span
                                      title={valueBadge.reason}
                                      className={`mt-1 inline-block border px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold ${getFaValueBadgeClass(
                                        valueBadge.tier
                                      )}`}
                                    >
                                      {valueBadge.badgeLabel}
                                    </span>
                                  </div>
                                </div>
                                {existingTx ? (
                                  <button
                                    type="button"
                                    onClick={() => removeTransaction(existingTx)}
                                    className="shrink-0 border border-[#2563eb] bg-[#2563eb] px-2 py-1 font-mono-ledger text-[10px] font-semibold text-white cursor-pointer"
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addSignFATransaction(
                                          fa,
                                          fa.marketYears,
                                          fa.marketApy,
                                          fa.marketGuaranteedPct,
                                          'Backloaded'
                                        )
                                      }
                                      className="bg-[#1c1917] px-2 py-1 font-mono-ledger text-[10px] font-bold text-white hover:bg-[#1e3a5f] cursor-pointer"
                                    >
                                      + Sign
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addSignFATransaction(fa, 1, 1.2, 0, 'Flat')
                                      }
                                      className="border border-[#15803d] bg-[#f0fdf4] px-1.5 py-1 font-mono-ledger text-[10px] font-bold text-[#14532d] cursor-pointer"
                                    >
                                      $1.2M
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Column 3: Draft a Prospect (2026 Picks) */}
                    <div className="border border-[#d6d0c4] bg-[#eff6ff]/50 p-3 space-y-2">
                      <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f]">
                        3. Draft a {selectedNeedSolverPos} (2026 Picks)
                      </div>
                      {solverDraftPicks.length === 0 ? (
                        <div className="text-[11px] text-[#64748b] py-2">
                          No remaining unsigned 2026 picks.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {solverDraftPicks.map((pk) => {
                            const cutoff =
                              activeCapState.years[2026]
                                ?.replacementLevelCutoff ?? 1.17;
                            const slot = generateRookieContract(
                              pk.overallPick,
                              2026,
                              selectedNeedSolverPos,
                              cutoff
                            );
                            return (
                              <div
                                key={`solv-pk-${pk.id}`}
                                className="flex items-center justify-between gap-2 border border-[#bfdbfe] bg-white p-2"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-[#111827]">
                                    Rd {pk.round} · Pick #{pk.overallPick}
                                  </div>
                                  <div className="font-mono-ledger text-[10px] text-[#475569]">
                                    Yr-1: ${slot.year1CapHit.toFixed(2)}M (Net −$
                                    {slot.year1NetCapImpactAfterDisplacement.toFixed(
                                      2
                                    )}
                                    M)
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addDraftSigningTransaction({
                                      pickId: pk.id,
                                      overallPick: pk.overallPick,
                                      round: pk.round,
                                      prospectName: `${selectedNeedSolverPos} Prospect (#${pk.overallPick})`,
                                      position: selectedNeedSolverPos,
                                    })
                                  }
                                  className="shrink-0 bg-[#1e3a5f] px-2.5 py-1.5 font-mono-ledger text-[10px] font-bold text-white hover:bg-[#152c4a] cursor-pointer"
                                >
                                  Draft #{pk.overallPick} {selectedNeedSolverPos}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Consolidated Roster & Market Category Tabs */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#dfd9cc] pb-3 text-xs">
          {(
            [
              {
                id: 'ACTIVE',
                label: `Active Roster (${activeCapState.roster.length})`,
              },
              {
                id: 'DEAD_MONEY',
                label: `Dead Money (${activeCapState.deadCapLedger.length} · $${activeCapState.years[2026].deadMoneyTotal.toFixed(1)}M)`,
              },
              {
                id: 'DRAFT_PICKS',
                label: `Draft Picks (${activeCapState.draftPicks.length})`,
              },
              ...(!isCurrentState && enabledMovesCount > 0
                ? [
                    {
                      id: 'MODIFIED' as RosterCategoryTab,
                      label: `Modified Moves (${enabledMovesCount})`,
                    },
                  ]
                : []),
            ] as { id: RosterCategoryTab; label: string }[]
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setRosterCategoryTab(cat.id);
                setOpenActionMenuPlayerId(null);
              }}
              className={`shrink-0 whitespace-nowrap min-h-[36px] border px-3 py-1.5 font-mono-ledger text-xs font-semibold transition-colors cursor-pointer ${
                effectiveTab === cat.id
                  ? cat.id === 'MODIFIED'
                    ? 'border-[#2563eb] bg-[#2563eb] text-white'
                    : 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                  : 'border-[#d6d0c4] bg-white text-[#334155] hover:border-[#111827] hover:text-[#111827]'
              }`}
            >
              {cat.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setCompareOriginalBaseline(false);
              setFaDockSourceTab('INTERNAL');
              setTeamBuilderSubTab('fa-dock');
              setTimeout(() => {
                document
                  .getElementById('add-free-agents-dock')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 60);
            }}
            className="shrink-0 whitespace-nowrap min-h-[36px] border border-[#15803d] bg-[#f0fdf4] px-3 py-1.5 font-mono-ledger text-xs font-semibold text-[#14532d] hover:bg-[#15803d] hover:text-white transition-colors cursor-pointer"
          >
            + Pending FAs ({internalFaPool.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setCompareOriginalBaseline(false);
              setFaDockSourceTab('LEAGUE');
              setTeamBuilderSubTab('fa-dock');
              setTimeout(() => {
                document
                  .getElementById('add-free-agents-dock')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 60);
            }}
            className="shrink-0 whitespace-nowrap min-h-[36px] border border-[#1c1917] bg-[#fcfaf6] px-3 py-1.5 font-mono-ledger text-xs font-semibold text-[#111827] hover:bg-[#1c1917] hover:text-white transition-colors cursor-pointer"
          >
            + Open Market FAs
          </button>
        </div>

        {/* Search & Position Filter Bar (Shown for Active Roster & Modified Roster Tabs) */}
        {(effectiveTab === 'ACTIVE' || effectiveTab === 'MODIFIED') && (
        <div className="mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Filter ${baseTeam.name} ${activeCapState.roster.length}-man roster...`}
                className="w-full min-h-[40px] border border-[#111827] bg-white py-2 pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#64748b] focus:outline-none"
              />
            </div>

            <div className="hidden sm:block">
              <GlobalPlayerSearch
                placeholder="Or lookup any NFL player (age, yrs left, deal)..."
                className="w-64 lg:w-72"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 snap-x lg:flex-wrap lg:overflow-visible">
            <span className="shrink-0 mr-1 text-xs font-bold uppercase tracking-[0.08em] text-[#475569]">
              Pos:
            </span>
            <button
              type="button"
              onClick={toggleFantasyLens}
              className={`shrink-0 snap-start min-h-[36px] border px-2.5 py-1 font-mono-ledger text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isFantasyLens
                  ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                  : 'border-[#7c3aed]/50 bg-[#f5f3ff] text-[#4c1d95] hover:bg-[#ede9fe]'
              }`}
            >
              🏈 Fantasy{isFantasyLens ? ' (Skill)' : ''}
            </button>
            {ALL_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosFilter(pos)}
                className={`shrink-0 snap-start min-h-[36px] px-3 py-1 font-mono-ledger text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  posFilter === pos
                    ? 'bg-[#1e3a5f] text-white'
                    : 'bg-[#f1f5f9] sm:bg-transparent text-[#334155] hover:bg-[#ebe6dc] hover:text-[#111827]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
        )}
      </section>

      {/* =====================================================================
          FANTASY FOOTBALL LENS HUB (INSULATION · LANDING SPOTS · SLEEPER AUDIT)
         ===================================================================== */}
      {isFantasyLens && teamFantasyEnv && (
        <section className="border-2 border-[#7c3aed]/50 bg-[#fcfaf6] p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-3.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#7c3aed] px-2 py-0.5 font-mono-ledger text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                  🏈 Fantasy Football Lens
                </span>
                <span className="font-mono-ledger text-xs font-semibold text-[#334155]">
                  {baseTeam.abbreviation} OL Grade {teamFantasyEnv.olGrade} ·{' '}
                  {teamFantasyEnv.qbStability}
                </span>
              </div>
              <h2 className="font-editorial text-lg sm:text-xl font-bold text-[#111827]">
                Contract Insulation, Vacated Opportunities &amp; Dynasty Audit
              </h2>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
              {(
                [
                  {
                    id: 'TEAM_INSULATION',
                    label: `${baseTeam.abbreviation} Skill Insulation`,
                  },
                  {
                    id: 'LANDING_SPOTS',
                    label: `League Landing Spots (${leagueLandingSpots.length})`,
                  },
                  {
                    id: 'ROSTER_AUDIT',
                    label: 'Sleeper / My Dynasty Audit',
                  },
                ] as {
                  id: 'TEAM_INSULATION' | 'LANDING_SPOTS' | 'ROSTER_AUDIT';
                  label: string;
                }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFantasyHubTab(tab.id)}
                  className={`shrink-0 whitespace-nowrap min-h-[36px] border px-3 py-1.5 font-mono-ledger text-xs font-semibold transition-colors cursor-pointer ${
                    fantasyHubTab === tab.id
                      ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                      : 'border-[#d6d0c4] bg-white text-[#1e293b] hover:border-[#7c3aed]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {fantasyHubTab === 'TEAM_INSULATION' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="border border-[#d6d0c4] bg-white p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                      1. OL Blocking &amp; Continuity
                    </span>
                    <span
                      className={`border px-2 py-0.5 font-mono-ledger text-xs font-bold ${
                        teamFantasyEnv.olGrade === 'A' ||
                        teamFantasyEnv.olGrade === 'B'
                          ? 'border-[#16a34a] bg-[#dcfce7] text-[#14532d]'
                          : 'border-[#d97706] bg-[#fef3c7] text-[#92400e]'
                      }`}
                    >
                      Grade {teamFantasyEnv.olGrade}
                    </span>
                  </div>
                  <p className="font-semibold text-[#111827]">
                    {teamFantasyEnv.olSummary}
                  </p>
                  <p className="text-[11px] text-[#475569]">
                    Strong OL continuity raises RB efficiency &amp; QB sack insulation across multi-year Dynasty windows.
                  </p>
                </div>

                <div className="border border-[#d6d0c4] bg-white p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                      2. QB Stability &amp; Floor
                    </span>
                    <span
                      className={`border px-2 py-0.5 font-mono-ledger text-[10px] font-bold ${
                        teamFantasyEnv.qbStability === 'Locked Franchise QB'
                          ? 'border-[#16a34a] bg-[#dcfce7] text-[#14532d]'
                          : 'border-[#d97706] bg-[#fef3c7] text-[#92400e]'
                      }`}
                    >
                      {teamFantasyEnv.qbStability}
                    </span>
                  </div>
                  <p className="font-semibold text-[#111827]">
                    {teamFantasyEnv.qbName}
                  </p>
                  <p className="text-[11px] text-[#475569]">
                    {teamFantasyEnv.qbSummary}
                  </p>
                </div>

                <div className="border border-[#d6d0c4] bg-white p-3.5 space-y-1.5">
                  <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#b84a27]">
                    3. Vacated Opportunity &amp; Cut Ripples
                  </div>
                  {teamFantasyEnv.vacatedTouchesSummary.length === 0 ? (
                    <p className="text-[11px] text-[#14532d] font-medium">
                      Locked skill core — no urgent 2026 starter cuts or expiring departures flagged.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-[11px] text-[#1e293b]">
                      {teamFantasyEnv.vacatedTouchesSummary.map((line, i) => (
                        <li key={i} className="leading-snug">
                          • {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Red #10: Follow the Money — RB / WR / TE Camp Battle & Touch Share Decoder */}
              {teamCampBattles.length > 0 && (
                <div className="border border-[#d6d0c4] bg-white p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f]">
                      Follow the Money · RB / WR / TE Touch-Share &amp; Camp Battle Decoder (2026 Dead Cap Lock)
                    </div>
                    <span className="font-mono-ledger text-[10px] text-[#64748b]">
                      Coaches play who carries dead money
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    {teamCampBattles.map((battle) => {
                      const badgeTone =
                        battle.hierarchyType === 'CLEAR_ALPHA_LOCK'
                          ? 'border-[#16a34a]/50 bg-[#f0fdf4] text-[#14532d]'
                          : battle.hierarchyType === 'CO_STARTER_INVESTMENT'
                          ? 'border-[#2563eb]/50 bg-[#eff6ff] text-[#1e3a5f]'
                          : 'border-[#d97706]/50 bg-[#fffbeb] text-[#92400e]';
                      return (
                        <div
                          key={battle.position}
                          className="border border-[#dfd9cc] bg-[#fcfaf6] p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-ledger text-[11px] font-bold text-[#111827]">
                              {battle.position} Room
                            </span>
                            <span
                              className={`border px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold ${badgeTone}`}
                            >
                              {battle.badgeLabel}
                            </span>
                          </div>
                          <div className="space-y-1.5 font-mono-ledger text-[11px] text-[#334155]">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar
                                name={battle.leaderName}
                                headshotUrl={playerHeadshotByName.get(
                                  battle.leaderName.toLowerCase()
                                )}
                                teamId={baseTeam.id}
                                teamLogoUrl={baseTeam.logoUrl}
                                size="sm"
                              />
                              <span>
                                <strong>#1 {battle.leaderName}</strong> ($
                                {battle.leaderDeadCap2026.toFixed(1)}M dead)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <PlayerAvatar
                                name={battle.challengerName}
                                headshotUrl={playerHeadshotByName.get(
                                  battle.challengerName.toLowerCase()
                                )}
                                teamId={baseTeam.id}
                                teamLogoUrl={baseTeam.logoUrl}
                                size="sm"
                              />
                              <span>
                                <strong>#2 {battle.challengerName}</strong> ($
                                {battle.challengerDeadCap2026.toFixed(1)}M dead)
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] leading-snug text-[#475569]">
                            {battle.takeaway}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 1-Tap Signal Filter Strip for Active Roster Grid Below */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
                <span className="shrink-0 font-mono-ledger text-[11px] font-bold uppercase tracking-wider text-[#475569] mr-1">
                  Signal Filter:
                </span>
                {(
                  [
                    { id: 'ALL', label: 'All Skill Players (QB/RB/WR/TE)' },
                    { id: 'INSULATED_ALPHA', label: '🔒 Insulated Alphas' },
                    { id: 'PAPER_TRAP', label: '⚠️ Paper Traps (Sell)' },
                    { id: 'BREAKOUT_STASH', label: '🚀 Breakout Stashes (Buy)' },
                    { id: 'TAG_OR_UFA_WATCH', label: '⏳ 2027 UFA / Tag' },
                  ] as { id: 'ALL' | FantasySignalType; label: string }[]
                ).map((sig) => (
                  <button
                    key={sig.id}
                    type="button"
                    onClick={() => setFantasySignalFilter(sig.id)}
                    className={`shrink-0 whitespace-nowrap min-h-[34px] border px-2.5 py-1 font-mono-ledger text-xs font-semibold transition-colors cursor-pointer ${
                      fantasySignalFilter === sig.id
                        ? 'border-[#111827] bg-[#111827] text-white'
                        : 'border-[#d6d0c4] bg-white text-[#334155] hover:border-[#111827]'
                    }`}
                  >
                    {sig.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fantasyHubTab === 'LANDING_SPOTS' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  {(['ALL', 'RB', 'WR', 'TE', 'QB'] as const).map((posOpt) => (
                    <button
                      key={posOpt}
                      type="button"
                      onClick={() => setLandingSpotPosFilter(posOpt)}
                      className={`shrink-0 min-h-[34px] border px-3 py-1 font-mono-ledger text-xs font-bold transition-colors cursor-pointer ${
                        landingSpotPosFilter === posOpt
                          ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                          : 'border-[#d6d0c4] bg-white text-[#334155] hover:border-[#111827]'
                      }`}
                    >
                      {posOpt === 'ALL' ? 'All Positions' : posOpt}
                    </button>
                  ))}
                </div>
                <span className="font-mono-ledger text-[11px] text-[#475569]">
                  32-team scan combining vacating starters, OL grade, &apos;26 cap space &amp; Day 1–2 draft ammo
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
                {leagueLandingSpots
                  .filter(
                    (spot) =>
                      landingSpotPosFilter === 'ALL' ||
                      spot.position === landingSpotPosFilter
                  )
                  .map((spot) => (
                    <div
                      key={spot.id}
                      className="border border-[#d6d0c4] bg-white p-3.5 flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-ledger text-xs font-bold text-[#111827]">
                            {spot.teamAbbr} · {spot.position} Room
                          </span>
                          <span className="border border-[#7c3aed]/50 bg-[#f5f3ff] px-2 py-0.5 font-mono-ledger text-[10px] font-bold text-[#4c1d95]">
                            Opp {spot.opportunityScore}/99
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="border border-[#1e3a5f]/30 bg-[#eff6ff] px-2 py-0.5 font-mono-ledger text-[10px] font-bold text-[#1e3a5f]">
                            {spot.archetypeBadge}
                          </span>
                          <span className="font-mono-ledger text-[10px] text-[#475569]">
                            OL Grade {spot.olGrade}
                          </span>
                        </div>
                        <p className="font-semibold text-[#111827] leading-snug">
                          {spot.headline}
                        </p>
                        {spot.vacatingOrAtRiskPlayers.length > 0 && (
                          <div className="text-[11px] text-[#991b1b] font-medium">
                            At Risk / Expiring:{' '}
                            {spot.vacatingOrAtRiskPlayers.join(', ')}
                          </div>
                        )}
                        {spot.inHouseBeneficiary && (
                          <div className="text-[11px] text-[#4c1d95] font-medium">
                            In-House Stash: {spot.inHouseBeneficiary}
                          </div>
                        )}
                        <div className="font-mono-ledger text-[10px] text-[#475569]">
                          {spot.capAndDraftAmmo}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          selectTeam(spot.teamId);
                          setPosFilter(spot.position);
                          setFantasyHubTab('TEAM_INSULATION');
                        }}
                        className="w-full border border-[#1e3a5f] bg-[#fcfaf6] px-2.5 py-1.5 font-mono-ledger text-xs font-semibold text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white transition-colors cursor-pointer"
                      >
                        View {spot.teamAbbr} {spot.position} Board →
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {fantasyHubTab === 'ROSTER_AUDIT' && fantasyAuditReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                {/* Sleeper Zero-Login Importer */}
                <div className="border border-[#d6d0c4] bg-white p-3.5 space-y-2">
                  <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f]">
                    1. Import Sleeper Fantasy Roster (Zero Login)
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sleeperUsername}
                      onChange={(e) => setSleeperUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleImportSleeper();
                      }}
                      placeholder="Enter public Sleeper username..."
                      className="flex-1 min-h-[38px] border border-[#111827] bg-white px-3 py-1.5 text-xs text-[#111827] placeholder:text-[#64748b] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={sleeperLoading}
                      onClick={handleImportSleeper}
                      className="shrink-0 min-h-[38px] bg-[#1e3a5f] px-3 py-1.5 font-mono-ledger text-xs font-semibold text-white hover:bg-[#152c4a] disabled:opacity-60 cursor-pointer"
                    >
                      {sleeperLoading ? 'Loading...' : 'Import Sleeper'}
                    </button>
                  </div>
                  {sleeperLeagues.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-mono-ledger text-[10px] text-[#475569]">
                        Leagues:
                      </span>
                      {sleeperLeagues.map((lg) => (
                        <button
                          key={lg.league_id}
                          type="button"
                          onClick={() =>
                            loadSleeperLeagueRoster(
                              lg.league_id,
                              lg.userId,
                              lg.name
                            )
                          }
                          className={`border px-2 py-0.5 font-mono-ledger text-[10px] font-semibold cursor-pointer ${
                            selectedSleeperLeagueId === lg.league_id
                              ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                              : 'border-[#cbd5e1] bg-[#f8fafc] text-[#334155]'
                          }`}
                        >
                          {lg.name} ({lg.season})
                        </button>
                      ))}
                    </div>
                  )}
                  {sleeperStatusMsg && (
                    <p className="font-mono-ledger text-[11px] text-[#1e3a5f]">
                      {sleeperStatusMsg}
                    </p>
                  )}
                </div>

                {/* Manual Quick-Add Skill Player + Sample Reset */}
                <div className="border border-[#d6d0c4] bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#1e3a5f]">
                      2. Quick-Add / Customize Audited Roster
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuditedPlayerNames(SAMPLE_DYNASTY_ROSTER_NAMES);
                        setSleeperStatusMsg('Loaded Sample Dynasty Roster.');
                      }}
                      className="font-mono-ledger text-[10px] font-semibold text-[#7c3aed] hover:underline cursor-pointer"
                    >
                      Reset to Sample Dynasty Team
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      list="fantasy-skill-players-datalist"
                      value={auditPlayerInput}
                      onChange={(e) => setAuditPlayerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && auditPlayerInput.trim()) {
                          setAuditedPlayerNames((prev) => [
                            auditPlayerInput.trim(),
                            ...prev,
                          ]);
                          setAuditPlayerInput('');
                        }
                      }}
                      placeholder="Add QB / RB / WR / TE by name..."
                      className="flex-1 min-h-[38px] border border-[#111827] bg-white px-3 py-1.5 text-xs text-[#111827] placeholder:text-[#64748b] focus:outline-none"
                    />
                    <datalist id="fantasy-skill-players-datalist">
                      {allSkillPlayerNames.map((nm) => (
                        <option key={nm} value={nm} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() => {
                        if (!auditPlayerInput.trim()) return;
                        setAuditedPlayerNames((prev) => [
                          auditPlayerInput.trim(),
                          ...prev,
                        ]);
                        setAuditPlayerInput('');
                      }}
                      className="shrink-0 min-h-[38px] border border-[#111827] bg-[#111827] px-3 py-1.5 font-mono-ledger text-xs font-semibold text-white hover:bg-[#334155] cursor-pointer"
                    >
                      + Add Player
                    </button>
                  </div>
                  <div className="font-mono-ledger text-[11px] text-[#334155]">
                    Dynasty Contract Insulation Score:{' '}
                    <strong className="text-[#111827]">
                      {fantasyAuditReport.overallInsulationScore}/99
                    </strong>{' '}
                    ({fantasyAuditReport.totalAudited} matched players)
                  </div>
                </div>
              </div>

              {/* 3 Actionable Dynasty Audit Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                {/* Column 1: Paper Traps */}
                <div className="border border-[#fca5a5] bg-[#fef2f2]/60 p-3.5 space-y-2.5">
                  <div className="font-mono-ledger text-[11px] font-bold uppercase tracking-wider text-[#991b1b]">
                    ⚠️ Paper Traps — Sell Before Cut ({fantasyAuditReport.paperContractTraps.length})
                  </div>
                  {fantasyAuditReport.paperContractTraps.length === 0 ? (
                    <p className="text-[11px] text-[#475569]">
                      Zero high-risk cut candidates on your audited squad.
                    </p>
                  ) : (
                    fantasyAuditReport.paperContractTraps.map((item) => (
                      <div
                        key={`aud-trap-${item.player.id}`}
                        className="border border-[#fecaca] bg-white p-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openPlayerDossier(item.player, item.teamId)
                            }
                            className="flex items-center gap-2 font-bold text-[#111827] hover:underline text-left cursor-pointer min-w-0"
                          >
                            <PlayerAvatar
                              name={item.player.name}
                              headshotUrl={item.player.headshotUrl}
                              teamId={item.teamId}
                              size="sm"
                            />
                            <span className="truncate">
                              {item.player.name} ({item.teamAbbr} · {item.evaluation.depthChartSlot})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              selectTeam(item.teamId);
                              setPosFilter(item.player.position);
                              setFantasyHubTab('TEAM_INSULATION');
                            }}
                            className="font-mono-ledger text-[10px] font-bold text-[#991b1b] hover:underline cursor-pointer"
                          >
                            {item.teamAbbr} →
                          </button>
                        </div>
                        <p className="text-[11px] text-[#7f1d1d]">
                          {item.evaluation.fantasyTakeaway}
                        </p>
                        <p className="font-mono-ledger text-[10px] text-[#475569]">
                          Ripple: {item.evaluation.rippleIfCutOrTraded}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Column 2: Breakout Stashes */}
                <div className="border border-[#c4b5fd] bg-[#f5f3ff]/70 p-3.5 space-y-2.5">
                  <div className="font-mono-ledger text-[11px] font-bold uppercase tracking-wider text-[#4c1d95]">
                    🚀 Breakout Stashes — Buy Low ({fantasyAuditReport.breakoutStashes.length})
                  </div>
                  {fantasyAuditReport.breakoutStashes.length === 0 ? (
                    <p className="text-[11px] text-[#475569]">
                      No post-cut backup breakout stashes detected yet — try adding cheap backups behind veteran starters.
                    </p>
                  ) : (
                    fantasyAuditReport.breakoutStashes.map((item) => (
                      <div
                        key={`aud-stash-${item.player.id}`}
                        className="border border-[#ddd6fe] bg-white p-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openPlayerDossier(item.player, item.teamId)
                            }
                            className="flex items-center gap-2 font-bold text-[#111827] hover:underline text-left cursor-pointer min-w-0"
                          >
                            <PlayerAvatar
                              name={item.player.name}
                              headshotUrl={item.player.headshotUrl}
                              teamId={item.teamId}
                              size="sm"
                            />
                            <span className="truncate">
                              {item.player.name} ({item.teamAbbr} · {item.evaluation.depthChartSlot})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              selectTeam(item.teamId);
                              setPosFilter(item.player.position);
                              setFantasyHubTab('TEAM_INSULATION');
                            }}
                            className="font-mono-ledger text-[10px] font-bold text-[#4c1d95] hover:underline cursor-pointer"
                          >
                            {item.teamAbbr} →
                          </button>
                        </div>
                        <p className="text-[11px] text-[#4c1d95]">
                          {item.evaluation.fantasyTakeaway}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Column 3: Insulated Cornerstones + UFA/Tag Watch */}
                <div className="border border-[#86efac] bg-[#f0fdf4]/70 p-3.5 space-y-2.5">
                  <div className="font-mono-ledger text-[11px] font-bold uppercase tracking-wider text-[#14532d]">
                    🔒 Insulated Core &amp; 2027 UFA Watch (
                    {fantasyAuditReport.insulatedCornerstones.length +
                      fantasyAuditReport.ufaTagWatch.length}
                    )
                  </div>
                  {[
                    ...fantasyAuditReport.insulatedCornerstones,
                    ...fantasyAuditReport.ufaTagWatch,
                    ...fantasyAuditReport.solidDepth,
                  ]
                    .slice(0, 8)
                    .map((item) => (
                      <div
                        key={`aud-core-${item.player.id}`}
                        className="border border-[#bbf7d0] bg-white p-2.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openPlayerDossier(item.player, item.teamId)
                            }
                            className="flex items-center gap-2 font-bold text-[#111827] hover:underline text-left cursor-pointer min-w-0"
                          >
                            <PlayerAvatar
                              name={item.player.name}
                              headshotUrl={item.player.headshotUrl}
                              teamId={item.teamId}
                              size="sm"
                            />
                            <span className="truncate">
                              {item.player.name} ({item.teamAbbr} · {item.evaluation.depthChartSlot})
                            </span>
                          </button>
                          <span
                            className={`border px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold ${getFantasySignalBadgeClass(
                              item.evaluation.signal
                            )}`}
                          >
                            {item.evaluation.insulationScore}/99
                          </span>
                        </div>
                        <p className="text-[11px] text-[#1e293b]">
                          {item.evaluation.badgeLabel} · OL Grade{' '}
                          {item.env.olGrade} · {item.evaluation.fantasyTakeaway}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          CATEGORY TAB VIEW: DEAD MONEY LEDGER (Prior + Session Cuts/Trades)
         ===================================================================== */}
      {effectiveTab === 'DEAD_MONEY' && (
        <section
          id="dead-money-ledger-section"
          className="border border-[#d6d0c4] bg-white p-4 sm:p-5 space-y-4 shadow-2xs scroll-mt-24"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#dfd9cc] pb-3">
            <div>
              <h2 className="font-editorial text-xl sm:text-2xl text-[#111827]">
                Dead Money &amp; Accelerated Cap Charges ({sortedDeadCapLedger.length})
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono-ledger text-xs">
              {LEAGUE_YEARS.map((yr) => (
                <span key={yr} className="text-[#b91c1c] font-semibold">
                  &apos;{String(yr).slice(2)}: $
                  {activeCapState.years[yr].deadMoneyTotal.toFixed(1)}M
                </span>
              ))}
            </div>
          </div>

          {sortedDeadCapLedger.length === 0 ? (
            <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-6 text-xs text-[#64748b]">
              No dead cap charges on the 2026–2029 books.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#111827] text-[11px] uppercase tracking-[0.08em] text-[#475569]">
                    <th className="py-2.5 pr-4">Player / Charge</th>
                    <th className="py-2.5 px-3">Reason</th>
                    {LEAGUE_YEARS.map((yr) => (
                      <th key={yr} className="py-2.5 px-3 text-right">
                        {yr} Dead
                      </th>
                    ))}
                    <th className="py-2.5 pl-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfd9cc]">
                  {sortedDeadCapLedger.map((entry) => {
                    const sessionTx = !isCurrentState
                      ? deadCapTxMap.get(entry.id)
                      : undefined;
                    return (
                      <tr
                        key={entry.id}
                        className={
                          sessionTx
                            ? 'bg-[#eff6ff] border-l-4 border-l-[#2563eb]'
                            : 'hover:bg-[#f8fafc]'
                        }
                      >
                        <th scope="row" className="py-3 pr-4 font-semibold text-[#111827]">
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar
                              name={entry.playerName.replace(/\s*\(Dead Cap\)\s*/i, '')}
                              headshotUrl={playerHeadshotByName.get(
                                entry.playerName
                                  .replace(/\s*\(Dead Cap\)\s*/i, '')
                                  .trim()
                                  .toLowerCase()
                              )}
                              teamId={baseTeam.id}
                              teamLogoUrl={baseTeam.logoUrl}
                              size="sm"
                            />
                            <div>
                              <span>{entry.playerName}</span>
                              <span className="ml-2 font-mono-ledger text-[10px] font-medium text-[#475569]">
                                {entry.position}
                              </span>
                            </div>
                          </div>
                        </th>
                        <td className="py-3 px-3 text-[#475569]">
                          {entry.reason}
                        </td>
                        {LEAGUE_YEARS.map((yr) => {
                          const amt = entry.amountsByYear[yr] ?? 0;
                          return (
                            <td
                              key={yr}
                              className={`py-3 px-3 text-right font-mono-ledger ${
                                amt > 0
                                  ? 'font-bold text-[#b91c1c]'
                                  : 'text-[#94a3b8]'
                              }`}
                            >
                              {amt > 0 ? `$${amt.toFixed(2)}M` : '—'}
                            </td>
                          );
                        })}
                        <td className="py-3 pl-3 text-right">
                          {sessionTx ? (
                            <button
                              type="button"
                              onClick={() => removeTransaction(sessionTx.id)}
                              className="inline-flex items-center gap-1 border border-[#2563eb] bg-[#2563eb] px-2.5 py-1 font-mono-ledger text-[11px] font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Undo / Restore</span>
                            </button>
                          ) : (
                            <span className="font-mono-ledger text-[10px] text-[#64748b]">
                              Prior Book
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          CATEGORY TAB VIEW: DRAFT PICKS & ROOKIE SCALE CAPITAL
         ===================================================================== */}
      {effectiveTab === 'DRAFT_PICKS' && (
        <section className="border border-[#d6d0c4] bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfd9cc] pb-3">
            <h2 className="font-editorial text-xl sm:text-2xl text-[#111827]">
              Draft Capital &amp; Rookie Slot Reserve ({activeCapState.draftPicks.length} Picks)
            </h2>
            <button
              type="button"
              onClick={() => {
                if (isCurrentState) {
                  openInTeamBuilder({ subTab: 'draft-trade' });
                } else {
                  setTeamBuilderSubTab('draft-trade');
                  document
                    .getElementById('team-builder-workbench')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="border border-[#1e3a5f] bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#152c4a] cursor-pointer"
            >
              Open Draft &amp; Trade Room →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeCapState.draftPicks.map((pk) => {
              const cutoff = activeCapState.years[pk.year]?.replacementLevelCutoff ?? 1.17;
              const slot = generateRookieContract(
                pk.overallPick,
                pk.year,
                pk.selectedPosition ?? 'EDGE',
                cutoff
              );
              return (
                <div
                  key={pk.id}
                  className={`border p-3 text-xs flex items-center justify-between gap-2 ${
                    pk.selectedPlayerName
                      ? 'border-[#2563eb] bg-[#eff6ff]'
                      : 'border-[#d6d0c4] bg-[#fcfaf6]'
                  }`}
                >
                  <div>
                    <div className="font-mono-ledger font-bold text-[#111827]">
                      {pk.year} Rd {pk.round} · Pick #{pk.overallPick}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      {pk.selectedPlayerName
                        ? `Drafted: ${pk.selectedPlayerName} (${pk.selectedPosition})`
                        : `Orig: ${pk.originalTeamId} · Unsigned Slot`}
                    </div>
                  </div>
                  <div className="text-right font-mono-ledger shrink-0">
                    <div className="font-bold text-[#111827]">
                      Yr-1: ${slot.year1CapHit.toFixed(2)}M
                    </div>
                    <div className="text-[10px] text-[#15803d]">
                      Net −${slot.year1NetCapImpactAfterDisplacement.toFixed(2)}M
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          VIEW MODE 1: VISUAL CONTRACT & EXTENSION BAR TIMELINE (2026–2031)
         ===================================================================== */}
      {(effectiveTab === 'ACTIVE' || effectiveTab === 'MODIFIED') &&
        viewMode === 'TIMELINE_BARS' && (
        <section className="border border-[#d6d0c4] bg-white p-3.5 sm:p-5 space-y-4 sm:space-y-5 shadow-2xs">
          {/* Visual Legend + Quick Filter Pills */}
          <div className="flex flex-col gap-3 sm:gap-4 border-b border-[#d6d0c4] pb-3.5 sm:pb-4">
            {/* 4-Box Visual Key + Rating Scale Key */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-5 sm:gap-y-2 text-[11px] sm:text-xs">
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-[0.1em] text-[#334155]">
                Bar Legend:
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="inline-block h-3.5 w-5 sm:h-4 sm:w-7 bg-[#1e3a5f] border border-[#1e3a5f] rounded-xs" />
                <span className="text-[#111827] font-semibold">
                  Locked
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="inline-block h-3.5 w-5 sm:h-4 sm:w-7 bg-[#fef3c7] border-2 border-[#d97706] rounded-xs" />
                <span className="text-[#78350f] font-semibold">
                  Cut Risk
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="inline-block h-3.5 w-5 sm:h-4 sm:w-7 bg-[#dcfce7] border-2 border-dashed border-[#15803d] rounded-xs" />
                <span className="text-[#14532d] font-semibold">
                  Ext. Window
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="inline-block h-3.5 w-5 sm:h-4 sm:w-7 bg-[#fee2e2] border border-dashed border-[#dc2626] rounded-xs" />
                <span className="text-[#991b1b] font-semibold">
                  Dead / Cliff
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 border-l border-[#d6d0c4] pl-4 text-xs text-[#334155]">
                <span className="font-mono-ledger font-bold text-[#1e3a5f]">
                  Rating (0–99):
                </span>
                <span>
                  90+ All-Pro · 82–89 Plus Starter · 75–81 Solid Starter
                </span>
              </div>
            </div>

            {/* Single-Row Swipeable Quick Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 snap-x lg:flex-wrap lg:overflow-visible text-xs">
              {(
                [
                  { id: 'ALL', label: `All Roster (${timelineRows.length})` },
                  {
                    id: 'HIGH_EXT_LIKELY',
                    label: 'High Ext. Likelihood (70%+)',
                  },
                  {
                    id: 'CUT_RISK_YEARS',
                    label: 'Cut-Risk / Fake Years',
                  },
                  { id: 'EXPIRING_2026', label: 'Expiring After 2026' },
                  { id: 'VOID_BILLS', label: 'Void-Year Bills' },
                  ...(!isCurrentState && signedFaCount > 0
                    ? [
                        {
                          id: 'ADDED_FA' as TimelineQuickFilter,
                          label: `Added FAs (${signedFaCount})`,
                        },
                      ]
                    : []),
                ] as { id: TimelineQuickFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setTimelineFilter(pill.id)}
                  className={`shrink-0 snap-start whitespace-nowrap min-h-[36px] border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    timelineFilter === pill.id
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                      : 'border-[#cbd5e1] bg-[#f8fafc] text-[#334155] hover:border-[#111827] hover:text-[#111827]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* DESKTOP VIEW: Horizontal Multi-Year Contract & Extension Bar Table */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Multi-Year Contract and Extension Timeline Table"
            className={`${desktopBlockClass} overflow-x-auto [container-type:inline-size] ${
              openActionMenuPlayerId ? 'pb-48' : ''
            }`}
          >
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#111827] text-xs uppercase tracking-[0.08em] text-[#334155]">
                  <th className="sticky left-0 z-10 bg-white py-3 pr-4 w-[315px]">
                    {isCurrentState
                      ? `Player (${filteredTimelineRows.length}) · Ext. Likelihood`
                      : `Player (${filteredTimelineRows.length}) · Ext. Likelihood & Actions`}
                  </th>
                  {TIMELINE_HORIZON_YEARS.map((yr) => {
                    const yCap =
                      yr <= 2029
                        ? activeCapState.years[yr as LeagueYear]
                        : null;
                    return (
                      <th
                        key={yr}
                        className="py-3 px-1.5 text-center w-[135px] border-l border-[#dfd9cc]"
                      >
                        <div className="font-editorial text-base font-normal text-[#1c1917]">
                          {yr}
                        </div>
                        {yCap ? (
                          <div
                            className={`font-mono-ledger text-[10px] font-normal ${
                              yCap.effectiveCapSpace < 0
                                ? 'text-[#b84a27]'
                                : 'text-[#2d5a43]'
                            }`}
                          >
                            {yCap.effectiveCapSpace >= 0 ? '+$' : '−$'}
                            {Math.abs(yCap.effectiveCapSpace).toFixed(0)}M space
                          </div>
                        ) : (
                          <div className="font-mono-ledger text-[10px] font-normal text-[#8a8379]">
                            Future Horizon
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#dfd9cc]">
                {filteredTimelineRows.map((row, rowIdx) => {
                  const {
                    player,
                    forecast,
                    career,
                    extensionLikelihoodPct,
                    extensionLikelihoodTier,
                    cells,
                  } = row;

                  const isNewlySignedFa =
                    !isCurrentState && isNewFaPlayerId(player.id);
                  const faTxId = !isCurrentState
                    ? activeSignFaTxByPlayerId.get(player.id)
                    : undefined;
                  const activePlayerTx = !isCurrentState
                    ? activePlayerTxMap.get(player.id)
                    : undefined;
                  const isRowModified =
                    !isCurrentState &&
                    (isNewlySignedFa || Boolean(activePlayerTx));
                  const isActionMenuOpen =
                    openActionMenuPlayerId === player.id;
                  const openUpward =
                    filteredTimelineRows.length > 5 &&
                    rowIdx >= filteredTimelineRows.length - 4;

                  const extBadgeColor =
                    extensionLikelihoodTier === 'HIGH'
                      ? 'text-[#14532d] bg-[#dcfce7] border-[#16a34a]'
                      : extensionLikelihoodTier === 'MEDIUM'
                      ? 'text-[#92400e] bg-[#fef3c7] border-[#d97706]'
                      : 'text-[#334155] bg-[#f1f5f9] border-[#94a3b8]';
                  const fEval = isFantasyLens
                    ? fantasyEvalByPlayerId.get(player.id)
                    : undefined;

                  return (
                    <tr
                      key={player.id}
                      className={`group transition-colors ${
                        isRowModified
                          ? 'bg-[#eff6ff] hover:bg-[#dbeafe]'
                          : 'hover:bg-[#f8fafc]'
                      }`}
                    >
                      {/* Left Sticky Player Identity + Extension Probability Column */}
                      <th
                        scope="row"
                        className={`sticky left-0 ${
                          isActionMenuOpen ? 'z-30' : 'z-10'
                        } py-3.5 pr-4 align-middle font-normal border-r border-[#d6d0c4] ${
                          isRowModified
                            ? 'bg-[#eff6ff] group-hover:bg-[#dbeafe] border-l-4 border-l-[#2563eb] pl-2.5'
                            : 'bg-white group-hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <PlayerAvatar
                            name={player.name}
                            headshotUrl={player.headshotUrl}
                            teamId={baseTeam.id}
                            teamLogoUrl={baseTeam.logoUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isCurrentState
                                      ? openPlayerDossier(player, baseTeam.id)
                                      : selectPlayer(
                                          player.id,
                                          forecast.recommendedActionTab,
                                          2026
                                        )
                                  }
                                  className="truncate font-bold text-sm text-[#111827] hover:text-[#1e3a5f] hover:underline text-left cursor-pointer"
                                >
                                  {player.name}
                                </button>
                                {player.injuryStatus && (
                                  <span
                                    title={`Currently on ${player.injuryStatus} list`}
                                    className="shrink-0 border border-[#dc2626] bg-[#fef2f2] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-[#b91c1c]"
                                  >
                                    {player.injuryStatus}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0 relative">
                                {isCurrentState ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPlayerDossier(player, baseTeam.id)
                                      }
                                      className="border border-[#cbd5e1] bg-[#f8fafc] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#334155] hover:border-[#111827] hover:text-[#111827] cursor-pointer"
                                    >
                                      Dossier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openInTeamBuilder({
                                          playerId: player.id,
                                          drawerTab:
                                            forecast.recommendedActionTab,
                                          actionYear: 2026,
                                        })
                                      }
                                      title={`Modify ${player.name} inside Team Builder`}
                                      className="border border-[#1e3a5f] bg-[#1e3a5f] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-white hover:bg-[#15803d] hover:border-[#15803d] transition-colors cursor-pointer"
                                    >
                                      Builder →
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {isNewlySignedFa && faTxId ? (
                                      <button
                                        type="button"
                                        onClick={() => removeTransaction(faTxId)}
                                        title="Remove newly signed Free Agent from roster grid"
                                        className="inline-flex items-center gap-0.5 border border-[#b91c1c] bg-[#b91c1c] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-white hover:bg-[#991b1b] cursor-pointer"
                                      >
                                        <X className="h-3 w-3" />
                                        <span>Undo FA</span>
                                      </button>
                                    ) : activePlayerTx ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeTransaction(activePlayerTx.txId)
                                        }
                                        title="Undo move on this player"
                                        className="inline-flex items-center gap-0.5 border border-[#2563eb] bg-[#2563eb] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        <span>Undo</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        aria-expanded={isActionMenuOpen}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenActionMenuPlayerId((prev) =>
                                            prev === player.id ? null : player.id
                                          );
                                        }}
                                        className={`inline-flex items-center gap-0.5 border px-2 py-0.5 font-mono-ledger text-[11px] font-bold transition-colors cursor-pointer ${
                                          isActionMenuOpen
                                            ? 'border-[#111827] bg-[#111827] text-white'
                                            : 'border-[#1e3a5f] bg-[#eff6ff] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white'
                                        }`}
                                      >
                                        <span>Action</span>
                                        <ChevronDown className="h-3 w-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPlayerDossier(player, baseTeam.id)
                                      }
                                      className="border border-[#cbd5e1] bg-[#f8fafc] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#334155] hover:border-[#111827] hover:text-[#111827] cursor-pointer"
                                    >
                                      Dossier
                                    </button>
                                    {isActionMenuOpen &&
                                      renderPlayerActionMenu(
                                        row,
                                        openUpward
                                          ? 'left-0 bottom-full mb-1'
                                          : 'left-0 top-full mt-1'
                                      )}
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-1 font-mono-ledger text-xs font-medium text-[#334155]">
                              {player.position} · Age {player.ageIn2026} · Rating{' '}
                              {player.overallRating}/99 · ~
                              {career.expectedRemainingStarterYears} starter yr
                              {career.expectedRemainingStarterYears === 1
                                ? ''
                                : 's'}{' '}
                              left
                            </div>

                            {/* Extension Likelihood Pill + Mode-Aware Quick Action */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {isNewlySignedFa ? (
                                <span className="inline-block border border-[#15803d] bg-[#15803d] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-white">
                                  ★ NEW FA SIGNING
                                </span>
                              ) : activePlayerTx ? (
                                <span className="inline-block border border-[#16a34a] bg-[#dcfce7] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#14532d]">
                                  ✓ {activePlayerTx.label}
                                </span>
                              ) : (
                                <>
                                  <span
                                    className={`inline-block border px-2 py-0.5 font-mono-ledger text-[11px] font-semibold ${extBadgeColor}`}
                                  >
                                    {extensionLikelihoodPct}% Ext. Likelihood
                                  </span>
                                  {row.lastActiveContractYear === 2026 &&
                                    forecast.projectedCompPickRound && (
                                      <span
                                        title={`If ${player.name} walks in 2027 UFA (~$${forecast.projectedMarketApy.toFixed(1)}M/yr), projects a 2027 Round ${forecast.projectedCompPickRound} Compensatory Pick`}
                                        className="inline-block border border-[#d97706]/60 bg-[#fffbeb] px-2 py-0.5 font-mono-ledger text-[11px] font-bold text-[#92400e]"
                                      >
                                        If Walks: Proj. Rd {forecast.projectedCompPickRound} Comp
                                      </span>
                                    )}
                                  {isCurrentState ? (
                                    <span className="font-mono-ledger text-[11px] font-medium text-[#475569]">
                                      ~${forecast.projectedMarketApy.toFixed(1)}
                                      M/yr mkt
                                    </span>
                                  ) : (
                                    extensionLikelihoodPct >= 55 &&
                                    row.extensionWindowYears.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addExtensionTransaction(
                                            player,
                                            Math.min(
                                              3,
                                              Math.max(
                                                1,
                                                row.extensionWindowYears.length
                                              )
                                            ),
                                            forecast.projectedMarketApy,
                                            0.55,
                                            'Backloaded',
                                            row.lastActiveContractYear
                                          )
                                        }
                                        className="border border-[#15803d] bg-[#dcfce7] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#14532d] hover:bg-[#15803d] hover:text-white transition-colors cursor-pointer"
                                      >
                                        + 1-Click Extend (~$
                                        {forecast.projectedMarketApy.toFixed(1)}
                                        M/yr)
                                      </button>
                                    )
                                  )}
                                </>
                              )}
                            </div>
                            {fEval && renderFantasyRowSummary(fEval)}
                          </div>
                        </div>
                      </th>

                      {/* 6 Year Columns (2026–2031) with Connected Horizontal Contract & Extension Bars */}
                      {cells.map((cell) => {
                        const targetActionYear: LeagueYear =
                          cell.year <= 2029 ? (cell.year as LeagueYear) : 2029;

                        const roundedClass = `${
                          cell.isStartOfSpan ? 'rounded-l-sm ml-1' : '-ml-px'
                        } ${cell.isEndOfSpan ? 'rounded-r-sm mr-1' : '-mr-px'}`;

                        if (cell.segmentType === 'LOCKED_CONTRACT') {
                          return (
                            <td
                              key={cell.year}
                              className="py-2.5 px-0 align-middle border-l border-[#e2e8f0]"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isCurrentState
                                    ? openPlayerDossier(player, baseTeam.id)
                                    : selectPlayer(
                                        player.id,
                                        'restructure',
                                        targetActionYear
                                      )
                                }
                                title={`${player.name} (${cell.year}): Locked Contract ($${cell.capHit?.toFixed(2)}M cap hit). ${
                                  isCurrentState
                                    ? 'Click for Scouting Dossier or open Team Builder to modify.'
                                    : 'Click to open 4-Door options.'
                                }`}
                                className={`w-[calc(100%-4px)] h-14 bg-[#1e3a5f] text-white px-3 py-1.5 flex flex-col justify-between text-left hover:bg-[#152c4a] transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-xs sm:text-sm font-bold text-white">
                                    {cell.primaryLabel}
                                  </span>
                                  <span className="text-[11px] font-medium text-[#bae6fd]">
                                    Age {cell.age}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between w-full font-mono-ledger text-[11px] text-[#e2e8f0] truncate">
                                  <span>{cell.secondaryLabel}</span>
                                  {player.isRookieContract && (
                                    <span className="text-[#86efac] font-semibold">
                                      Rookie
                                    </span>
                                  )}
                                </div>
                              </button>
                            </td>
                          );
                        }

                        if (cell.segmentType === 'PAPER_CUT_RISK') {
                          return (
                            <td
                              key={cell.year}
                              className="py-2.5 px-0 align-middle border-l border-[#e2e8f0]"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isCurrentState
                                    ? openPlayerDossier(player, baseTeam.id)
                                    : selectPlayer(
                                        player.id,
                                        'cut',
                                        targetActionYear
                                      )
                                }
                                title={`${player.name} (${cell.year}): Unguaranteed back-end year. Cutting saves +$${cell.cutSavings?.toFixed(1)}M ($${cell.deadCap?.toFixed(1)}M dead). Click to inspect.`}
                                className={`w-[calc(100%-4px)] h-14 bg-[#fef3c7] border-y-2 border-[#d97706] ${
                                  cell.isStartOfSpan ? 'border-l-2' : ''
                                } ${
                                  cell.isEndOfSpan ? 'border-r-2' : ''
                                } text-[#78350f] px-3 py-1.5 flex flex-col justify-between text-left hover:bg-[#fde68a] transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-xs sm:text-sm font-bold text-[#78350f]">
                                    {cell.primaryLabel}
                                  </span>
                                  <span className="text-[11px] font-medium text-[#92400e]">
                                    Age {cell.age}
                                  </span>
                                </div>
                                <div className="font-mono-ledger text-[11px] font-bold text-[#b45309] truncate">
                                  ✂ {cell.secondaryLabel}
                                </div>
                              </button>
                            </td>
                          );
                        }

                        if (cell.segmentType === 'EXTENSION_WINDOW') {
                          return (
                            <td
                              key={cell.year}
                              className="py-2.5 px-0 align-middle border-l border-[#e2e8f0]"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isCurrentState
                                    ? openPlayerDossier(player, baseTeam.id)
                                    : selectPlayer(
                                        player.id,
                                        'extend',
                                        row.lastActiveContractYear
                                      )
                                }
                                title={
                                  isCurrentState
                                    ? `${player.name} projected extension window (${extensionLikelihoodPct}% likelihood, ~$${forecast.projectedMarketApy.toFixed(1)}M/yr). Click for Dossier.`
                                    : `Click to model an extension for ${player.name} (${extensionLikelihoodPct}% Extension Likelihood at ~$${forecast.projectedMarketApy.toFixed(1)}M/yr)`
                                }
                                className={`w-[calc(100%-4px)] h-14 bg-[#dcfce7] border-y-2 border-dashed border-[#15803d] ${
                                  cell.isStartOfSpan ? 'border-l-2' : ''
                                } ${
                                  cell.isEndOfSpan ? 'border-r-2' : ''
                                } text-[#14532d] px-3 py-1.5 flex flex-col justify-between text-left hover:bg-[#bbf7d0] transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-xs font-bold text-[#14532d]">
                                    {cell.isStartOfSpan
                                      ? `${extensionLikelihoodPct}% Ext. Box`
                                      : `Ext. Yr (Age ${cell.age})`}
                                  </span>
                                  {cell.isStartOfSpan && (
                                    <span className="text-[11px] font-medium text-[#166534]">
                                      Age {cell.age}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono-ledger text-[11px] font-semibold text-[#14532d] truncate">
                                  {cell.secondaryLabel}
                                </div>
                              </button>
                            </td>
                          );
                        }

                        if (cell.segmentType === 'VOID_GHOST_BILL') {
                          return (
                            <td
                              key={cell.year}
                              className="py-2.5 px-0 align-middle border-l border-[#e2e8f0]"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  isCurrentState
                                    ? openPlayerDossier(player, baseTeam.id)
                                    : selectPlayer(
                                        player.id,
                                        'extend',
                                        row.lastActiveContractYear
                                      )
                                }
                                className={`w-[calc(100%-4px)] h-14 bg-[#fee2e2] border border-dashed border-[#dc2626] px-3 py-1.5 flex flex-col justify-between text-left hover:bg-[#fecaca] transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-xs font-bold text-[#991b1b]">
                                    {cell.primaryLabel}
                                  </span>
                                  <span className="text-[11px] text-[#7f1d1d]">
                                    Age {cell.age}
                                  </span>
                                </div>
                                <div className="font-mono-ledger text-[11px] font-medium text-[#991b1b] truncate">
                                  Ghost Bill Accelerates
                                </div>
                              </button>
                            </td>
                          );
                        }

                        // CLIFF_OR_WALK
                        return (
                          <td
                            key={cell.year}
                            className="py-2.5 px-1 align-middle border-l border-[#e2e8f0]"
                          >
                            <div className="h-14 border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-2.5 py-1.5 flex flex-col justify-between text-left">
                              <div className="flex items-baseline justify-between font-mono-ledger text-[11px] font-medium text-[#475569]">
                                <span>{cell.primaryLabel}</span>
                              </div>
                              <div className="font-mono-ledger text-[10px] text-[#64748b]">
                                {cell.secondaryLabel}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* IPHONE / PIXEL MOBILE VIEW: Zero-Scroll 6-Year Visual Timeline Cards */}
          <div className={`${mobileBlockClass} space-y-3`}>
            {mobileVisibleRows.map((row) => {
              const {
                player,
                forecast,
                career,
                extensionLikelihoodPct,
                extensionLikelihoodTier,
                cells,
              } = row;

              const isNewlySignedFa =
                !isCurrentState && isNewFaPlayerId(player.id);
              const faTxId = !isCurrentState
                ? activeSignFaTxByPlayerId.get(player.id)
                : undefined;
              const activePlayerTx = !isCurrentState
                ? activePlayerTxMap.get(player.id)
                : undefined;
              const isModifiedMobileRow =
                !isCurrentState &&
                (isNewlySignedFa || Boolean(activePlayerTx));

              const extBadgeColor =
                extensionLikelihoodTier === 'HIGH'
                  ? 'text-[#14532d] bg-[#dcfce7] border-[#16a34a]'
                  : extensionLikelihoodTier === 'MEDIUM'
                  ? 'text-[#92400e] bg-[#fef3c7] border-[#d97706]'
                  : 'text-[#334155] bg-[#f1f5f9] border-[#94a3b8]';
              const fEval = isFantasyLens
                ? fantasyEvalByPlayerId.get(player.id)
                : undefined;

              return (
                <div
                  key={`mob-${player.id}`}
                  className={`border p-3 space-y-2.5 transition-colors ${
                    isModifiedMobileRow
                      ? 'border-2 border-l-4 border-[#2563eb] bg-[#eff6ff]'
                      : 'border-[#d6d0c4] bg-white'
                  }`}
                >
                  {/* Card Row 1: Identity + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        isCurrentState
                          ? openPlayerDossier(player, baseTeam.id)
                          : selectPlayer(
                              player.id,
                              forecast.recommendedActionTab,
                              2026
                            )
                      }
                      className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                    >
                      <PlayerAvatar
                        name={player.name}
                        headshotUrl={player.headshotUrl}
                        teamId={baseTeam.id}
                        teamLogoUrl={baseTeam.logoUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-editorial text-base font-bold text-[#111827]">
                            {player.name}
                          </span>
                          {player.injuryStatus && (
                            <span
                              title={`Currently on ${player.injuryStatus} list`}
                              className="shrink-0 border border-[#dc2626] bg-[#fef2f2] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-[#b91c1c]"
                            >
                              {player.injuryStatus}
                            </span>
                          )}
                          <span className="shrink-0 border border-[#cbd5e1] bg-[#f8fafc] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-[#111827]">
                            {player.position} · Age {player.ageIn2026} · {player.overallRating}/99
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono-ledger text-xs font-medium text-[#334155]">
                          ~{career.expectedRemainingStarterYears} starter yr
                          {career.expectedRemainingStarterYears === 1
                            ? ''
                            : 's'}{' '}
                          left · Est. ${forecast.projectedMarketApy.toFixed(1)}M/yr
                        </div>
                      </div>
                    </button>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {isNewlySignedFa ? (
                        <span className="inline-block border border-[#15803d] bg-[#15803d] px-2 py-0.5 font-mono-ledger text-[10px] font-bold text-white">
                          ★ NEW FA
                        </span>
                      ) : activePlayerTx ? (
                        <span className="inline-block border border-[#16a34a] bg-[#dcfce7] px-2 py-0.5 font-mono-ledger text-[10px] font-bold text-[#14532d]">
                          ✓ {activePlayerTx.type}
                        </span>
                      ) : (
                        <>
                          <span
                            className={`inline-block border px-2 py-0.5 font-mono-ledger text-[10px] font-bold ${extBadgeColor}`}
                          >
                            {extensionLikelihoodPct}% Ext.
                          </span>
                          {row.lastActiveContractYear === 2026 &&
                            forecast.projectedCompPickRound && (
                              <span className="inline-block border border-[#d97706]/60 bg-[#fffbeb] px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#92400e]">
                                Walk → Rd {forecast.projectedCompPickRound} Comp
                              </span>
                            )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Row 2: Full-Width 6-Year Mini Visual Bar (2026–2031) — Fits 100% on Phone */}
                  <div className="grid grid-cols-6 gap-1">
                    {cells.map((cell) => {
                      const targetActionYear: LeagueYear =
                        cell.year <= 2029 ? (cell.year as LeagueYear) : 2029;
                      const shortYr = `'${String(cell.year).slice(2)}`;
                      const hit = cell.capHit ?? 0;

                      let boxStyle =
                        'border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-[#475569]';
                      let statusShort = 'UFA';

                      if (cell.segmentType === 'LOCKED_CONTRACT') {
                        boxStyle =
                          'bg-[#1e3a5f] text-white border border-[#1e3a5f]';
                        statusShort =
                          hit >= 10 ? `$${hit.toFixed(0)}M` : `$${hit.toFixed(1)}M`;
                      } else if (cell.segmentType === 'PAPER_CUT_RISK') {
                        boxStyle =
                          'bg-[#fef3c7] text-[#78350f] border-2 border-[#d97706]';
                        statusShort = `✂$${hit.toFixed(0)}M`;
                      } else if (cell.segmentType === 'EXTENSION_WINDOW') {
                        boxStyle =
                          'bg-[#dcfce7] text-[#14532d] border-2 border-dashed border-[#15803d]';
                        statusShort = cell.isStartOfSpan
                          ? `${extensionLikelihoodPct}%`
                          : `~$${forecast.projectedMarketApy.toFixed(0)}M`;
                      } else if (cell.segmentType === 'VOID_GHOST_BILL') {
                        boxStyle =
                          'bg-[#fee2e2] text-[#991b1b] border border-dashed border-[#dc2626]';
                        statusShort = 'Void';
                      } else if (cell.isAtOrPastCliff) {
                        statusShort = 'Cliff';
                      }

                      return (
                        <button
                          key={cell.year}
                          type="button"
                          onClick={() =>
                            isCurrentState
                              ? openPlayerDossier(player, baseTeam.id)
                              : selectPlayer(
                                  player.id,
                                  cell.segmentType === 'PAPER_CUT_RISK'
                                    ? 'cut'
                                    : cell.segmentType === 'EXTENSION_WINDOW'
                                    ? 'extend'
                                    : 'restructure',
                                  targetActionYear
                                )
                          }
                          className={`flex flex-col items-center justify-between min-h-[46px] py-1.5 px-1 text-center font-mono-ledger transition-opacity active:opacity-80 cursor-pointer ${boxStyle}`}
                        >
                          <div className="flex items-baseline justify-between w-full px-0.5 text-[9px] leading-none opacity-85">
                            <span>{shortYr}</span>
                            <span>{cell.age}y</span>
                          </div>
                          <span className="mt-1 text-[11px] font-bold leading-tight truncate max-w-full">
                            {statusShort}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {fEval && renderFantasyRowSummary(fEval)}

                  {/* Card Row 3: Thumb-Friendly Mode-Aware Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#dfd9cc]">
                    {isCurrentState ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openPlayerDossier(player, baseTeam.id)}
                          className="min-h-[36px] border border-[#cbd5e1] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#111827] active:bg-[#ebe6dc]"
                        >
                          Dossier
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openInTeamBuilder({
                              playerId: player.id,
                              drawerTab: forecast.recommendedActionTab,
                              actionYear: 2026,
                            })
                          }
                          className="min-h-[36px] inline-flex items-center gap-1 bg-[#1e3a5f] px-3.5 py-1.5 text-xs font-semibold text-white active:bg-[#162d4a]"
                        >
                          <span>Modify in Team Builder →</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isNewlySignedFa && faTxId ? (
                            <button
                              type="button"
                              onClick={() => removeTransaction(faTxId)}
                              className="min-h-[36px] inline-flex items-center gap-1 border border-[#2563eb] bg-[#2563eb] px-3 py-1.5 text-[11px] font-semibold text-white"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Undo FA</span>
                            </button>
                          ) : activePlayerTx ? (
                            <button
                              type="button"
                              onClick={() =>
                                removeTransaction(activePlayerTx.txId)
                              }
                              className="min-h-[36px] inline-flex items-center gap-1 border border-[#2563eb] bg-[#2563eb] px-3 py-1.5 text-[11px] font-semibold text-white"
                            >
                              <span>Undo {activePlayerTx.type}</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionMenuPlayerId(
                                openActionMenuPlayerId === player.id
                                  ? null
                                  : player.id
                              )
                            }
                            className={`min-h-[36px] inline-flex items-center gap-1 border px-2.5 py-1.5 text-[11px] font-semibold ${
                              openActionMenuPlayerId === player.id
                                ? 'border-[#111827] bg-[#111827] text-white'
                                : 'border-[#cbd5e1] bg-[#f8fafc] text-[#111827]'
                            }`}
                          >
                            <span>Action</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {!isNewlySignedFa &&
                            !activePlayerTx &&
                            extensionLikelihoodPct >= 55 &&
                            row.extensionWindowYears.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  addExtensionTransaction(
                                    player,
                                    Math.min(
                                      3,
                                      Math.max(
                                        1,
                                        row.extensionWindowYears.length
                                      )
                                    ),
                                    forecast.projectedMarketApy,
                                    0.55,
                                    'Backloaded',
                                    row.lastActiveContractYear
                                  )
                                }
                                className="min-h-[36px] border border-[#15803d] bg-[#dcfce7] px-2.5 py-1.5 font-mono-ledger text-[11px] font-bold text-[#14532d]"
                              >
                                + Extend (~$
                                {forecast.projectedMarketApy.toFixed(1)}M)
                              </button>
                            )}
                          {!isNewlySignedFa &&
                            !activePlayerTx &&
                            forecast.bestCutSavings2026 >= 2.5 && (
                              <button
                                type="button"
                                onClick={() =>
                                  addCutTransaction(
                                    player,
                                    'PRE_JUNE_1_CUT',
                                    2026
                                  )
                                }
                                className="min-h-[36px] border border-[#d97706] bg-[#fef3c7] px-2.5 py-1.5 font-mono-ledger text-[11px] font-bold text-[#78350f]"
                              >
                                ✂ Cut (+$
                                {forecast.bestCutSavings2026.toFixed(1)}M)
                              </button>
                            )}
                          {!isNewlySignedFa &&
                            !activePlayerTx &&
                            forecast.maxRestructureSavings2026 >= 2.5 && (
                              <button
                                type="button"
                                onClick={() =>
                                  addRestructureTransaction(
                                    player,
                                    1.0,
                                    2,
                                    2026
                                  )
                                }
                                className="min-h-[36px] border border-[#111827] bg-white px-2.5 py-1.5 font-mono-ledger text-[11px] font-bold text-[#111827]"
                              >
                                Restructure (+$
                                {forecast.maxRestructureSavings2026.toFixed(1)}
                                M)
                              </button>
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            selectPlayer(
                              player.id,
                              forecast.recommendedActionTab,
                              2026
                            )
                          }
                          className="min-h-[36px] inline-flex items-center gap-1 px-2 text-xs font-semibold text-[#111827] underline"
                        >
                          <span>4 Doors →</span>
                        </button>
                      </>
                    )}
                  </div>

                  {!isCurrentState && openActionMenuPlayerId === player.id && (
                    <div className="relative pt-1">
                      {renderPlayerActionMenu(
                        row,
                        'left-0 right-0 top-full mt-1 !w-full'
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!isFilteredRoster && filteredTimelineRows.length > 15 && (
              <button
                type="button"
                onClick={() => setShowAllMobileRoster((prev) => !prev)}
                className="w-full min-h-[44px] border-2 border-[#111827] bg-[#f7f5f0] px-4 py-2.5 text-xs font-bold text-[#111827] active:bg-[#ebe6dc]"
              >
                {showAllMobileRoster
                  ? 'Show Top 15 Contracts Only ▲'
                  : `Show All ${filteredTimelineRows.length} Players (+${filteredTimelineRows.length - 15} More Starters, Rookies & Depth) ▼`}
              </button>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          VIEW MODE 2: 4-BUCKET FUTURE ROSTER OUTLOOK BY YEAR (2026–2029)
         ===================================================================== */}
      {(effectiveTab === 'ACTIVE' || effectiveTab === 'MODIFIED') &&
        viewMode === 'BUCKET_CARDS' && (
        <>
          {/* Season Year Switcher + 4 Bucket Summary Cards */}
          <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfd9cc] pb-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                  Select Season to Project Roster Status Buckets
                </div>
                <div className="font-editorial text-xl text-[#1c1917]">
                  Viewing {targetYear} Season Roster Projection
                </div>
              </div>

              <div className="grid grid-cols-4 border-2 border-[#1c1917] bg-[#f6f3ec]">
                {LEAGUE_YEARS.map((yr) => {
                  const isSelected = targetYear === yr;
                  const ySpace = activeCapState.years[yr].effectiveCapSpace;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setTargetYear(yr)}
                      className={`px-4 py-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#1c1917] text-[#f6f3ec]'
                          : 'text-[#1c1917] hover:bg-[#ede8dd]'
                      }`}
                    >
                      <div className="font-editorial text-lg leading-none">
                        {yr}
                      </div>
                      <div
                        className={`mt-1 font-mono-ledger text-[10px] ${
                          isSelected
                            ? 'text-[#f6f3ec]/80'
                            : ySpace < 0
                            ? 'text-[#b84a27] font-semibold'
                            : 'text-[#2d5a43]'
                        }`}
                      >
                        {ySpace >= 0 ? '+$' : '−$'}
                        {Math.abs(ySpace).toFixed(0)}M cap
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Bucket 1 Card: Safe Under Contract */}
              <button
                type="button"
                onClick={() =>
                  setBucketFilter((prev) =>
                    prev === 'SAFE_UNDER_CONTRACT'
                      ? 'ALL_BUCKETS'
                      : 'SAFE_UNDER_CONTRACT'
                  )
                }
                className={`flex flex-col justify-between border p-4 text-left transition-all cursor-pointer ${
                  bucketFilter === 'SAFE_UNDER_CONTRACT'
                    ? 'border-2 border-[#2d5a43] bg-[#2d5a43]/10'
                    : 'border-[#dfd9cc] bg-[#f6f3ec] hover:border-[#1c1917]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2d5a43]">
                    <span>1. Safe Under Contract</span>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="mt-1.5 font-mono-ledger text-2xl font-semibold text-[#1c1917]">
                    {outlook.totals.underContractCount -
                      outlook.totals.likelyCutsCount}{' '}
                    Players
                  </div>
                  <p className="mt-1 text-xs text-[#57534e]">
                    Accounting for{' '}
                    <strong className="font-mono-ledger text-[#1c1917]">
                      ${outlook.totals.safeContractCapTotal.toFixed(1)}M
                    </strong>{' '}
                    in {targetYear} cap commitments.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#dfd9cc] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#2d5a43]">
                  {bucketFilter === 'SAFE_UNDER_CONTRACT'
                    ? 'Showing Only This Bucket (Click to Show All)'
                    : 'Filter to Safe Contracts →'}
                </div>
              </button>

              {/* Bucket 2 Card: Likely Cap Cuts / Fake Years */}
              <button
                type="button"
                onClick={() =>
                  setBucketFilter((prev) =>
                    prev === 'LIKELY_CAP_CUT' ? 'ALL_BUCKETS' : 'LIKELY_CAP_CUT'
                  )
                }
                className={`flex flex-col justify-between border p-4 text-left transition-all cursor-pointer ${
                  bucketFilter === 'LIKELY_CAP_CUT'
                    ? 'border-2 border-[#b84a27] bg-[#b84a27]/10'
                    : 'border-[#dfd9cc] bg-[#f6f3ec] hover:border-[#1c1917]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b84a27]">
                    <span>2. Likely {targetYear} Cap Cuts</span>
                    <Scissors className="h-4 w-4" />
                  </div>
                  <div className="mt-1.5 font-mono-ledger text-2xl font-semibold text-[#b84a27]">
                    {outlook.totals.likelyCutsCount} Players
                  </div>
                  <p className="mt-1 text-xs text-[#57534e]">
                    Releasing all {outlook.totals.likelyCutsCount} frees{' '}
                    <strong className="font-mono-ledger text-[#2d5a43]">
                      +${outlook.totals.likelyCutsPotentialSavings.toFixed(1)}M
                    </strong>{' '}
                    in {targetYear} cap space.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#dfd9cc] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b84a27]">
                  {bucketFilter === 'LIKELY_CAP_CUT'
                    ? 'Showing Only This Bucket (Click to Show All)'
                    : 'Filter to Likely Cap Cuts →'}
                </div>
              </button>

              {/* Bucket 3 Card: Off-Contract / Newly Expired Free Agents */}
              <button
                type="button"
                onClick={() =>
                  setBucketFilter((prev) =>
                    prev === 'OFF_CONTRACT_FA'
                      ? 'ALL_BUCKETS'
                      : 'OFF_CONTRACT_FA'
                  )
                }
                className={`flex flex-col justify-between border p-4 text-left transition-all cursor-pointer ${
                  bucketFilter === 'OFF_CONTRACT_FA'
                    ? 'border-2 border-[#b57c1e] bg-[#b57c1e]/10'
                    : 'border-[#dfd9cc] bg-[#f6f3ec] hover:border-[#1c1917]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b57c1e]">
                    <span>3. Off-Contract / {targetYear} FAs</span>
                    <UserMinus className="h-4 w-4" />
                  </div>
                  <div className="mt-1.5 font-mono-ledger text-2xl font-semibold text-[#1c1917]">
                    {outlook.totals.offContractCount} Players
                  </div>
                  <p className="mt-1 text-xs text-[#57534e]">
                    <strong className="text-[#1c1917]">
                      {outlook.totals.newlyExpiredCount}
                    </strong>{' '}
                    expire entering {targetYear} (
                    <strong className="text-[#2d5a43]">
                      {outlook.totals.primeResignCount} prime re-sign targets
                    </strong>
                    ).
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#dfd9cc] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b57c1e]">
                  {bucketFilter === 'OFF_CONTRACT_FA'
                    ? 'Showing Only This Bucket (Click to Show All)'
                    : 'Filter to Off-Contract FAs →'}
                </div>
              </button>

              {/* Bucket 4 Card: Void-Year Ghost Bills */}
              <button
                type="button"
                onClick={() =>
                  setBucketFilter((prev) =>
                    prev === 'VOID_GHOST_BILL'
                      ? 'ALL_BUCKETS'
                      : 'VOID_GHOST_BILL'
                  )
                }
                className={`flex flex-col justify-between border p-4 text-left transition-all cursor-pointer ${
                  bucketFilter === 'VOID_GHOST_BILL'
                    ? 'border-2 border-[#1c1917] bg-[#ede8dd]'
                    : 'border-[#dfd9cc] bg-[#f6f3ec] hover:border-[#1c1917]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#57534e]">
                    <span>4. Void-Year Ghost Bills</span>
                    <Ghost className="h-4 w-4" />
                  </div>
                  <div className="mt-1.5 font-mono-ledger text-2xl font-semibold text-[#1c1917]">
                    {outlook.totals.voidGhostBillsCount} Contracts
                  </div>
                  <p className="mt-1 text-xs text-[#57534e]">
                    Leaving{' '}
                    <strong className="font-mono-ledger text-[#b84a27]">
                      ${outlook.totals.voidGhostBillsTotal.toFixed(1)}M
                    </strong>{' '}
                    in deferred bonus charges in {targetYear}.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#dfd9cc] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#57534e]">
                  {bucketFilter === 'VOID_GHOST_BILL'
                    ? 'Showing Only This Bucket (Click to Show All)'
                    : 'Filter to Void Ghost Bills →'}
                </div>
              </button>
            </div>
          </section>

          {/* BUCKET SECTION 1: Likely Cap Cuts / Fake Contract Years */}
          {(bucketFilter === 'ALL_BUCKETS' ||
            bucketFilter === 'LIKELY_CAP_CUT') && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#b84a27] pb-2.5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-editorial text-2xl text-[#1c1917]">
                    Likely {targetYear} Cap Cuts ({filteredCuts.length})
                  </h2>
                  <span className="font-mono-ledger text-xs font-semibold text-[#b84a27]">
                    +${outlook.totals.likelyCutsPotentialSavings.toFixed(1)}M potential savings
                  </span>
                </div>

                {filteredCuts.length > 0 &&
                  (isCurrentState ? (
                    <button
                      type="button"
                      onClick={() => openInTeamBuilder({ subTab: 'cap-fixes' })}
                      className="inline-flex items-center gap-1.5 bg-[#1c1917] px-4 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      <span>Simulate Cuts in Team Builder →</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        for (const c of filteredCuts) {
                          addCutTransaction(
                            c.player,
                            'PRE_JUNE_1_CUT',
                            targetYear
                          );
                        }
                      }}
                      className="bg-[#b84a27] px-4 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#9a3c1e] transition-colors cursor-pointer"
                    >
                      1-Click Cut All {filteredCuts.length} {targetYear} Cap
                      Casualties (+$
                      {filteredCuts
                        .reduce((s, x) => s + x.capSavingsIfCutPreJune1, 0)
                        .toFixed(1)}
                      M)
                    </button>
                  ))}
              </div>

              {filteredCuts.length === 0 ? (
                <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-6 text-xs text-[#8a8379]">
                  No bloated or unprotected veteran contracts flagged as likely{' '}
                  {targetYear} cap casualties under current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredCuts.map(renderEvaluationCard)}
                </div>
              )}
            </section>
          )}

          {/* BUCKET SECTION 2: Off-Contract / Newly Expired Free Agents */}
          {(bucketFilter === 'ALL_BUCKETS' ||
            bucketFilter === 'OFF_CONTRACT_FA') && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#b57c1e] pb-2.5">
                <h2 className="font-editorial text-2xl text-[#1c1917]">
                  Off-Contract in {targetYear} ({filteredOffContract.length})
                </h2>
              </div>

              {filteredOffContract.length === 0 ? (
                <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-6 text-xs text-[#8a8379]">
                  {targetYear === 2026
                    ? 'All current roster players are under contract for the 2026 season. Switch to 2027, 2028, or 2029 above to see who expires!'
                    : `No off-contract players match your current filter in ${targetYear}.`}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredOffContract.map(renderEvaluationCard)}
                </div>
              )}
            </section>
          )}

          {/* BUCKET SECTION 3: Safe Under Contract */}
          {(bucketFilter === 'ALL_BUCKETS' ||
            bucketFilter === 'SAFE_UNDER_CONTRACT') && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#2d5a43] pb-2.5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-editorial text-2xl text-[#1c1917]">
                    Safe Under Contract in {targetYear} ({filteredSafe.length})
                  </h2>
                  <span className="font-mono-ledger text-xs font-semibold text-[#2d5a43]">
                    ${outlook.totals.safeContractCapTotal.toFixed(1)}M combined cap hit
                  </span>
                </div>
              </div>

              {filteredSafe.length === 0 ? (
                <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-6 text-xs text-[#8a8379]">
                  No safe under-contract players match your current filter in{' '}
                  {targetYear}.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredSafe.map(renderEvaluationCard)}
                </div>
              )}
            </section>
          )}

          {/* BUCKET SECTION 4: Void-Year Ghost Bills */}
          {(bucketFilter === 'ALL_BUCKETS' ||
            bucketFilter === 'VOID_GHOST_BILL') &&
            filteredVoid.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#1c1917] pb-2.5">
                  <h2 className="font-editorial text-2xl text-[#1c1917]">
                    Void-Year Ghost Bills in {targetYear} ({filteredVoid.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredVoid.map(renderEvaluationCard)}
                </div>
              </section>
            )}
        </>
      )}

      {!isCurrentState &&
        effectiveTab === 'MODIFIED' &&
        (() => {
          const sessionDeadEntries = sortedDeadCapLedger.filter((entry) =>
            deadCapTxMap.has(entry.id)
          );
          if (sessionDeadEntries.length === 0) return null;
          return (
            <section className="border-2 border-[#2563eb] bg-[#eff6ff] p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bfdbfe] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 bg-[#2563eb]" />
                  <h3 className="font-editorial text-lg font-bold text-[#1e3a8a]">
                    Departed / Cut / Traded Players ({sessionDeadEntries.length})
                  </h3>
                </div>
                <span className="font-mono-ledger text-[11px] font-semibold text-[#1e40af]">
                  Tap Undo / Restore to return a released or traded player to the active roster
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sessionDeadEntries.map((entry) => {
                  const sessionTx = deadCapTxMap.get(entry.id);
                  const dead2026 = entry.amountsByYear[2026] ?? 0;
                  return (
                    <div
                      key={`mod-dead-${entry.id}`}
                      className="flex items-center justify-between gap-2 border border-[#93c5fd] bg-white px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-editorial text-sm font-bold text-[#111827]">
                            {entry.playerName}
                          </span>
                          <span className="font-mono-ledger text-[10px] font-semibold text-[#475569]">
                            {entry.position}
                          </span>
                        </div>
                        <div className="truncate font-mono-ledger text-[10px] text-[#475569]">
                          {entry.reason} · 2026 Dead:{' '}
                          <span className="font-bold text-[#b91c1c]">
                            ${dead2026.toFixed(2)}M
                          </span>
                        </div>
                      </div>
                      {sessionTx && (
                        <button
                          type="button"
                          onClick={() => removeTransaction(sessionTx.id)}
                          className="shrink-0 inline-flex items-center gap-1 border border-[#2563eb] bg-[#2563eb] px-2.5 py-1.5 font-mono-ledger text-[11px] font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Undo / Restore</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

      {/* =====================================================================
          SECTION A (BELOW PLAYERS): POSITIONAL NEEDS BY YEAR MATRIX (2026–2029)
         ===================================================================== */}
      <section
        id="positional-needs-matrix"
        className="scroll-mt-24 border border-[#dfd9cc] bg-[#fcfaf6] p-6 space-y-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-3.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#b84a27] shrink-0" />
            <h2 className="font-editorial text-2xl text-[#1c1917]">
              {isCurrentState
                ? 'Positional Needs by Year (2026–2029)'
                : 'Projected Positional Needs (2026–2029)'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 bg-[#b84a27] border border-[#b84a27]" />
              <span className="font-semibold text-[#b84a27]">
                Need Starter(s)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 bg-[#b57c1e]/30 border border-[#b57c1e]" />
              <span className="font-semibold text-[#b57c1e]">Need Depth</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 bg-[#2d5a43]/20 border border-[#2d5a43]" />
              <span className="font-semibold text-[#2d5a43]">
                Solid / Surplus
              </span>
            </div>
          </div>
        </div>

        {/* DESKTOP VIEW: Positional Needs Table */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Positional Needs by Year Matrix"
          className={`${desktopBlockClass} overflow-x-auto [container-type:inline-size]`}
        >
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
                <th className="py-2.5 pr-4 w-[220px]">
                  Position Group · 53-Man Target
                </th>
                {LEAGUE_YEARS.map((yr) => (
                  <th
                    key={yr}
                    className="py-2.5 px-2.5 text-left border-l border-[#dfd9cc] w-[175px]"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-editorial text-base font-normal text-[#1c1917]">
                        {yr} Outlook
                      </span>
                      <span className="font-mono-ledger text-[10px] text-[#8a8379]">
                        {
                          positionalNeeds.filter(
                            (r) => r.cellsByYear[yr].urgency === 'CRITICAL_NEED'
                          ).length
                        }{' '}
                        starter needs
                      </span>
                    </div>
                  </th>
                ))}
                <th className="py-2.5 pl-3 text-right w-[130px] border-l border-[#dfd9cc]">
                  Shop Position
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfd9cc]">
              {positionalNeeds.map((row) => {
                const isSelectedPos = faPosFilter === row.position;
                return (
                  <tr
                    key={row.position}
                    className={`transition-colors ${
                      isSelectedPos ? 'bg-[#ebe6dc]' : 'hover:bg-[#f8fafc]'
                    }`}
                  >
                    <th scope="row" className="py-3.5 pr-4 align-middle">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-mono-ledger text-sm font-bold text-[#111827]">
                            {row.label}
                          </div>
                          <div className="font-mono-ledger text-xs font-medium text-[#475569]">
                            Target: {row.targetStarters} Starter
                            {row.targetStarters > 1 ? 's' : ''} /{' '}
                            {row.targetDepth} Total
                          </div>
                        </div>
                      </div>
                    </th>

                    {LEAGUE_YEARS.map((yr) => {
                      const cell = row.cellsByYear[yr];
                      const cellStyle =
                        cell.urgency === 'CRITICAL_NEED'
                          ? 'bg-[#fee2e2] border-[#dc2626] text-[#991b1b]'
                          : cell.urgency === 'DEPTH_NEED'
                          ? 'bg-[#fef3c7] border-[#d97706] text-[#92400e]'
                          : 'bg-[#dcfce7] border-[#16a34a] text-[#14532d]';

                      return (
                        <td
                          key={yr}
                          className="py-2 px-2 align-top border-l border-[#d6d0c4]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (isCurrentState) {
                                openInTeamBuilder({
                                  subTab: 'fa-dock',
                                  position: row.position,
                                });
                              } else {
                                setTeamBuilderSubTab('fa-dock');
                                setFaPosFilter(row.position);
                                const el = document.getElementById(
                                  'team-builder-workbench'
                                );
                                if (el)
                                  el.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className={`w-full border p-2.5 text-left transition-all hover:border-[#111827] cursor-pointer ${cellStyle}`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono-ledger">
                              <span className="text-xs font-bold uppercase tracking-[0.04em]">
                                {cell.badgeLabel}
                              </span>
                              <span className="text-xs font-bold text-[#111827]">
                                {cell.startersUnderContract}/
                                {cell.targetStarters} St
                              </span>
                            </div>
                            <div className="mt-1 font-mono-ledger text-[11px] font-medium text-[#1e293b]">
                              {cell.subLabel}
                            </div>
                            {cell.topPlayers.length > 0 ? (
                              <div className="mt-1 truncate font-mono-ledger text-[11px] font-medium text-[#1e293b]">
                                {cell.topPlayers.slice(0, 2).join(', ')}
                              </div>
                            ) : (
                              <div className="mt-1 font-mono-ledger text-[11px] font-bold text-[#991b1b]">
                                0 Players Signed!
                              </div>
                            )}
                            {cell.expiringAfterPrevYear.length > 0 && (
                              <div className="mt-0.5 truncate font-mono-ledger text-[11px] font-semibold text-[#991b1b]">
                                Lost: {cell.expiringAfterPrevYear[0]}
                                {cell.expiringAfterPrevYear.length > 1
                                  ? ` +${cell.expiringAfterPrevYear.length - 1}`
                                  : ''}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    <td className="py-2 pl-3 align-middle text-right border-l border-[#dfd9cc]">
                      {isCurrentState ? (
                        <button
                          type="button"
                          onClick={() =>
                            openInTeamBuilder({
                              subTab: 'fa-dock',
                              position: row.position,
                            })
                          }
                          className="inline-flex items-center gap-1 border border-[#1c1917] bg-[#1c1917] px-2.5 py-1.5 font-mono-ledger text-[10px] font-semibold text-[#f6f3ec] hover:bg-[#2d5a43] hover:border-[#2d5a43] transition-colors cursor-pointer"
                        >
                          <Wrench className="h-3 w-3" />
                          <span>Fix {row.position} →</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setTeamBuilderSubTab('fa-dock');
                            setFaPosFilter(
                              faPosFilter === row.position
                                ? 'ALL'
                                : row.position
                            );
                            const el = document.getElementById(
                              'team-builder-workbench'
                            );
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`inline-flex items-center gap-1 border px-2.5 py-1.5 font-mono-ledger text-[10px] font-semibold transition-colors cursor-pointer ${
                            isSelectedPos
                              ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                              : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
                          }`}
                        >
                          <UserPlus className="h-3 w-3" />
                          <span>
                            {isSelectedPos
                              ? `Filtering ${row.position}`
                              : `Add ${row.position} FA ↓`}
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* IPHONE / PIXEL MOBILE VIEW: Zero-Scroll Positional Needs Cards (2026–2029) */}
        <div className={`${mobileBlockClass} space-y-2.5`}>
          {positionalNeeds.map((row) => {
            const isSelectedPos = faPosFilter === row.position;
            return (
              <div
                key={`mob-need-${row.position}`}
                className={`border p-3 space-y-2 ${
                  isSelectedPos
                    ? 'border-[#1c1917] bg-[#ede8dd]'
                    : 'border-[#dfd9cc] bg-[#f6f3ec]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono-ledger text-xs font-bold text-[#1c1917]">
                      {row.label}
                    </div>
                    <div className="font-mono-ledger text-[10px] text-[#8a8379]">
                      Target: {row.targetStarters} Starter
                      {row.targetStarters > 1 ? 's' : ''} / {row.targetDepth}{' '}
                      Total
                    </div>
                  </div>
                  {isCurrentState ? (
                    <button
                      type="button"
                      onClick={() =>
                        openInTeamBuilder({
                          subTab: 'fa-dock',
                          position: row.position,
                        })
                      }
                      className="inline-flex items-center gap-1 border border-[#1c1917] bg-[#1c1917] px-2.5 py-1 font-mono-ledger text-[10px] font-semibold text-[#f6f3ec]"
                    >
                      <Wrench className="h-3 w-3" />
                      <span>Fix {row.position} →</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTeamBuilderSubTab('fa-dock');
                        setFaPosFilter(
                          faPosFilter === row.position ? 'ALL' : row.position
                        );
                        const el = document.getElementById(
                          'team-builder-workbench'
                        );
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`inline-flex items-center gap-1 border px-2.5 py-1 font-mono-ledger text-[10px] font-semibold ${
                        isSelectedPos
                          ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                          : 'border-[#1c1917] bg-[#fcfaf6] text-[#1c1917]'
                      }`}
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>Add {row.position} FA ↓</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {LEAGUE_YEARS.map((yr) => {
                    const cell = row.cellsByYear[yr];
                    const cellStyle =
                      cell.urgency === 'CRITICAL_NEED'
                        ? 'bg-[#fee2e2] border-[#dc2626] text-[#991b1b]'
                        : cell.urgency === 'DEPTH_NEED'
                        ? 'bg-[#fef3c7] border-[#d97706] text-[#92400e]'
                        : 'bg-[#dcfce7] border-[#16a34a] text-[#14532d]';
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          if (isCurrentState) {
                            openInTeamBuilder({
                              subTab: 'fa-dock',
                              position: row.position,
                            });
                          } else {
                            setTeamBuilderSubTab('fa-dock');
                            setFaPosFilter(row.position);
                            const el = document.getElementById(
                              'team-builder-workbench'
                            );
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className={`flex flex-col items-center justify-between border py-2 px-1 text-center font-mono-ledger ${cellStyle}`}
                      >
                        <span className="text-[10px] font-bold text-[#111827]">
                          {yr} ({cell.startersUnderContract}/
                          {cell.targetStarters} St)
                        </span>
                        <span className="mt-0.5 text-[10px] font-bold uppercase leading-tight truncate max-w-full">
                          {cell.urgency === 'CRITICAL_NEED'
                            ? 'Need Starter'
                            : cell.urgency === 'DEPTH_NEED'
                            ? 'Need Depth'
                            : 'Solid'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          MODE-SPECIFIC FOOTER: CTA IN CURRENT STATE vs 4-TAB WORKBENCH IN TEAM BUILDER
         ===================================================================== */}
      {isCurrentState ? (
        <div className="mt-6 border border-[#c7bfb0] bg-[#fcfaf6] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-semibold text-[#111827]">
            Ready to test cuts, restructures, free-agent signings, or trades?
          </span>
          <button
            type="button"
            onClick={() => openInTeamBuilder({ subTab: 'fa-dock' })}
            className="inline-flex items-center gap-1.5 bg-[#1e40af] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1e3a8a] transition-colors cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Open Team Builder →</span>
          </button>
        </div>
      ) : (
        <div id="team-builder-workbench" className="scroll-mt-24 space-y-5">
          {/* 4-Tab Interactive Team Builder Workbench Selector */}
          <div className="border-2 border-[#1c1917] bg-[#fcfaf6] p-3 sm:p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {(
                [
                  {
                    id: 'fa-dock',
                    kicker: '01',
                    label: '+ Add Free Agents',
                  },
                  {
                    id: 'cap-fixes',
                    kicker: '02',
                    label: 'Cut & Restructure',
                  },
                  {
                    id: 'draft-trade',
                    kicker: '03',
                    label: 'Trades & 2026 Draft',
                  },
                  {
                    id: 'ledger',
                    kicker: '04',
                    label: '4-Yr Cap Ledger',
                  },
                ] as { id: TeamBuilderSubTab; kicker: string; label: string }[]
              ).map((tab) => {
                const active = teamBuilderSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTeamBuilderSubTab(tab.id)}
                    className={`border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                        : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
                    }`}
                  >
                    <div
                      className={`font-mono-ledger text-[9px] uppercase tracking-[0.12em] ${
                        active ? 'text-[#7ce0a8]' : 'text-[#8a8379]'
                      }`}
                    >
                      {tab.kicker}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold">
                      {tab.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {teamBuilderSubTab === 'fa-dock' && (
            <section
              id="add-free-agents-dock"
              className="scroll-mt-24 border-2 border-[#1c1917] bg-[#fcfaf6] p-6 space-y-5"
            >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-3.5">
          <h2 className="font-editorial text-2xl text-[#1c1917]">
            Available Free Agents &amp; Street Cap Casualties
          </h2>

          {/* Live 2026 & 2027 Cap Space Pill + Full FA Modal Button */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="border border-[#dfd9cc] bg-[#f6f3ec] px-3.5 py-2 font-mono-ledger text-xs">
              <span className="text-[#8a8379]">2026 Cap Space: </span>
              <strong
                className={
                  space2026 < 0 ? 'text-[#b84a27]' : 'text-[#2d5a43]'
                }
              >
                {space2026 >= 0 ? '+$' : '−$'}
                {Math.abs(space2026).toFixed(1)}M
              </strong>
              <span className="mx-2 text-[#dfd9cc]">|</span>
              <span className="text-[#8a8379]">2027 Space: </span>
              <strong
                className={
                  derivedState.years[2027].effectiveCapSpace < 0
                    ? 'text-[#b84a27]'
                    : 'text-[#2d5a43]'
                }
              >
                {derivedState.years[2027].effectiveCapSpace >= 0 ? '+$' : '−$'}
                {Math.abs(derivedState.years[2027].effectiveCapSpace).toFixed(
                  1
                )}
                M
              </strong>
            </div>

            <button
              type="button"
              onClick={() => openFreeAgencyModal({ position: faPosFilter })}
              className="border border-[#1c1917] bg-[#f6f3ec] px-3.5 py-2 text-xs font-semibold text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
            >
              Custom Deal Builder Modal →
            </button>
          </div>
        </div>

        {/* Spotrac-Style 2-Tab Source Switcher: League Open Market vs Team Pending FAs */}
        <div
          role="tablist"
          aria-label="Free Agent Market Pool"
          className="flex flex-wrap items-center gap-2 border-b border-[#dfd9cc] pb-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={faDockSourceTab === 'LEAGUE'}
            onClick={() => {
              setFaDockSourceTab('LEAGUE');
              setFaShowCount(16);
            }}
            className={`min-h-[38px] border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              faDockSourceTab === 'LEAGUE'
                ? 'border-[#111827] bg-[#111827] text-white'
                : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#475569] hover:border-[#111827] hover:text-[#111827]'
            }`}
          >
            League Open Market ({faPool.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={faDockSourceTab === 'INTERNAL'}
            onClick={() => {
              setFaDockSourceTab('INTERNAL');
              setFaShowCount(16);
            }}
            className={`min-h-[38px] border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              faDockSourceTab === 'INTERNAL'
                ? 'border-[#15803d] bg-[#15803d] text-white'
                : 'border-[#16a34a]/40 bg-[#f0fdf4] text-[#14532d] hover:border-[#15803d]'
            }`}
          >
            {baseTeam.city} Pending FAs ({internalFaPool.length}) · Comp-Pick Safe
          </button>
        </div>

        {/* Search + Critical Need Position Quick Filters */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={faSearchQuery}
                onChange={(e) => setFaSearchQuery(e.target.value)}
                placeholder="Search free agents by name or team..."
                className="w-full min-h-[40px] border border-[#1c1917] bg-[#f6f3ec] py-1.5 pl-8 pr-3 text-xs text-[#1c1917] placeholder:text-[#8a8379] focus:outline-none"
              />
            </div>

            {criticalPositions2026Or2027.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 snap-x sm:flex-wrap">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b84a27]">
                  Needs:
                </span>
                {criticalPositions2026Or2027.map((needPos) => (
                  <button
                    key={needPos}
                    type="button"
                    onClick={() =>
                      setFaPosFilter(faPosFilter === needPos ? 'ALL' : needPos)
                    }
                    className={`shrink-0 snap-start min-h-[32px] border px-2.5 py-1 font-mono-ledger text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      faPosFilter === needPos
                        ? 'border-[#b84a27] bg-[#b84a27] text-[#f6f3ec]'
                        : 'border-[#b84a27]/50 bg-[#b84a27]/10 text-[#b84a27] hover:bg-[#b84a27] hover:text-[#f6f3ec]'
                    }`}
                  >
                    ★ Need {needPos}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 snap-x lg:flex-wrap lg:overflow-visible">
            <span className="shrink-0 mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
              Pos:
            </span>
            {ALL_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setFaPosFilter(pos)}
                className={`shrink-0 snap-start min-h-[34px] px-2.5 py-1 font-mono-ledger text-xs whitespace-nowrap transition-colors cursor-pointer ${
                  faPosFilter === pos
                    ? 'bg-[#1c1917] font-semibold text-[#f6f3ec]'
                    : 'bg-[#ede8dd] sm:bg-transparent text-[#57534e] hover:bg-[#ede8dd] hover:text-[#1c1917]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* DESKTOP VIEW: Free Agent Grid Rows with 2026–2029 Contract Preview Bars & 1-Click Add to Grid */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Available Free Agents and Street Cap Casualties"
          className={`${desktopBlockClass} overflow-x-auto [container-type:inline-size]`}
        >
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
                <th className="py-2.5 pr-4 w-[280px]">
                  Available Free Agent · Origin &amp; Comp-Pick Status
                </th>
                <th className="py-2.5 px-3 w-[165px] border-l border-[#dfd9cc]">
                  Projected Deal
                </th>
                {LEAGUE_YEARS.map((yr) => (
                  <th
                    key={yr}
                    className="py-2.5 px-1.5 text-center w-[115px] border-l border-[#dfd9cc]"
                  >
                    {yr} Cap Bar
                  </th>
                ))}
                <th className="py-2.5 pl-3 text-right w-[190px] border-l border-[#dfd9cc]">
                  Add / Remove in Grid
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfd9cc]">
              {filteredFaPool.slice(0, faShowCount).map((item) => {
                const { fa, evalResult, sampleContract } = item;
                const existingTxId = activeSignFaTxByPlayerId.get(fa.id);
                const isAdded = Boolean(existingTxId);
                const isNeedPos = criticalPositions2026Or2027.includes(
                  fa.position
                );
                const faValueBadge = evaluateFreeAgentValueBadge(fa);

                return (
                  <tr
                    key={fa.id}
                    className={`transition-colors ${
                      isAdded
                        ? 'bg-[#2d5a43]/12 hover:bg-[#2d5a43]/18'
                        : 'hover:bg-[#f6f3ec]'
                    }`}
                  >
                    <th scope="row" className="py-3 pr-4 align-middle">
                      <div className="flex items-start gap-2.5">
                        <PlayerAvatar
                          name={fa.name}
                          headshotUrl={
                            fa.headshotUrl ??
                            playerHeadshotByName.get(fa.name.toLowerCase())
                          }
                          teamId={fa.previousTeam.split(' ')[0]}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-sm text-[#111827]">
                              {fa.name}
                            </span>
                            <span className="border border-[#cbd5e1] bg-[#f8fafc] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#334155]">
                              {fa.position} · Age {fa.ageIn2026} · Rating{' '}
                              {fa.overallRating}/99
                            </span>
                            {isNeedPos && (
                              <span className="border border-[#dc2626] bg-[#fee2e2] px-2 py-0.5 font-mono-ledger text-[11px] font-bold text-[#991b1b]">
                                Fills {fa.position} Need
                              </span>
                            )}
                            <span
                              title={faValueBadge.reason}
                              className={`border px-2 py-0.5 font-mono-ledger text-[11px] font-bold ${getFaValueBadgeClass(
                                faValueBadge.tier
                              )}`}
                            >
                              {faValueBadge.badgeLabel}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono-ledger text-xs">
                            <span className="text-[#334155] font-medium">
                              From {fa.previousTeam}
                            </span>
                            <span>·</span>
                            <span
                              className={
                                evalResult.countsTowardCompFormula
                                  ? 'text-[#b45309] font-semibold'
                                  : 'text-[#15803d] font-semibold'
                              }
                            >
                              {faDockSourceTab === 'INTERNAL'
                                ? `If Walks: Proj. Rd ${projectCompPickRound(fa.marketApy) ?? 6} Comp · Re-Sign is Safe`
                                : evalResult.countsTowardCompFormula
                                ? `UFA · Proj. Rd ${evalResult.projectedCompPickRound ?? 5} Comp Pick (Counts vs Formula)`
                                : '★ Street FA (Comp-Pick Safe!)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </th>

                    <td className="py-2.5 px-3 align-middle border-l border-[#d6d0c4] font-mono-ledger">
                      <div className="text-xs sm:text-sm font-bold text-[#111827]">
                        {fa.marketYears} yrs · $
                        {(fa.marketYears * fa.marketApy).toFixed(1)}M
                      </div>
                      <div className="text-xs font-medium text-[#334155]">
                        ${fa.marketApy.toFixed(1)}M/yr ·{' '}
                        {Math.round(fa.marketGuaranteedPct * 100)}% Gtd
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#15803d] font-semibold">
                        {evalResult.availabilityProbability}% Market Prob.
                      </div>
                    </td>

                    {LEAGUE_YEARS.map((yr) => {
                      const cy = sampleContract.contractYears[yr];
                      const hit = getContractYearCapHit(cy);
                      if (!cy || hit <= 0) {
                        return (
                          <td
                            key={yr}
                            className="py-2 px-1.5 align-middle border-l border-[#d6d0c4] text-center"
                          >
                            <div className="h-12 border border-dashed border-[#cbd5e1] bg-[#f8fafc] flex items-center justify-center font-mono-ledger text-[11px] font-medium text-[#475569]">
                              Off Deal
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={yr}
                          className="py-2 px-1 align-middle border-l border-[#d6d0c4]"
                        >
                          <div
                            className={`h-12 px-2.5 py-1.5 flex flex-col justify-between font-mono-ledger ${
                              isAdded
                                ? 'bg-[#15803d] text-white'
                                : 'bg-[#1e3a5f] text-white'
                            }`}
                          >
                            <span className="text-xs font-bold">
                              ${hit.toFixed(1)}M
                            </span>
                            <span className="text-[11px] text-[#e2e8f0]">
                              {cy.guaranteedSalary > 0 ? 'Gtd Yr' : 'Ungtd Yr'}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-2.5 pl-3 align-middle text-right border-l border-[#dfd9cc]">
                      {isAdded && existingTxId ? (
                        <button
                          type="button"
                          onClick={() => removeTransaction(existingTxId)}
                          className="inline-flex items-center justify-center gap-1.5 w-full border border-[#2d5a43] bg-[#2d5a43] px-3 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#b84a27] hover:border-[#b84a27] transition-colors cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Added to Grid (Undo)</span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              addSignFATransaction(
                                fa,
                                fa.marketYears,
                                fa.marketApy,
                                fa.marketGuaranteedPct,
                                'Backloaded'
                              )
                            }
                            className="inline-flex items-center justify-center gap-1 bg-[#1c1917] px-2.5 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#2d5a43] transition-colors cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add to Roster Grid</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              addSignFATransaction(fa, 1, 1.2, 0, 'Flat')
                            }
                            title="1-Tap Vet Minimum 1-yr / $1.2M deal"
                            className="border border-[#15803d] bg-[#f0fdf4] px-2 py-2 font-mono-ledger text-[10px] font-bold text-[#14532d] hover:bg-[#dcfce7] transition-colors cursor-pointer"
                          >
                            Vet Min ($1.2M)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openFreeAgencyModal({ freeAgentId: fa.id })
                            }
                            title="Customize years, APY, and structure before signing"
                            className="border border-[#dfd9cc] bg-[#f6f3ec] px-2 py-2 font-mono-ledger text-[10px] font-semibold text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* IPHONE / PIXEL MOBILE VIEW: Thumb-Friendly Free Agent Add Cards */}
        <div className={`${mobileBlockClass} space-y-3`}>
          {filteredFaPool.slice(0, faShowCount).map((item) => {
            const { fa, evalResult, sampleContract } = item;
            const existingTxId = activeSignFaTxByPlayerId.get(fa.id);
            const isAdded = Boolean(existingTxId);
            const isNeedPos = criticalPositions2026Or2027.includes(fa.position);
            const faValueBadge = evaluateFreeAgentValueBadge(fa);

            return (
              <div
                key={`mob-fa-${fa.id}`}
                className={`border p-3.5 space-y-2.5 ${
                  isAdded
                    ? 'border-2 border-[#2d5a43] bg-[#2d5a43]/12'
                    : 'border-[#dfd9cc] bg-[#f6f3ec]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <PlayerAvatar
                      name={fa.name}
                      headshotUrl={
                        fa.headshotUrl ??
                        playerHeadshotByName.get(fa.name.toLowerCase())
                      }
                      teamId={fa.previousTeam.split(' ')[0]}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-[#111827]">
                          {fa.name}
                        </span>
                        <span className="border border-[#cbd5e1] bg-[#f8fafc] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-[#334155]">
                          {fa.position} · Age {fa.ageIn2026} · Rating{' '}
                          {fa.overallRating}/99
                        </span>
                        {isNeedPos && (
                          <span className="border border-[#dc2626] bg-[#fee2e2] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-[#991b1b]">
                            Fills {fa.position} Need
                          </span>
                        )}
                        <span
                          title={faValueBadge.reason}
                          className={`border px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold ${getFaValueBadgeClass(
                            faValueBadge.tier
                          )}`}
                        >
                          {faValueBadge.badgeLabel}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono-ledger text-xs font-medium text-[#334155]">
                        From {fa.previousTeam} ·{' '}
                        <span
                          className={
                            evalResult.countsTowardCompFormula
                              ? 'text-[#b45309] font-semibold'
                              : 'text-[#15803d] font-semibold'
                          }
                        >
                          {faDockSourceTab === 'INTERNAL'
                            ? `Walk → Proj. Rd ${projectCompPickRound(fa.marketApy) ?? 6} Comp (Re-Sign Safe)`
                            : evalResult.countsTowardCompFormula
                            ? `UFA · Proj. Rd ${evalResult.projectedCompPickRound ?? 5} Comp (Costs Formula)`
                            : '★ Street FA (Comp-Pick Safe!)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono-ledger shrink-0">
                    <div className="text-xs font-bold text-[#111827]">
                      {fa.marketYears}yr · $
                      {(fa.marketYears * fa.marketApy).toFixed(1)}M
                    </div>
                    <div className="text-[11px] text-[#15803d] font-semibold">
                      ${fa.marketApy.toFixed(1)}M/yr
                    </div>
                  </div>
                </div>

                {/* 4-Year Contract Preview Bar (2026–2029) */}
                <div className="grid grid-cols-4 gap-1">
                  {LEAGUE_YEARS.map((yr) => {
                    const cy = sampleContract.contractYears[yr];
                    const hit = getContractYearCapHit(cy);
                    if (!cy || hit <= 0) {
                      return (
                        <div
                          key={yr}
                          className="border border-dashed border-[#cbd5e1] bg-[#f8fafc] py-1.5 px-1 text-center font-mono-ledger text-[10px] font-medium text-[#475569]"
                        >
                          <div>{yr}</div>
                          <div>Off Deal</div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={yr}
                        className={`py-1.5 px-1.5 text-center font-mono-ledger ${
                          isAdded
                            ? 'bg-[#15803d] text-white'
                            : 'bg-[#1e3a5f] text-white'
                        }`}
                      >
                        <div className="text-[9px] opacity-75">{yr}</div>
                        <div className="text-[11px] font-bold">
                          ${hit.toFixed(1)}M
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Full-Width Thumb-Friendly Add / Undo Action */}
                <div className="flex items-center gap-2 pt-1">
                  {isAdded && existingTxId ? (
                    <button
                      type="button"
                      onClick={() => removeTransaction(existingTxId)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 border border-[#2d5a43] bg-[#2d5a43] py-2 px-3 text-xs font-semibold text-[#f6f3ec]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Added to Roster Grid (Tap to Remove)</span>
                    </button>
                  ) : (
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          addSignFATransaction(
                            fa,
                            fa.marketYears,
                            fa.marketApy,
                            fa.marketGuaranteedPct,
                            'Backloaded'
                          )
                        }
                        className="flex-1 min-w-[140px] min-h-[38px] inline-flex items-center justify-center gap-1.5 bg-[#1c1917] py-2 px-3 text-xs font-semibold text-[#f6f3ec] active:bg-[#2d5a43]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Add to Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          addSignFATransaction(fa, 1, 1.2, 0, 'Flat')
                        }
                        className="min-h-[38px] border border-[#15803d] bg-[#f0fdf4] py-2 px-2.5 font-mono-ledger text-[11px] font-bold text-[#14532d]"
                      >
                        Vet Min ($1.2M)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openFreeAgencyModal({ freeAgentId: fa.id })
                        }
                        className="min-h-[38px] border border-[#1c1917] bg-[#fcfaf6] py-2 px-3 font-mono-ledger text-xs font-semibold text-[#1c1917]"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredFaPool.length > faShowCount && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setFaShowCount((c) => c + 16)}
              className="border border-[#1c1917] bg-[#f6f3ec] px-5 py-2 text-xs font-semibold text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
            >
              Show More Free Agents ({filteredFaPool.length - faShowCount}{' '}
              remaining)
            </button>
          </div>
        )}
            </section>
          )}

          {teamBuilderSubTab === 'cap-fixes' && (
            <div className="border border-[#dfd9cc] bg-[#fcfaf6]">
              <CapCheckupJourney />
            </div>
          )}

          {teamBuilderSubTab === 'draft-trade' && (
            <div className="border border-[#dfd9cc] bg-[#fcfaf6]">
              <DraftTradeSandbox />
            </div>
          )}

          {teamBuilderSubTab === 'ledger' && (
            <div className="border border-[#dfd9cc] bg-[#fcfaf6]">
              <RosterMatrix />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
