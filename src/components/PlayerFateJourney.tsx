'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Ghost,
  Scissors,
  Search,
  ShieldCheck,
  UserMinus,
  Wand2,
} from 'lucide-react';
import {
  computeRealContractXRay,
  evaluateFutureSeasonRosterOutlook,
  FutureRosterBucket,
  FutureSeasonPlayerEvaluation,
  LEAGUE_YEARS,
  LeagueYear,
  POSITION_GROUPS,
  PositionGroup,
  projectPlayerCareerHorizon,
} from '@/engine';
import { useGMStore } from '@/store/useGMStore';
import { PlayerAvatar } from './PlayerAvatar';
import { JargonTip } from './JargonTooltip';
import { GlobalPlayerSearch } from './PlayerDossierModal';

type BucketFilter = 'ALL_BUCKETS' | FutureRosterBucket;

const ALL_POSITIONS: (PositionGroup | 'ALL')[] = ['ALL', ...POSITION_GROUPS];

export function PlayerFateJourney() {
  const {
    baseTeam,
    derivedState,
    selectPlayer,
    setActiveTab,
    addCutTransaction,
    addRestructureTransaction,
    openFreeAgencyModal,
    openPlayerDossier,
  } = useGMStore();

  const [targetYear, setTargetYear] = useState<LeagueYear>(2027);
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('ALL_BUCKETS');
  const [posFilter, setPosFilter] = useState<PositionGroup | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const outlook = useMemo(
    () => evaluateFutureSeasonRosterOutlook(derivedState, targetYear),
    [derivedState, targetYear]
  );

  const yearCap = derivedState.years[targetYear];

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
          {/* Top Row: Player Identity + Season Status Badge */}
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
                <div className="flex items-center gap-2">
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

          {/* Middle Row: Plain-English Why */}
          <p className="mt-3 text-xs leading-relaxed text-[#44403c]">
            {item.rationale}
          </p>

          {/* Real Contract X-Ray Comparison Box */}
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

        {/* 1-Click Action Footer Tailored to the Bucket & Selected Year */}
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
      {/* 1. Journey 02 Header + Prominent Season Year Switcher (2026 / 2027 / 2028 / 2029) */}
      <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#dfd9cc] pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8379]">
              Journey 02 · Future Roster Projection &amp; Contract X-Ray
              (2026–2029)
            </span>
            <h1 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
              {baseTeam.city} {baseTeam.name} — {targetYear} Projected Roster
              Outlook
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              Select any season on the right to see exactly who is{' '}
              <strong className="text-[#2d5a43]">Safe Under Contract</strong>,
              who is a{' '}
              <strong className="text-[#b84a27]">
                Likely {targetYear} Cap Cut / Fake Contract Year
              </strong>
              , who will be{' '}
              <strong className="text-[#1c1917]">
                Off-Contract (Free Agents)
              </strong>
              , and any{' '}
              <strong className="text-[#1c1917]">Void-Year Ghost Bills</strong>.
            </p>
          </div>

          {/* Season Year Switcher */}
          <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
              <Calendar className="h-3.5 w-3.5 text-[#1c1917]" />
              Select Season to Project Roster:
            </span>
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
        </div>

        {/* 2. 4 Interactive Bucket Summary Cards for the Selected Year */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                prev === 'OFF_CONTRACT_FA' ? 'ALL_BUCKETS' : 'OFF_CONTRACT_FA'
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
                prev === 'VOID_GHOST_BILL' ? 'ALL_BUCKETS' : 'VOID_GHOST_BILL'
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

        {/* 3. Search, Bucket Pill Reset & Position Filter Bar */}
        <div className="mt-5 pt-4 border-t border-[#dfd9cc] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Filter ${baseTeam.name} roster in ${targetYear}...`}
                className="w-full border border-[#1c1917] bg-[#f6f3ec] py-1.5 pl-9 pr-3 text-xs text-[#1c1917] placeholder:text-[#8a8379] focus:outline-none"
              />
            </div>

            <GlobalPlayerSearch
              placeholder="Or lookup any player across all 32 teams..."
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
            {bucketFilter !== 'ALL_BUCKETS' && (
              <button
                type="button"
                onClick={() => setBucketFilter('ALL_BUCKETS')}
                className="ml-2 border border-[#1c1917] bg-[#1c1917] px-2.5 py-0.5 text-[11px] font-semibold text-[#f6f3ec] cursor-pointer"
              >
                Show All 4 Buckets ✕
              </button>
            )}
          </div>
        </div>
      </section>

      {/* BUCKET SECTION 1: Likely Cap Cuts / Fake Contract Years (Shown prominently when viewing future years!) */}
      {(bucketFilter === 'ALL_BUCKETS' ||
        bucketFilter === 'LIKELY_CAP_CUT') && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#b84a27] pb-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b84a27]">
                Bucket 02 · {targetYear} Cap Casualty &amp; Paper-Year Watchlist
              </span>
              <h2 className="font-editorial text-2xl text-[#1c1917]">
                Likely {targetYear} Cap Cuts / Restructure-or-Release Decisions
                ({filteredCuts.length})
              </h2>
              <p className="text-xs text-[#57534e]">
                These players are technically under contract in {targetYear},
                but have unguaranteed back-end salaries where cutting them saves
                major cap space (+$
                {outlook.totals.likelyCutsPotentialSavings.toFixed(1)}M total).
              </p>
            </div>

            {filteredCuts.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  for (const c of filteredCuts) {
                    addCutTransaction(c.player, 'PRE_JUNE_1_CUT', targetYear);
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

      {/* BUCKET SECTION 2: Off-Contract / Newly Expired Free Agents in targetYear */}
      {(bucketFilter === 'ALL_BUCKETS' ||
        bucketFilter === 'OFF_CONTRACT_FA') && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#b57c1e] pb-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b57c1e]">
                Bucket 03 · Off-Contract / Expiring Free Agents in {targetYear}
              </span>
              <h2 className="font-editorial text-2xl text-[#1c1917]">
                Players Off Contract by {targetYear} ({filteredOffContract.length}
                )
              </h2>
              <p className="text-xs text-[#57534e]">
                Players from the current roster whose contracts expire before or
                entering the {targetYear} season. Click{' '}
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

      {/* BUCKET SECTION 3: Safe Under Contract in targetYear */}
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
                {targetYear} (${outlook.totals.safeContractCapTotal.toFixed(1)}M
                combined cap hit).
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

      {/* BUCKET SECTION 4: Void-Year Ghost Bills in targetYear */}
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
                  dummy Void Years where past signing bonus restructures stay on
                  your {targetYear} cap.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredVoid.map(renderEvaluationCard)}
            </div>
          </section>
        )}
    </div>
  );
}
