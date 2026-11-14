'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  Ghost,
  LayoutGrid,
  Monitor,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import {
  buildPlayerContractTimelineRow,
  buildStructuredContract,
  computeRealContractXRay,
  evaluateFreeAgentTarget,
  evaluateFutureSeasonRosterOutlook,
  evaluateTeamPositionalNeedsByYear,
  FutureRosterBucket,
  FutureSeasonPlayerEvaluation,
  getContractYearCapHit,
  LEAGUE_YEARS,
  LeagueYear,
  POSITION_GROUPS,
  PositionGroup,
  projectPlayerCareerHorizon,
  TIMELINE_HORIZON_YEARS,
} from '@/engine';
import { getLeagueWideFreeAgentPool } from '@/data/seed/freeAgents';
import { useGMStore } from '@/store/useGMStore';
import { PlayerAvatar } from './PlayerAvatar';
import { JargonTip } from './JargonTooltip';
import { GlobalPlayerSearch } from './PlayerDossierModal';

type Journey2ViewMode = 'TIMELINE_BARS' | 'BUCKET_CARDS';
type BucketFilter = 'ALL_BUCKETS' | FutureRosterBucket;
type TimelineQuickFilter =
  | 'ALL'
  | 'HIGH_EXT_LIKELY'
  | 'CUT_RISK_YEARS'
  | 'EXPIRING_2026'
  | 'VOID_BILLS'
  | 'ADDED_FA';

const ALL_POSITIONS: (PositionGroup | 'ALL')[] = ['ALL', ...POSITION_GROUPS];

export function PlayerFateJourney() {
  const {
    baseTeam,
    derivedState,
    transactions,
    selectPlayer,
    addCutTransaction,
    addRestructureTransaction,
    addExtensionTransaction,
    addSignFATransaction,
    removeTransaction,
    resetScenarioStack,
    setActiveTab,
    openFreeAgencyModal,
    openPlayerDossier,
  } = useGMStore();

  const [viewMode, setViewMode] = useState<Journey2ViewMode>('TIMELINE_BARS');
  const [timelineFilter, setTimelineFilter] =
    useState<TimelineQuickFilter>('ALL');
  const [targetYear, setTargetYear] = useState<LeagueYear>(2027);
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('ALL_BUCKETS');
  const [posFilter, setPosFilter] = useState<PositionGroup | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Bottom Free Agent Dock filters
  const [faPosFilter, setFaPosFilter] = useState<PositionGroup | 'ALL'>('ALL');
  const [faSearchQuery, setFaSearchQuery] = useState('');
  const [faShowCount, setFaShowCount] = useState(14);
  const [deviceLayoutMode, setDeviceLayoutMode] = useState<
    'AUTO' | 'PHONE' | 'DESKTOP'
  >('AUTO');

  const space2026 = derivedState.years[2026].effectiveCapSpace;

  // Map active SIGN_FA transactions by signed player ID (`fa-signed-${fa.id}`) and by `fa.id`
  const activeSignFaTxByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const tx of transactions) {
      if (tx.enabled && tx.type === 'SIGN_FA') {
        map.set(`fa-signed-${tx.freeAgent.id}`, tx.id);
        map.set(tx.freeAgent.id, tx.id);
      }
    }
    return map;
  }, [transactions]);

  // Map active EXTENSION / RESTRUCTURE transactions by playerId for inline badges & 1-click Undo
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
      }
    }
    return map;
  }, [transactions]);

  // 1. Build 6-Year Visual Contract & Extension Timeline Rows (2026–2031)
  const timelineRows = useMemo(() => {
    return derivedState.roster
      .map((player) => buildPlayerContractTimelineRow(player, space2026))
      .sort((a, b) => {
        // Put newly signed Free Agents right at the top when added so the user immediately sees them in the grid!
        const aIsNewFa = a.player.id.startsWith('fa-signed-') ? 1 : 0;
        const bIsNewFa = b.player.id.startsWith('fa-signed-') ? 1 : 0;
        if (aIsNewFa !== bIsNewFa) return bIsNewFa - aIsNewFa;

        return (
          getContractYearCapHit(b.player.contractYears[2026]) -
          getContractYearCapHit(a.player.contractYears[2026])
        );
      });
  }, [derivedState.roster, space2026]);

  const filteredTimelineRows = useMemo(() => {
    return timelineRows.filter((row) => {
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
        return row.player.id.startsWith('fa-signed-');
      }
      return true;
    });
  }, [timelineRows, posFilter, searchQuery, timelineFilter]);

  // 2. Positional Needs by Year (2026–2029) Matrix
  const positionalNeeds = useMemo(
    () => evaluateTeamPositionalNeedsByYear(derivedState),
    [derivedState]
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

  // 3. League-Wide Free Agent & Street Cap Casualty Pool for Bottom Dock
  const faPool = useMemo(() => {
    const rawPool = getLeagueWideFreeAgentPool(baseTeam.id);
    return rawPool.map((fa) => ({
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
  }, [baseTeam.id]);

  const filteredFaPool = useMemo(() => {
    return faPool.filter(({ fa }) => {
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
  }, [faPool, faPosFilter, faSearchQuery]);

  // 2. Build 4-Bucket Future Roster Outlook for `targetYear`
  const outlook = useMemo(
    () => evaluateFutureSeasonRosterOutlook(derivedState, targetYear),
    [derivedState, targetYear]
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
                selectPlayer(player.id, item.recommendedActionTab, targetYear)
              }
              className="flex items-center gap-3 text-left cursor-pointer"
            >
              <PlayerAvatar
                name={player.name}
                headshotUrl={player.headshotUrl}
                size="md"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-editorial text-xl text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4">
                    {player.name}
                  </span>
                  <span className="border border-[#dfd9cc] bg-[#f6f3ec] px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-[#57534e]">
                    {player.position} · Age {item.ageInTargetYear} in{' '}
                    {targetYear} · OVR {player.overallRating}
                  </span>
                  <span className="border border-[#2d5a43]/40 bg-[#2d5a43]/10 px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-[#2d5a43]">
                    ~{career.expectedRemainingStarterYears} starter yr
                    {career.expectedRemainingStarterYears === 1 ? '' : 's'} left
                    (thru ~Age {career.projectedRetirementAge})
                  </span>
                </div>

                <div className="mt-0.5 font-mono-ledger text-xs text-[#57534e]">
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
                      addCutTransaction(player, 'POST_JUNE_1_CUT', targetYear)
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
                  onClick={() =>
                    openFreeAgencyModal({ position: player.position })
                  }
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

  return (
    <div className="mx-auto max-w-[1440px] px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* 1. Journey 02 Header (Default Home Hub) + View Mode Switcher */}
      <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-4 sm:pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#1c1917] px-2 py-0.5 font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f6f3ec]">
                Home Hub · {derivedState.roster.length}-Player Active Roster Grid
              </span>
              <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8379]">
                2026–2031 Contract &amp; Extension Horizon + Positional Needs +
                FA Builder
              </span>
            </div>
            <h1 className="mt-1.5 font-editorial text-[clamp(1.35rem,1rem+1.6vw,2rem)] leading-tight text-[#1c1917]">
              {viewMode === 'TIMELINE_BARS'
                ? `${baseTeam.city} ${baseTeam.name} — Multi-Year Roster & Extension Timeline (${derivedState.roster.length} Players)`
                : `${baseTeam.city} ${baseTeam.name} — ${targetYear} Projected Roster By Status`}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              {viewMode === 'TIMELINE_BARS'
                ? 'Inspect every player’s contract across 2026–2031: solid bars show locked years, amber boxes flag likely cut/restructure years, and dashed green boxes show projected extension windows. Scroll down to see Positional Needs by Year and click to add Free Agents directly into this grid.'
                : `Inspect the ${targetYear} roster grouped into 4 clear buckets: Safe Under Contract, Likely ${targetYear} Cap Cuts, Off-Contract Free Agents, and Void-Year Ghost Bills.`}
            </p>
          </div>

          {/* Primary View Mode Switcher + Phone/Desktop Toggle + Section Jump Links */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Phone vs Desktop Layout Switcher */}
            <div className="inline-flex border border-[#1c1917] bg-[#f6f3ec] p-0.5">
              <button
                type="button"
                onClick={() =>
                  setDeviceLayoutMode((m) => (m === 'PHONE' ? 'AUTO' : 'PHONE'))
                }
                title="Switch to iPhone / Pixel Mobile Card View"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  deviceLayoutMode === 'PHONE'
                    ? 'bg-[#1c1917] text-[#f6f3ec]'
                    : 'text-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Phone View</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeviceLayoutMode((m) =>
                    m === 'DESKTOP' ? 'AUTO' : 'DESKTOP'
                  )
                }
                title="Switch to Full Desktop Spreadsheet Grid"
                className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                  deviceLayoutMode === 'DESKTOP'
                    ? 'bg-[#1c1917] text-[#f6f3ec]'
                    : 'text-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Full Table</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('TIMELINE_BARS')}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'TIMELINE_BARS'
                  ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                  : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>2026–2031 Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('BUCKET_CARDS')}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'BUCKET_CARDS'
                  ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                  : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>By Bucket</span>
            </button>
            <a
              href="#positional-needs-matrix"
              className="inline-flex items-center gap-1 border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-2 text-xs font-semibold text-[#1c1917] hover:border-[#1c1917]"
            >
              <Target className="h-3.5 w-3.5 text-[#b84a27]" />
              <span>Needs ↓</span>
            </a>
            <a
              href="#add-free-agents-dock"
              className="inline-flex items-center gap-1 border border-[#2d5a43] bg-[#2d5a43] px-2.5 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#234735]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Add FAs ↓</span>
            </a>
          </div>
        </div>

        {/* Branch to Other Journeys Bar + Active Scenario Summary */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#dfd9cc] pb-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
              Branch Off To:
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('cap-checkup')}
              className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1 text-[11px] font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
            >
              2026 Cap Checkup &amp; Top Fixes →
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('free-agency')}
              className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1 text-[11px] font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
            >
              Full FA &amp; Cap Casualty Market →
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('draft')}
              className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1 text-[11px] font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
            >
              Draft &amp; Trade Simulator →
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className="border border-[#dfd9cc] bg-[#f6f3ec] px-2.5 py-1 text-[11px] font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
            >
              Full 4-Year Cap Ledger →
            </button>
          </div>

          {transactions.filter((t) => t.enabled).length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-[#2d5a43]/40 bg-[#2d5a43]/10 px-2.5 py-1 font-mono-ledger text-[11px] font-semibold text-[#2d5a43]">
                {transactions.filter((t) => t.enabled).length} Active GM Move
                {transactions.filter((t) => t.enabled).length === 1 ? '' : 's'}{' '}
                Applied to Grid
              </span>
              <button
                type="button"
                onClick={resetScenarioStack}
                className="inline-flex items-center gap-1 border border-[#b84a27]/40 bg-[#b84a27]/10 px-2.5 py-1 text-[11px] font-semibold text-[#b84a27] hover:bg-[#b84a27] hover:text-[#f6f3ec] cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Moves</span>
              </button>
            </div>
          )}
        </div>

        {/* Search & Position Filter Bar (Shared by Both Views) */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Filter ${baseTeam.name} ${derivedState.roster.length}-man roster...`}
                className="w-full border border-[#1c1917] bg-[#f6f3ec] py-1.5 pl-9 pr-3 text-xs text-[#1c1917] placeholder:text-[#8a8379] focus:outline-none"
              />
            </div>

            <GlobalPlayerSearch
              placeholder="Or lookup any NFL player (age, yrs left, deal)..."
              className="w-64 sm:w-72"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
              Position:
            </span>
            {ALL_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosFilter(pos)}
                className={`px-2 py-0.5 font-mono-ledger text-[11px] transition-colors cursor-pointer ${
                  posFilter === pos
                    ? 'bg-[#1c1917] font-semibold text-[#f6f3ec]'
                    : 'text-[#57534e] hover:bg-[#ede8dd] hover:text-[#1c1917]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          VIEW MODE 1: VISUAL CONTRACT & EXTENSION BAR TIMELINE (2026–2031)
         ===================================================================== */}
      {viewMode === 'TIMELINE_BARS' && (
        <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-5 space-y-5">
          {/* Visual Legend + Quick Filter Pills */}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between border-b border-[#dfd9cc] pb-4">
            {/* 4-Box Visual Key */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                Bar Legend:
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-6 bg-[#1c1917] border border-[#1c1917]" />
                <span className="text-[#1c1917] font-medium">
                  Locked Contract Year
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-6 bg-[#b57c1e]/25 border-2 border-[#b57c1e]" />
                <span className="text-[#1c1917] font-medium">
                  Cut-Risk / Fake Back-End Year
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-6 bg-[#2d5a43]/20 border-2 border-dashed border-[#2d5a43]" />
                <span className="text-[#2d5a43] font-semibold">
                  Projected Extension Window (% Likelihood)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-6 bg-[#b84a27]/15 border border-dashed border-[#b84a27]" />
                <span className="text-[#b84a27] font-medium">
                  Void Ghost Bill / Age Cliff
                </span>
              </div>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'ALL', label: `All Roster (${timelineRows.length})` },
                  {
                    id: 'HIGH_EXT_LIKELY',
                    label: 'High Extension Likelihood (70%+)',
                  },
                  {
                    id: 'CUT_RISK_YEARS',
                    label: 'Has Cut-Risk / Paper Years',
                  },
                  { id: 'EXPIRING_2026', label: 'Expiring After 2026' },
                  { id: 'VOID_BILLS', label: 'Void-Year Ghost Bills' },
                  ...(activeSignFaTxByPlayerId.size > 0
                    ? [
                        {
                          id: 'ADDED_FA' as TimelineQuickFilter,
                          label: `Newly Added FAs (${activeSignFaTxByPlayerId.size / 2})`,
                        },
                      ]
                    : []),
                ] as { id: TimelineQuickFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setTimelineFilter(pill.id)}
                  className={`border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    timelineFilter === pill.id
                      ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                      : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917]'
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
            className={`${desktopBlockClass} overflow-x-auto [container-type:inline-size]`}
          >
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
                  <th className="sticky left-0 z-10 bg-[#fcfaf6] py-3 pr-4 w-[290px]">
                    Player ({filteredTimelineRows.length}) · Ext. Likelihood
                    &amp; Quick Actions
                  </th>
                  {TIMELINE_HORIZON_YEARS.map((yr) => {
                    const yCap =
                      yr <= 2029
                        ? derivedState.years[yr as LeagueYear]
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
                {filteredTimelineRows.map((row) => {
                  const {
                    player,
                    forecast,
                    career,
                    extensionLikelihoodPct,
                    extensionLikelihoodTier,
                    cells,
                  } = row;

                  const isNewlySignedFa = player.id.startsWith('fa-signed-');
                  const faTxId = activeSignFaTxByPlayerId.get(player.id);
                  const activePlayerTx = activePlayerTxMap.get(player.id);

                  const extBadgeColor =
                    extensionLikelihoodTier === 'HIGH'
                      ? 'text-[#2d5a43] bg-[#2d5a43]/15 border-[#2d5a43]/40'
                      : extensionLikelihoodTier === 'MEDIUM'
                      ? 'text-[#b57c1e] bg-[#b57c1e]/15 border-[#b57c1e]/40'
                      : 'text-[#8a8379] bg-[#ede8dd] border-[#c7bfb0]';

                  return (
                    <tr
                      key={player.id}
                      className={`group transition-colors ${
                        isNewlySignedFa
                          ? 'bg-[#2d5a43]/10 hover:bg-[#2d5a43]/15'
                          : 'hover:bg-[#f6f3ec]'
                      }`}
                    >
                      {/* Left Sticky Player Identity + Extension Probability Column */}
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 py-3 pr-4 align-middle font-normal border-r border-[#dfd9cc] ${
                          isNewlySignedFa
                            ? 'bg-[#eef5f0] group-hover:bg-[#e5f0e8] border-l-4 border-l-[#2d5a43] pl-2.5'
                            : 'bg-[#fcfaf6] group-hover:bg-[#f6f3ec]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <PlayerAvatar
                            name={player.name}
                            headshotUrl={player.headshotUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  selectPlayer(
                                    player.id,
                                    forecast.recommendedActionTab,
                                    2026
                                  )
                                }
                                className="truncate font-semibold text-xs text-[#1c1917] hover:underline text-left cursor-pointer"
                              >
                                {player.name}
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                {isNewlySignedFa && faTxId ? (
                                  <button
                                    type="button"
                                    onClick={() => removeTransaction(faTxId)}
                                    title="Remove newly signed Free Agent from roster grid"
                                    className="inline-flex items-center gap-0.5 border border-[#b84a27] bg-[#b84a27] px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold text-[#f6f3ec] hover:bg-[#9a3c1e] cursor-pointer"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                    <span>Remove FA</span>
                                  </button>
                                ) : activePlayerTx ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeTransaction(activePlayerTx.txId)
                                    }
                                    title="Undo move on this player"
                                    className="inline-flex items-center gap-0.5 border border-[#2d5a43] bg-[#2d5a43] px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold text-[#f6f3ec] cursor-pointer"
                                  >
                                    <span>Undo {activePlayerTx.type}</span>
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPlayerDossier(player, baseTeam.id)
                                  }
                                  className="border border-[#dfd9cc] bg-[#f6f3ec] px-1.5 py-0.5 font-mono-ledger text-[9px] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917] cursor-pointer"
                                >
                                  Dossier
                                </button>
                              </div>
                            </div>

                            <div className="mt-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                              {player.position} · Age {player.ageIn2026} · OVR{' '}
                              {player.overallRating} · ~
                              {career.expectedRemainingStarterYears} starter yr
                              {career.expectedRemainingStarterYears === 1
                                ? ''
                                : 's'}{' '}
                              left
                            </div>

                            {/* Extension Likelihood Pill + 1-Click Quick Action */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {isNewlySignedFa ? (
                                <span className="inline-block border border-[#2d5a43] bg-[#2d5a43] px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold text-[#f6f3ec]">
                                  ★ NEW FA SIGNING
                                </span>
                              ) : activePlayerTx ? (
                                <span className="inline-block border border-[#2d5a43] bg-[#2d5a43]/15 px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold text-[#2d5a43]">
                                  ✓ {activePlayerTx.label}
                                </span>
                              ) : (
                                <>
                                  <span
                                    className={`inline-block border px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold ${extBadgeColor}`}
                                  >
                                    {extensionLikelihoodPct}% Ext. Likelihood
                                  </span>
                                  {extensionLikelihoodPct >= 55 &&
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
                                        className="border border-[#2d5a43]/50 bg-[#2d5a43]/10 px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold text-[#2d5a43] hover:bg-[#2d5a43] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                                      >
                                        + 1-Click Extend (~$
                                        {forecast.projectedMarketApy.toFixed(1)}
                                        M/yr)
                                      </button>
                                    )}
                                </>
                              )}
                            </div>
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
                              className="py-2.5 px-0 align-middle border-l border-[#dfd9cc]/60"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  selectPlayer(
                                    player.id,
                                    'restructure',
                                    targetActionYear
                                  )
                                }
                                title={`${player.name} (${cell.year}): Locked Contract ($${cell.capHit?.toFixed(2)}M cap hit). Click to open 4-Door options.`}
                                className={`w-[calc(100%-4px)] h-12 bg-[#1c1917] text-[#f6f3ec] px-2.5 py-1.5 flex flex-col justify-between text-left hover:bg-[#332e2a] transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-xs font-bold">
                                    {cell.primaryLabel}
                                  </span>
                                  <span className="text-[9px] text-[#f6f3ec]/70">
                                    Age {cell.age}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between w-full font-mono-ledger text-[9px] text-[#f6f3ec]/80 truncate">
                                  <span>{cell.secondaryLabel}</span>
                                  {player.isRookieContract && (
                                    <span className="text-[#7ce0a8]">
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
                              className="py-2.5 px-0 align-middle border-l border-[#dfd9cc]/60"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  selectPlayer(
                                    player.id,
                                    'cut',
                                    targetActionYear
                                  )
                                }
                                title={`${player.name} (${cell.year}): Unguaranteed back-end year. Cutting saves +$${cell.cutSavings?.toFixed(1)}M ($${cell.deadCap?.toFixed(1)}M dead). Click to inspect.`}
                                className={`w-[calc(100%-4px)] h-12 bg-[#b57c1e]/20 border-y-2 border-[#b57c1e] ${
                                  cell.isStartOfSpan ? 'border-l-2' : ''
                                } ${
                                  cell.isEndOfSpan ? 'border-r-2' : ''
                                } text-[#1c1917] px-2.5 py-1.5 flex flex-col justify-between text-left hover:bg-[#b57c1e]/30 transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-xs font-bold text-[#1c1917]">
                                    {cell.primaryLabel}
                                  </span>
                                  <span className="text-[9px] text-[#57534e]">
                                    Age {cell.age}
                                  </span>
                                </div>
                                <div className="font-mono-ledger text-[10px] font-semibold text-[#b84a27] truncate">
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
                              className="py-2.5 px-0 align-middle border-l border-[#dfd9cc]/60"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  selectPlayer(
                                    player.id,
                                    'extend',
                                    row.lastActiveContractYear
                                  )
                                }
                                title={`Click to model an extension for ${player.name} (${extensionLikelihoodPct}% Extension Likelihood at ~$${forecast.projectedMarketApy.toFixed(1)}M/yr)`}
                                className={`w-[calc(100%-4px)] h-12 bg-[#2d5a43]/15 border-y-2 border-dashed border-[#2d5a43] ${
                                  cell.isStartOfSpan ? 'border-l-2' : ''
                                } ${
                                  cell.isEndOfSpan ? 'border-r-2' : ''
                                } text-[#2d5a43] px-2.5 py-1.5 flex flex-col justify-between text-left hover:bg-[#2d5a43]/25 transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-[11px] font-bold">
                                    {cell.isStartOfSpan
                                      ? `${extensionLikelihoodPct}% Ext. Box`
                                      : `Ext. Yr (Age ${cell.age})`}
                                  </span>
                                  {cell.isStartOfSpan && (
                                    <span className="text-[9px] text-[#2d5a43]/80">
                                      Age {cell.age}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono-ledger text-[10px] font-medium text-[#1c1917] truncate">
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
                              className="py-2.5 px-0 align-middle border-l border-[#dfd9cc]/60"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  selectPlayer(
                                    player.id,
                                    'extend',
                                    row.lastActiveContractYear
                                  )
                                }
                                className={`w-[calc(100%-4px)] h-12 bg-[#b84a27]/12 border border-dashed border-[#b84a27] px-2.5 py-1.5 flex flex-col justify-between text-left hover:bg-[#b84a27]/20 transition-colors cursor-pointer ${roundedClass}`}
                              >
                                <div className="flex items-baseline justify-between w-full font-mono-ledger">
                                  <span className="text-[11px] font-semibold text-[#b84a27]">
                                    {cell.primaryLabel}
                                  </span>
                                  <span className="text-[9px] text-[#57534e]">
                                    Age {cell.age}
                                  </span>
                                </div>
                                <div className="font-mono-ledger text-[9px] text-[#57534e] truncate">
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
                            className="py-2.5 px-1 align-middle border-l border-[#dfd9cc]/60"
                          >
                            <div className="h-12 border border-dotted border-[#dfd9cc] bg-[#f6f3ec]/60 px-2 py-1.5 flex flex-col justify-between text-left opacity-70">
                              <div className="flex items-baseline justify-between font-mono-ledger text-[10px] text-[#8a8379]">
                                <span>{cell.primaryLabel}</span>
                              </div>
                              <div className="font-mono-ledger text-[9px] text-[#8a8379]">
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
            {filteredTimelineRows.map((row) => {
              const {
                player,
                forecast,
                career,
                extensionLikelihoodPct,
                extensionLikelihoodTier,
                cells,
              } = row;

              const isNewlySignedFa = player.id.startsWith('fa-signed-');
              const faTxId = activeSignFaTxByPlayerId.get(player.id);
              const activePlayerTx = activePlayerTxMap.get(player.id);

              const extBadgeColor =
                extensionLikelihoodTier === 'HIGH'
                  ? 'text-[#2d5a43] bg-[#2d5a43]/15 border-[#2d5a43]/40'
                  : extensionLikelihoodTier === 'MEDIUM'
                  ? 'text-[#b57c1e] bg-[#b57c1e]/15 border-[#b57c1e]/40'
                  : 'text-[#8a8379] bg-[#ede8dd] border-[#c7bfb0]';

              return (
                <div
                  key={`mob-${player.id}`}
                  className={`border p-3.5 space-y-3 transition-colors ${
                    isNewlySignedFa
                      ? 'border-2 border-[#2d5a43] bg-[#eef5f0]'
                      : 'border-[#dfd9cc] bg-[#f6f3ec]'
                  }`}
                >
                  {/* Card Row 1: Identity + Extension Probability Pill + Dossier */}
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        selectPlayer(
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
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-editorial text-base text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-2">
                            {player.name}
                          </span>
                          <span className="shrink-0 border border-[#dfd9cc] bg-[#fcfaf6] px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#1c1917]">
                            {player.position} · Age {player.ageIn2026} · OVR{' '}
                            {player.overallRating}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                          ~{career.expectedRemainingStarterYears} starter yr
                          {career.expectedRemainingStarterYears === 1
                            ? ''
                            : 's'}{' '}
                          left (thru ~Age {career.projectedRetirementAge}) ·
                          Est. ${forecast.projectedMarketApy.toFixed(1)}M/yr
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isNewlySignedFa ? (
                        <span className="border border-[#2d5a43] bg-[#2d5a43] px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#f6f3ec]">
                          ★ NEW FA
                        </span>
                      ) : activePlayerTx ? (
                        <span className="border border-[#2d5a43] bg-[#2d5a43]/15 px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#2d5a43]">
                          ✓ {activePlayerTx.type}
                        </span>
                      ) : (
                        <span
                          className={`border px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold ${extBadgeColor}`}
                        >
                          {extensionLikelihoodPct}% Ext.
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openPlayerDossier(player, baseTeam.id)}
                        className="border border-[#dfd9cc] bg-[#fcfaf6] px-1.5 py-0.5 font-mono-ledger text-[9px] text-[#57534e]"
                      >
                        Dossier
                      </button>
                    </div>
                  </div>

                  {/* Card Row 2: Full-Width 6-Year Mini Visual Bar (2026–2031) — Fits 100% on Phone! */}
                  <div className="grid grid-cols-6 gap-1">
                    {cells.map((cell) => {
                      const targetActionYear: LeagueYear =
                        cell.year <= 2029 ? (cell.year as LeagueYear) : 2029;
                      const shortYr = `'${String(cell.year).slice(2)}`;

                      let boxStyle =
                        'border border-dotted border-[#dfd9cc] bg-[#fcfaf6]/70 text-[#8a8379]';
                      let statusShort = 'UFA';

                      if (cell.segmentType === 'LOCKED_CONTRACT') {
                        boxStyle =
                          'bg-[#1c1917] text-[#f6f3ec] border border-[#1c1917]';
                        statusShort = `$${(cell.capHit ?? 0).toFixed(1)}M`;
                      } else if (cell.segmentType === 'PAPER_CUT_RISK') {
                        boxStyle =
                          'bg-[#b57c1e]/20 text-[#1c1917] border-2 border-[#b57c1e]';
                        statusShort = `✂$${(cell.capHit ?? 0).toFixed(0)}M`;
                      } else if (cell.segmentType === 'EXTENSION_WINDOW') {
                        boxStyle =
                          'bg-[#2d5a43]/15 text-[#2d5a43] border-2 border-dashed border-[#2d5a43]';
                        statusShort = cell.isStartOfSpan
                          ? `${extensionLikelihoodPct}% Ext`
                          : `~$${forecast.projectedMarketApy.toFixed(0)}M`;
                      } else if (cell.segmentType === 'VOID_GHOST_BILL') {
                        boxStyle =
                          'bg-[#b84a27]/15 text-[#b84a27] border border-dashed border-[#b84a27]';
                        statusShort = `Void`;
                      } else if (cell.isAtOrPastCliff) {
                        statusShort = `Cliff`;
                      }

                      return (
                        <button
                          key={cell.year}
                          type="button"
                          onClick={() =>
                            selectPlayer(
                              player.id,
                              cell.segmentType === 'PAPER_CUT_RISK'
                                ? 'cut'
                                : cell.segmentType === 'EXTENSION_WINDOW'
                                ? 'extend'
                                : 'restructure',
                              targetActionYear
                            )
                          }
                          className={`flex flex-col items-center justify-between py-1.5 px-1 text-center font-mono-ledger transition-opacity active:opacity-80 cursor-pointer ${boxStyle}`}
                        >
                          <span className="text-[9px] opacity-75">
                            {shortYr} · {cell.age}y
                          </span>
                          <span className="mt-0.5 text-[10px] font-bold leading-tight truncate max-w-full">
                            {statusShort}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Card Row 3: Thumb-Friendly 1-Tap Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#dfd9cc]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isNewlySignedFa && faTxId ? (
                        <button
                          type="button"
                          onClick={() => removeTransaction(faTxId)}
                          className="inline-flex items-center gap-1 border border-[#b84a27] bg-[#b84a27] px-2.5 py-1 font-mono-ledger text-[10px] font-semibold text-[#f6f3ec]"
                        >
                          <X className="h-3 w-3" />
                          <span>Remove Added FA</span>
                        </button>
                      ) : activePlayerTx ? (
                        <button
                          type="button"
                          onClick={() => removeTransaction(activePlayerTx.txId)}
                          className="inline-flex items-center gap-1 border border-[#2d5a43] bg-[#2d5a43] px-2.5 py-1 font-mono-ledger text-[10px] font-semibold text-[#f6f3ec]"
                        >
                          <span>Undo {activePlayerTx.label}</span>
                        </button>
                      ) : (
                        <>
                          {extensionLikelihoodPct >= 55 &&
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
                                className="border border-[#2d5a43] bg-[#2d5a43]/15 px-2.5 py-1 font-mono-ledger text-[10px] font-bold text-[#2d5a43]"
                              >
                                + Extend (~$
                                {forecast.projectedMarketApy.toFixed(1)}M/yr)
                              </button>
                            )}
                          {forecast.bestCutSavings2026 >= 2.5 && (
                            <button
                              type="button"
                              onClick={() =>
                                addCutTransaction(
                                  player,
                                  'PRE_JUNE_1_CUT',
                                  2026
                                )
                              }
                              className="border border-[#b84a27] bg-[#b84a27]/10 px-2.5 py-1 font-mono-ledger text-[10px] font-bold text-[#b84a27]"
                            >
                              ✂ Cut (+$
                              {forecast.bestCutSavings2026.toFixed(1)}M)
                            </button>
                          )}
                          {forecast.maxRestructureSavings2026 >= 2.5 && (
                            <button
                              type="button"
                              onClick={() =>
                                addRestructureTransaction(player, 1.0, 2, 2026)
                              }
                              className="border border-[#1c1917] bg-[#fcfaf6] px-2 py-1 font-mono-ledger text-[10px] font-semibold text-[#1c1917]"
                            >
                              Restructure (+$
                              {forecast.maxRestructureSavings2026.toFixed(1)}M)
                            </button>
                          )}
                        </>
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
                      className="inline-flex items-center gap-1 font-mono-ledger text-[10px] font-semibold text-[#1c1917] underline"
                    >
                      <span>4-Door Options →</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          VIEW MODE 2: 4-BUCKET FUTURE ROSTER OUTLOOK BY YEAR (2026–2029)
         ===================================================================== */}
      {viewMode === 'BUCKET_CARDS' && (
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
                  const ySpace = derivedState.years[yr].effectiveCapSpace;
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
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#b84a27] pb-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b84a27]">
                    Bucket 02 · {targetYear} Cap Casualty &amp; Paper-Year
                    Watchlist
                  </span>
                  <h2 className="font-editorial text-2xl text-[#1c1917]">
                    Likely {targetYear} Cap Cuts / Restructure-or-Release
                    Decisions ({filteredCuts.length})
                  </h2>
                  <p className="text-xs text-[#57534e]">
                    These players are technically under contract in {targetYear}
                    , but have unguaranteed back-end salaries where cutting them
                    saves major cap space (+$
                    {outlook.totals.likelyCutsPotentialSavings.toFixed(1)}M
                    total).
                  </p>
                </div>

                {filteredCuts.length > 0 && (
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
                )}
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
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#b57c1e] pb-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b57c1e]">
                    Bucket 03 · Off-Contract / Expiring Free Agents in{' '}
                    {targetYear}
                  </span>
                  <h2 className="font-editorial text-2xl text-[#1c1917]">
                    Players Off Contract by {targetYear} (
                    {filteredOffContract.length})
                  </h2>
                  <p className="text-xs text-[#57534e]">
                    Players from the current roster whose contracts expire
                    before or entering the {targetYear} season. Click{' '}
                    <strong>Re-Sign / Extend</strong> to lock them into your{' '}
                    {targetYear} books.
                  </p>
                </div>
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
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#2d5a43] pb-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2d5a43]">
                    Bucket 01 · Protected Core &amp; Rookie-Scale Locks
                  </span>
                  <h2 className="font-editorial text-2xl text-[#1c1917]">
                    Safe Under Contract in {targetYear} ({filteredSafe.length})
                  </h2>
                  <p className="text-xs text-[#57534e]">
                    Core starters, cost-controlled rookies, and guaranteed deals
                    projected to remain on the {baseTeam.name} roster in{' '}
                    {targetYear} ($
                    {outlook.totals.safeContractCapTotal.toFixed(1)}M combined
                    cap hit).
                  </p>
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
                <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#1c1917] pb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534e]">
                      Bucket 04 · Deferred Bonus &ldquo;Ghost Bills&rdquo;
                    </span>
                    <h2 className="font-editorial text-2xl text-[#1c1917]">
                      {targetYear} Void-Year Ghost Bills ({filteredVoid.length})
                    </h2>
                    <p className="text-xs text-[#57534e]">
                      These players&apos; active contracts have ended, leaving
                      dummy Void Years where past signing bonus restructures
                      stay on your {targetYear} cap.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredVoid.map(renderEvaluationCard)}
                </div>
              </section>
            )}
        </>
      )}

      {/* =====================================================================
          SECTION A (BELOW PLAYERS): POSITIONAL NEEDS BY YEAR MATRIX (2026–2029)
         ===================================================================== */}
      <section
        id="positional-needs-matrix"
        className="scroll-mt-24 border border-[#dfd9cc] bg-[#fcfaf6] p-6 space-y-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-[#dfd9cc] pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b84a27]">
              <Target className="h-3.5 w-3.5" />
              <span>Multi-Year Roster Hole Radar (2026–2029)</span>
            </div>
            <h2 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
              {baseTeam.city} {baseTeam.name} — Positional Needs by Year
              (2026–2029)
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              Compares your active under-contract starters and total depth in
              each season against standard 53-man NFL positional targets. Click
              any position row or cell to filter the{' '}
              <strong>Potential Free Agents to Add</strong> section below and
              fill the hole directly into your grid!
            </p>
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
                      isSelectedPos ? 'bg-[#ede8dd]' : 'hover:bg-[#f6f3ec]'
                    }`}
                  >
                    <th scope="row" className="py-3 pr-4 align-middle">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-mono-ledger text-xs font-bold text-[#1c1917]">
                            {row.label}
                          </div>
                          <div className="font-mono-ledger text-[10px] font-normal text-[#8a8379]">
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
                          ? 'bg-[#b84a27]/14 border-[#b84a27] text-[#b84a27]'
                          : cell.urgency === 'DEPTH_NEED'
                          ? 'bg-[#b57c1e]/15 border-[#b57c1e] text-[#9a6512]'
                          : 'bg-[#2d5a43]/12 border-[#2d5a43]/50 text-[#2d5a43]';

                      return (
                        <td
                          key={yr}
                          className="py-2 px-2 align-top border-l border-[#dfd9cc]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setFaPosFilter(row.position);
                              const el = document.getElementById(
                                'add-free-agents-dock'
                              );
                              if (el)
                                el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`w-full border p-2 text-left transition-all hover:border-[#1c1917] cursor-pointer ${cellStyle}`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono-ledger">
                              <span className="text-[11px] font-bold uppercase tracking-[0.04em]">
                                {cell.badgeLabel}
                              </span>
                              <span className="text-[10px] font-semibold text-[#1c1917]">
                                {cell.startersUnderContract}/
                                {cell.targetStarters} St
                              </span>
                            </div>
                            <div className="mt-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                              {cell.subLabel}
                            </div>
                            {cell.topPlayers.length > 0 ? (
                              <div className="mt-1 truncate font-mono-ledger text-[9px] text-[#44403c]">
                                {cell.topPlayers.slice(0, 2).join(', ')}
                              </div>
                            ) : (
                              <div className="mt-1 font-mono-ledger text-[9px] font-semibold text-[#b84a27]">
                                0 Players Signed!
                              </div>
                            )}
                            {cell.expiringAfterPrevYear.length > 0 && (
                              <div className="mt-0.5 truncate font-mono-ledger text-[9px] text-[#b84a27]">
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
                      <button
                        type="button"
                        onClick={() => {
                          setFaPosFilter(
                            faPosFilter === row.position ? 'ALL' : row.position
                          );
                          const el = document.getElementById(
                            'add-free-agents-dock'
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
                  <button
                    type="button"
                    onClick={() => {
                      setFaPosFilter(
                        faPosFilter === row.position ? 'ALL' : row.position
                      );
                      const el = document.getElementById(
                        'add-free-agents-dock'
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
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {LEAGUE_YEARS.map((yr) => {
                    const cell = row.cellsByYear[yr];
                    const cellStyle =
                      cell.urgency === 'CRITICAL_NEED'
                        ? 'bg-[#b84a27]/15 border-[#b84a27] text-[#b84a27]'
                        : cell.urgency === 'DEPTH_NEED'
                        ? 'bg-[#b57c1e]/15 border-[#b57c1e] text-[#9a6512]'
                        : 'bg-[#2d5a43]/15 border-[#2d5a43]/50 text-[#2d5a43]';
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setFaPosFilter(row.position);
                          const el = document.getElementById(
                            'add-free-agents-dock'
                          );
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`flex flex-col items-center justify-between border py-1.5 px-1 text-center font-mono-ledger ${cellStyle}`}
                      >
                        <span className="text-[9px] font-bold text-[#1c1917]">
                          {yr} ({cell.startersUnderContract}/
                          {cell.targetStarters} St)
                        </span>
                        <span className="mt-0.5 text-[9px] font-bold uppercase leading-tight truncate max-w-full">
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
          SECTION B (BOTTOM DOCK): CLICK TO ADD POTENTIAL FREE AGENTS TO YOUR GRID
         ===================================================================== */}
      <section
        id="add-free-agents-dock"
        className="scroll-mt-24 border-2 border-[#1c1917] bg-[#fcfaf6] p-6 space-y-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-[#dfd9cc] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#2d5a43] px-2 py-0.5 font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f6f3ec]">
                Interactive Roster Builder Dock
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                Click Any Free Agent to Add Directly Into Your Roster Grid Above
              </span>
            </div>
            <h2 className="mt-1.5 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
              Potential Free Agents &amp; Street Cap Casualties — Click to Add
              to Grid
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              Click <strong>+ Add to Roster Grid</strong> on any target below to
              sign them at their projected market contract. They immediately
              appear at the top of your{' '}
              <strong>Player × Year Contract &amp; Extension Grid</strong> above
              and update your <strong>Positional Needs Matrix</strong> and{' '}
              <strong>2026–2029 Cap Space</strong> live!
            </p>
          </div>

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

        {/* Search + Critical Need Position Quick Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={faSearchQuery}
                onChange={(e) => setFaSearchQuery(e.target.value)}
                placeholder="Search free agents by name or team..."
                className="w-full border border-[#1c1917] bg-[#f6f3ec] py-1.5 pl-8 pr-3 text-xs text-[#1c1917] placeholder:text-[#8a8379] focus:outline-none"
              />
            </div>

            {criticalPositions2026Or2027.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b84a27]">
                  Your Starter Needs:
                </span>
                {criticalPositions2026Or2027.map((needPos) => (
                  <button
                    key={needPos}
                    type="button"
                    onClick={() =>
                      setFaPosFilter(faPosFilter === needPos ? 'ALL' : needPos)
                    }
                    className={`border px-2 py-0.5 font-mono-ledger text-[10px] font-semibold transition-colors cursor-pointer ${
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

          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
              Filter FA Position:
            </span>
            {ALL_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setFaPosFilter(pos)}
                className={`px-2 py-0.5 font-mono-ledger text-[11px] transition-colors cursor-pointer ${
                  faPosFilter === pos
                    ? 'bg-[#1c1917] font-semibold text-[#f6f3ec]'
                    : 'text-[#57534e] hover:bg-[#ede8dd] hover:text-[#1c1917]'
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
                          headshotUrl={fa.headshotUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-xs text-[#1c1917]">
                              {fa.name}
                            </span>
                            <span className="border border-[#dfd9cc] bg-[#f6f3ec] px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold text-[#1c1917]">
                              {fa.position} · Age {fa.ageIn2026} · OVR{' '}
                              {fa.overallRating}
                            </span>
                            {isNeedPos && (
                              <span className="border border-[#b84a27] bg-[#b84a27]/10 px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#b84a27]">
                                Fills {fa.position} Need
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono-ledger text-[10px]">
                            <span className="text-[#57534e]">
                              From {fa.previousTeam}
                            </span>
                            <span>·</span>
                            <span
                              className={
                                evalResult.countsTowardCompFormula
                                  ? 'text-[#b57c1e] font-semibold'
                                  : 'text-[#2d5a43] font-semibold'
                              }
                            >
                              {evalResult.countsTowardCompFormula
                                ? 'UFA (Counts vs Comp Pick)'
                                : '★ Street FA (Comp-Pick Safe!)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </th>

                    <td className="py-2.5 px-3 align-middle border-l border-[#dfd9cc] font-mono-ledger">
                      <div className="text-xs font-bold text-[#1c1917]">
                        {fa.marketYears} yrs · $
                        {(fa.marketYears * fa.marketApy).toFixed(1)}M
                      </div>
                      <div className="text-[10px] text-[#57534e]">
                        ${fa.marketApy.toFixed(1)}M/yr ·{' '}
                        {Math.round(fa.marketGuaranteedPct * 100)}% Gtd
                      </div>
                      <div className="mt-0.5 text-[9px] text-[#2d5a43] font-semibold">
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
                            className="py-2 px-1.5 align-middle border-l border-[#dfd9cc] text-center"
                          >
                            <div className="h-10 border border-dotted border-[#dfd9cc] bg-[#f6f3ec]/50 flex items-center justify-center font-mono-ledger text-[9px] text-[#8a8379]">
                              Off Deal
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={yr}
                          className="py-2 px-1 align-middle border-l border-[#dfd9cc]"
                        >
                          <div
                            className={`h-10 px-2 py-1 flex flex-col justify-between font-mono-ledger ${
                              isAdded
                                ? 'bg-[#2d5a43] text-[#f6f3ec]'
                                : 'bg-[#1c1917]/90 text-[#f6f3ec]'
                            }`}
                          >
                            <span className="text-[11px] font-bold">
                              ${hit.toFixed(1)}M
                            </span>
                            <span className="text-[9px] text-[#f6f3ec]/75">
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
                        <div className="flex items-center justify-end gap-1.5">
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
                            className="inline-flex items-center justify-center gap-1 bg-[#1c1917] px-3 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#2d5a43] transition-colors cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add to Roster Grid</span>
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
                      headshotUrl={fa.headshotUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm text-[#1c1917]">
                          {fa.name}
                        </span>
                        <span className="border border-[#dfd9cc] bg-[#fcfaf6] px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#1c1917]">
                          {fa.position} · Age {fa.ageIn2026} · OVR{' '}
                          {fa.overallRating}
                        </span>
                        {isNeedPos && (
                          <span className="border border-[#b84a27] bg-[#b84a27]/10 px-1.5 py-0.5 font-mono-ledger text-[9px] font-bold text-[#b84a27]">
                            Fills {fa.position} Need
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                        From {fa.previousTeam} ·{' '}
                        <span
                          className={
                            evalResult.countsTowardCompFormula
                              ? 'text-[#b57c1e] font-semibold'
                              : 'text-[#2d5a43] font-semibold'
                          }
                        >
                          {evalResult.countsTowardCompFormula
                            ? 'UFA (Costs Comp Pick)'
                            : '★ Street FA (Comp-Pick Safe!)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono-ledger shrink-0">
                    <div className="text-xs font-bold text-[#1c1917]">
                      {fa.marketYears}yr · $
                      {(fa.marketYears * fa.marketApy).toFixed(1)}M
                    </div>
                    <div className="text-[10px] text-[#2d5a43] font-semibold">
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
                          className="border border-dotted border-[#dfd9cc] bg-[#fcfaf6]/60 py-1 px-1 text-center font-mono-ledger text-[9px] text-[#8a8379]"
                        >
                          <div>{yr}</div>
                          <div>Off Deal</div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={yr}
                        className={`py-1 px-1.5 text-center font-mono-ledger ${
                          isAdded
                            ? 'bg-[#2d5a43] text-[#f6f3ec]'
                            : 'bg-[#1c1917] text-[#f6f3ec]'
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
                    <>
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1c1917] py-2 px-3 text-xs font-semibold text-[#f6f3ec] active:bg-[#2d5a43]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Add to Roster Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openFreeAgencyModal({ freeAgentId: fa.id })
                        }
                        className="border border-[#1c1917] bg-[#fcfaf6] py-2 px-3 font-mono-ledger text-xs font-semibold text-[#1c1917]"
                      >
                        Customize
                      </button>
                    </>
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
    </div>
  );
}
