'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Clock,
  Flame,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  evaluatePlayerLongevity,
  getContractYearCapHit,
  LEAGUE_YEARS,
  LeagueYear,
  Player,
  POSITION_GROUPS,
  POSITIONAL_AGING_CURVES,
  PositionGroup,
} from '@/engine';
import { useGMStore } from '@/store/useGMStore';

export function RosterMatrix() {
  const {
    derivedState,
    positionFilter,
    searchQuery,
    selectedPlayerId,
    setPositionFilter,
    setSearchQuery,
    selectPlayer,
    setFreeAgencyModalOpen,
  } = useGMStore();

  const filteredPlayers = useMemo(() => {
    return derivedState.roster.filter((p) => {
      if (positionFilter !== 'ALL' && p.position !== positionFilter) return false;
      if (
        searchQuery.trim() !== '' &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.position.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [derivedState.roster, positionFilter, searchQuery]);

  // Group players by PositionGroup and sort within each group by 2026 Cap Hit descending
  const groupedPlayers = useMemo(() => {
    const groups: { position: PositionGroup; players: Player[] }[] = [];
    for (const pos of POSITION_GROUPS) {
      const matching = filteredPlayers
        .filter((p) => p.position === pos)
        .sort(
          (a, b) =>
            getContractYearCapHit(b.contractYears[2026]) -
            getContractYearCapHit(a.contractYears[2026])
        );
      if (matching.length > 0) {
        groups.push({ position: pos, players: matching });
      }
    }
    return groups;
  }, [filteredPlayers]);

  const tierBadgeStyle: Record<Player['tier'], string> = {
    Elite: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Starter: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    Rookie: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Rotation: 'bg-slate-700/60 text-slate-300 border-slate-600',
    Depth: 'bg-slate-800/80 text-slate-400 border-slate-700',
  };

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      {/* Position Group Allocation Pills & Search Filter Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-slate-900/60 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPositionFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              positionFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            ALL ({derivedState.roster.length})
          </button>
          {POSITION_GROUPS.map((pos) => {
            const alloc = derivedState.years[2026].topPositionAllocation.find(
              (a) => a.position === pos
            );
            const isSelected = positionFilter === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(pos)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                    : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{pos}</span>
                <span className="text-[10px] text-slate-400">
                  ${alloc ? alloc.capSpend.toFixed(1) : '0.0'}M
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Legend for Visual Cap Bars & Unprotected Viable Years */}
          <div className="hidden 2xl:flex items-center gap-4 text-[11px] text-slate-400 border-r border-slate-800 pr-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Prime Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Positional Cliff Warning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-purple-500/50 border border-dashed border-purple-400" /> Void Proration
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-emerald-400 bg-emerald-500/10" /> Unprotected Viable Starter Yr
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player or position..."
              aria-label="Search player or position"
              className="w-56 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Semantic Responsive Table with Container Queries & Sticky Row/Column Headers */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="roster-horizon-table-caption"
        className="table-wrapper overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90 shadow-2xl"
      >
        <table className="w-full border-collapse text-left">
          <caption id="roster-horizon-table-caption" className="sr-only">
            Multi-Year NFL Roster Horizon Matrix (2026 to 2029) showing player contract cap hits, positional age cliffs, and post-contract viable starter seasons.
          </caption>
          <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="sticky left-0 z-30 bg-slate-900/95 py-3 pl-4 pr-3 min-w-[270px] border-r border-slate-800/80">
                Player / Position / Tier
              </th>
              <th scope="col" className="py-3 px-3 min-w-[200px] border-r border-slate-800/60">
                Aging Curve & Post-Deal Viability
              </th>
              {LEAGUE_YEARS.map((yr) => (
                <th
                  key={yr}
                  scope="col"
                  className="py-3 px-3.5 min-w-[215px] border-r border-slate-800/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{yr} Cap Hit</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      % of ${derivedState.years[yr].adjustedCapCeiling.toFixed(0)}M
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 text-xs">
            {groupedPlayers.map((group) => {
              const curve = POSITIONAL_AGING_CURVES[group.position];
              return (
                <React.Fragment key={group.position}>
                  {/* Position Group Header Row */}
                  <tr className="bg-slate-900/80 border-y border-slate-800">
                    <td
                      colSpan={6}
                      className="py-2 px-4 font-bold text-xs tracking-wide text-indigo-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300 border border-indigo-500/30">
                            {group.position}
                          </span>
                          <span>{curve.label}</span>
                          <span className="text-[11px] font-normal text-slate-400">
                            • Prime Window: Ages {curve.peakStartAge}–{curve.peakEndAge} • Positional Cliff: Age {curve.cliffAge}+
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFreeAgencyModalOpen(true)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          <UserPlus className="h-3 w-3" /> Add {group.position} in FA
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Player Rows */}
                  {group.players.map((player) => {
                    const longevity = evaluatePlayerLongevity(player);
                    const isSelected = selectedPlayerId === player.id;

                    // Compute which post-expiration years in 2026–2029 are "Unprotected Viable Starter Years"
                    let viableCounter = 0;

                    return (
                      <tr
                        key={player.id}
                        onClick={() => selectPlayer(player.id)}
                        className={`board-row group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-950/50 hover:bg-indigo-950/70'
                            : 'hover:bg-slate-900/70'
                        }`}
                      >
                        {/* Sticky Row Header: Player Name, Age, Rating, Tier */}
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-slate-950 group-hover:bg-slate-900 py-3 pl-4 pr-3 font-normal border-r border-slate-800/80 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white group-hover:text-indigo-300 transition-colors text-sm">
                                  {player.name}
                                </span>
                                <span
                                  className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${tierBadgeStyle[player.tier]}`}
                                >
                                  {player.tier}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                                <span>Age {player.ageIn2026}</span>
                                <span>•</span>
                                <span className="text-slate-300 font-medium">
                                  OVR {player.overallRating}
                                </span>
                                {player.isRookieContract && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-medium">
                                      Rookie Deal
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-indigo-400 opacity-0 group-hover:opacity-100 border border-indigo-500/30 transition-opacity">
                              Manage
                            </span>
                          </div>
                        </th>

                        {/* Longevity & Post-Contract Viable Seasons Column */}
                        <td className="py-3 px-3 border-r border-slate-800/60">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  longevity.extensionRecommendation ===
                                  'Prime Extension Candidate'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : longevity.extensionRecommendation ===
                                      'Locked Up Through Prime'
                                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                    : longevity.extensionRecommendation ===
                                      'Short Bridge Deal'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {longevity.extensionRecommendation ===
                                  'Prime Extension Candidate' && (
                                  <Sparkles className="h-2.5 w-2.5" />
                                )}
                                {longevity.extensionRecommendation}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-400 flex items-center justify-between">
                              <span>
                                Cliff @ <strong className="text-slate-300">{longevity.cliffAge}</strong>
                              </span>
                              <span
                                className={
                                  longevity.postContractViableYears >= 2
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-slate-400'
                                }
                              >
                                +{longevity.postContractViableYears} viable post-deal yr
                                {longevity.postContractViableYears === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2026–2029 Visual Cap Hit Timeline Bars */}
                        {LEAGUE_YEARS.map((year) => {
                          const cy = player.contractYears[year];
                          const ageAssessment = longevity.yearlyAssessments[year];
                          const capCeiling = derivedState.years[year].adjustedCapCeiling;

                          // Case 1: Active Contract Year or Void Proration Year
                          if (cy) {
                            const hit = getContractYearCapHit(cy);
                            const pctOfCap = (hit / capCeiling) * 100;
                            // Visual bar scaled where 22% of cap ($66M QB hit) = 100% width
                            const barWidthPct = Math.min(100, Math.max(8, (pctOfCap / 20) * 100));

                            if (cy.isVoidYear) {
                              return (
                                <td
                                  key={year}
                                  className="py-2.5 px-3.5 border-r border-slate-800/60 bg-purple-950/10"
                                >
                                  <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className="font-semibold text-purple-300 flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> VOID YEAR
                                    </span>
                                    <span className="font-mono font-bold text-purple-300">
                                      ${cy.proratedBonus.toFixed(2)}M
                                    </span>
                                  </div>
                                  <div className="h-2.5 w-full rounded bg-slate-900 overflow-hidden border border-dashed border-purple-500/50">
                                    <motion.div
                                      className="h-full bg-purple-500/50"
                                      initial={false}
                                      animate={{ width: `${barWidthPct}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 flex items-center justify-between text-[10px] text-purple-300/80">
                                    <span>Age {ageAssessment.age}</span>
                                    <span>Accelerates on expiry</span>
                                  </div>
                                </td>
                              );
                            }

                            // Color bar by Aging Status (Prime = Emerald/Indigo, CliffWarning = Amber, Decline = Rose)
                            const barColor =
                              ageAssessment.status === 'Decline'
                                ? 'bg-rose-500'
                                : ageAssessment.status === 'CliffWarning'
                                ? 'bg-amber-500'
                                : ageAssessment.status === 'Ascent'
                                ? 'bg-teal-400'
                                : 'bg-indigo-500';

                            const guaranteedRatio =
                              hit > 0
                                ? Math.min(
                                    100,
                                    ((cy.guaranteedSalary + cy.proratedBonus) / hit) * 100
                                  )
                                : 0;

                            return (
                              <td
                                key={year}
                                className="py-2.5 px-3.5 border-r border-slate-800/60"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono text-sm font-bold text-white">
                                    ${hit.toFixed(2)}M
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-400">
                                    {pctOfCap.toFixed(1)}% cap
                                  </span>
                                </div>

                                {/* Visual Cap Bar */}
                                <div className="relative h-3 w-full rounded-md bg-slate-800/90 overflow-hidden">
                                  <motion.div
                                    className={`h-full ${barColor} rounded-md`}
                                    initial={false}
                                    animate={{ width: `${barWidthPct}%` }}
                                    transition={{
                                      type: 'spring',
                                      stiffness: 260,
                                      damping: 26,
                                    }}
                                  />
                                </div>

                                {/* Sub-row: Base vs Prorated + Age Cliff Pill */}
                                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                  <span>
                                    Base ${cy.baseSalary.toFixed(1)}M • Bonus $
                                    {cy.proratedBonus.toFixed(1)}M
                                  </span>
                                  <span
                                    className={`font-semibold ${
                                      ageAssessment.isAtOrPastCliff
                                        ? 'text-amber-400'
                                        : 'text-slate-400'
                                    }`}
                                    title={ageAssessment.statusLabel}
                                  >
                                    Age {ageAssessment.age}
                                    {ageAssessment.isAtOrPastCliff ? ' ⚠️' : ''}
                                    {guaranteedRatio > 60 ? ' 🔒' : ''}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          // Case 2: Post-Contract Expiration Year — Check if Unprotected Viable Starter Season!
                          const isUnprotectedViableYear =
                            longevity.contractExpirationYear !== null &&
                            year > longevity.contractExpirationYear &&
                            viableCounter < longevity.postContractViableYears;

                          if (isUnprotectedViableYear) {
                            viableCounter++;
                            return (
                              <td
                                key={year}
                                className="py-2.5 px-3.5 border-r border-slate-800/60 bg-emerald-950/10"
                              >
                                <div className="flex h-full flex-col justify-center rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                                    <span>Unprotected Prime Yr</span>
                                    <span>Age {ageAssessment.age}</span>
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-emerald-400/80">
                                     Viable starter yr #{viableCounter} — click to extend
                                  </p>
                                </div>
                              </td>
                            );
                          }

                          // Case 3: Post-Cliff / Free Agent Walk Year
                          return (
                            <td
                              key={year}
                              className="py-2.5 px-3.5 border-r border-slate-800/60 opacity-45"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Free Agent (Walk)</span>
                                <span>Age {ageAssessment.age}</span>
                              </div>
                              <div className="mt-1 text-[10px] text-slate-600">
                                Past {player.position} cliff ({longevity.cliffAge})
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dead Cap Breakdown Footer Accordion */}
      {derivedState.deadCapLedger.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Active Dead Money & Proration Acceleration Ledger
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {derivedState.deadCapLedger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{entry.playerName}</div>
                  <div className="text-[11px] text-slate-400">{entry.reason}</div>
                </div>
                <div className="text-right font-mono text-[11px]">
                  {entry.amountsByYear[2026] > 0 && (
                    <div className="text-amber-300 font-bold">
                      2026: ${entry.amountsByYear[2026].toFixed(2)}M
                    </div>
                  )}
                  {entry.amountsByYear[2027] > 0 && (
                    <div className="text-amber-400/90">
                      2027: ${entry.amountsByYear[2027].toFixed(2)}M
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
