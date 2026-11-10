'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  Ghost,
  LayoutGrid,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  UserMinus,
} from 'lucide-react';
import {
  buildPlayerContractTimelineRow,
  computeRealContractXRay,
  evaluateFutureSeasonRosterOutlook,
  FutureRosterBucket,
  FutureSeasonPlayerEvaluation,
  getContractYearCapHit,
  LEAGUE_YEARS,
  LeagueYear,
  PlayerContractTimelineRow,
  POSITION_GROUPS,
  PositionGroup,
  projectPlayerCareerHorizon,
  TIMELINE_HORIZON_YEARS,
} from '@/engine';
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
  | 'VOID_BILLS';

const ALL_POSITIONS: (PositionGroup | 'ALL')[] = ['ALL', ...POSITION_GROUPS];

export function PlayerFateJourney() {
  const {
    baseTeam,
    derivedState,
    selectPlayer,
    addCutTransaction,
    addRestructureTransaction,
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

  const space2026 = derivedState.years[2026].effectiveCapSpace;

  // 1. Build 6-Year Visual Contract & Extension Timeline Rows (2026–2031)
  const timelineRows = useMemo(() => {
    return derivedState.roster
      .map((player) => buildPlayerContractTimelineRow(player, space2026))
      .sort(
        (a, b) =>
          getContractYearCapHit(b.player.contractYears[2026]) -
          getContractYearCapHit(a.player.contractYears[2026])
      );
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
      return true;
    });
  }, [timelineRows, posFilter, searchQuery, timelineFilter]);

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

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8 space-y-8">
      {/* 1. Journey 02 Header + View Mode Switcher (Visual Contract & Extension Bar Timeline vs. 4-Bucket Season Cards) */}
      <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8379]">
              Journey 02 · Multi-Year Contract &amp; Extension Horizon
              (2026–2031)
            </span>
            <h1 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
              {viewMode === 'TIMELINE_BARS'
                ? `${baseTeam.city} ${baseTeam.name} — Contract & Extension Likelihood Timeline`
                : `${baseTeam.city} ${baseTeam.name} — ${targetYear} Projected Roster By Status`}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              {viewMode === 'TIMELINE_BARS'
                ? 'Each row maps a player’s contract across 2026–2031: solid bars show locked contract years, amber shaded boxes flag likely cut/restructure years, and dashed green boxes show their projected extension window and likelihood %.'
                : `Inspect the ${targetYear} roster grouped into 4 clear buckets: Safe Under Contract, Likely ${targetYear} Cap Cuts, Off-Contract Free Agents, and Void-Year Ghost Bills.`}
            </p>
          </div>

          {/* Primary View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('TIMELINE_BARS')}
              className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'TIMELINE_BARS'
                  ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                  : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Visual Contract &amp; Extension Bars (2026–2031)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('BUCKET_CARDS')}
              className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'BUCKET_CARDS'
                  ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                  : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Future Roster By Year &amp; Bucket (2026–2029)</span>
            </button>
          </div>
        </div>

        {/* Search & Position Filter Bar (Shared by Both Views) */}
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Filter ${baseTeam.name} roster...`}
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

          {/* Horizontal Multi-Year Contract & Extension Bar Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
                  <th className="sticky left-0 z-10 bg-[#fcfaf6] py-3 pr-4 w-[280px]">
                    Player · Extension Likelihood &amp; Career Left
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

                  const extBadgeColor =
                    extensionLikelihoodTier === 'HIGH'
                      ? 'text-[#2d5a43] bg-[#2d5a43]/15 border-[#2d5a43]/40'
                      : extensionLikelihoodTier === 'MEDIUM'
                      ? 'text-[#b57c1e] bg-[#b57c1e]/15 border-[#b57c1e]/40'
                      : 'text-[#8a8379] bg-[#ede8dd] border-[#c7bfb0]';

                  return (
                    <tr
                      key={player.id}
                      className="group hover:bg-[#f6f3ec] transition-colors"
                    >
                      {/* Left Sticky Player Identity + Extension Probability Column */}
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-[#fcfaf6] group-hover:bg-[#f6f3ec] py-3 pr-4 align-middle font-normal border-r border-[#dfd9cc]"
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
                              <button
                                type="button"
                                onClick={() =>
                                  openPlayerDossier(player, baseTeam.id)
                                }
                                className="shrink-0 border border-[#dfd9cc] bg-[#f6f3ec] px-1.5 py-0.5 font-mono-ledger text-[9px] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917] cursor-pointer"
                              >
                                Dossier
                              </button>
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

                            {/* Extension Likelihood Pill + Mini Bar */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <span
                                className={`inline-block border px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold ${extBadgeColor}`}
                              >
                                {extensionLikelihoodPct}% Ext. Likelihood
                              </span>
                              <span className="font-mono-ledger text-[10px] text-[#8a8379]">
                                ~${forecast.projectedMarketApy.toFixed(1)}M/yr
                              </span>
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
    </div>
  );
}
