'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import {
  evaluatePlayerLongevity,
  getContractYearCapHit,
  LEAGUE_YEARS,
  Player,
  POSITION_GROUPS,
  POSITIONAL_AGING_CURVES,
  PositionGroup,
} from '@/engine';
import { useGMStore } from '@/store/useGMStore';

export function RosterMatrix() {
  const {
    baseTeam,
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

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Editorial Intro & Position Index Strip */}
      <div className="mb-8 flex flex-col gap-6 border-b border-[#dfd9cc] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[#8a8379]">
            {baseTeam.archetypeLabel}
          </p>
          <h2 className="font-editorial mt-1 text-3xl font-normal text-[#1c1917]">
            Multi-Year Contract Ledger (2026–2029)
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[#57534e] leading-relaxed">
            {baseTeam.archetypeDescription} Select any player row to model a
            restructure, Pre/Post-June 1 release, extension, or trade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter player..."
              aria-label="Filter player or position"
              className="w-48 border-b border-[#c7bfb0] bg-transparent py-1 pl-8 pr-2 text-xs text-[#1c1917] placeholder-[#8a8379] focus:border-[#1c1917] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Minimalist Position Filter Index */}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-[#dfd9cc] pb-3">
        <div className="flex flex-wrap items-baseline gap-4 text-xs">
          <button
            type="button"
            onClick={() => setPositionFilter('ALL')}
            className={`pb-1 transition-colors cursor-pointer ${
              positionFilter === 'ALL'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#8a8379] hover:text-[#1c1917]'
            }`}
          >
            All Positions ({derivedState.roster.length})
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
                className={`pb-1 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                    : 'text-[#57534e] hover:text-[#1c1917]'
                }`}
              >
                <span>{pos}</span>{' '}
                <span className="font-mono-ledger text-[11px] text-[#8a8379]">
                  ${alloc ? alloc.capSpend.toFixed(0) : '0'}M
                </span>
              </button>
            );
          })}
        </div>

        {/* Quiet Editorial Key */}
        <div className="flex items-center gap-5 text-[11px] text-[#57534e]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#1c1917] inline-block" /> Prime Window
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[#b84a27] inline-block" /> Age Cliff
            Window
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 border border-dashed border-[#8a8379] inline-block" />{' '}
            Void / Unprotected Yr
          </span>
        </div>
      </div>

      {/* Open Editorial Table — Horizontal Hairlines Only */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="roster-horizon-table-caption"
        className="table-wrapper overflow-x-auto"
      >
        <table className="w-full border-collapse text-left">
          <caption id="roster-horizon-table-caption" className="sr-only">
            Multi-Year NFL Roster Horizon Matrix (2026 to 2029)
          </caption>
          <thead className="sticky top-0 z-20 bg-[#f6f3ec] border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 bg-[#f6f3ec] py-3 pr-4 min-w-[240px] font-semibold"
              >
                Player
              </th>
              <th
                scope="col"
                className="py-3 px-4 min-w-[190px] font-semibold"
              >
                Longevity Horizon
              </th>
              {LEAGUE_YEARS.map((yr) => (
                <th
                  key={yr}
                  scope="col"
                  className="py-3 px-4 min-w-[205px] font-semibold"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[#1c1917]">{yr}</span>
                    <span className="font-mono-ledger text-[10px] font-normal text-[#8a8379]">
                      of ${derivedState.years[yr].adjustedCapCeiling.toFixed(0)}M
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#dfd9cc] text-xs">
            {groupedPlayers.map((group) => {
              const curve = POSITIONAL_AGING_CURVES[group.position];
              return (
                <React.Fragment key={group.position}>
                  {/* Editorial Section Subhead */}
                  <tr className="bg-[#ede8dd]/60">
                    <td colSpan={6} className="py-2.5 px-3">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-3">
                          <span className="font-editorial text-sm font-medium text-[#1c1917]">
                            {curve.label} ({group.position})
                          </span>
                          <span className="text-[11px] text-[#8a8379]">
                            Peak ages {curve.peakStartAge}–{curve.peakEndAge} ·
                            Historical cliff at {curve.cliffAge}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFreeAgencyModalOpen(true)}
                          className="text-[11px] text-[#57534e] underline decoration-[#c7bfb0] underline-offset-4 hover:text-[#1c1917] cursor-pointer"
                        >
                          + Sign {group.position}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Player Rows */}
                  {group.players.map((player) => {
                    const longevity = evaluatePlayerLongevity(player);
                    const isSelected = selectedPlayerId === player.id;
                    let viableCounter = 0;

                    return (
                      <tr
                        key={player.id}
                        onClick={() => selectPlayer(player.id)}
                        className={`board-row group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#ede8dd]'
                            : 'hover:bg-[#fcfaf6]'
                        }`}
                      >
                        {/* Sticky Player Column */}
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-[#f6f3ec] group-hover:bg-[#fcfaf6] py-3.5 pr-4 font-normal transition-colors"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <div className="flex items-baseline gap-2">
                                <span className="font-medium text-sm text-[#1c1917] group-hover:underline">
                                  {player.name}
                                </span>
                                <span className="text-[11px] italic text-[#8a8379]">
                                  {player.tier}
                                </span>
                              </div>
                              <div className="mt-0.5 font-mono-ledger text-[11px] text-[#8a8379]">
                                Age {player.ageIn2026} · OVR {player.overallRating}
                                {player.isRookieContract ? ' · Rookie' : ''}
                              </div>
                            </div>
                          </div>
                        </th>

                        {/* Longevity & Viable Post-Deal Seasons */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="text-xs font-medium text-[#1c1917]">
                            {longevity.extensionRecommendation}
                          </div>
                          <div className="mt-0.5 font-mono-ledger text-[11px] text-[#8a8379]">
                            Cliff @{longevity.cliffAge} ·{' '}
                            <span
                              className={
                                longevity.postContractViableYears >= 2
                                  ? 'text-[#2d5a43] font-medium'
                                  : ''
                              }
                            >
                              +{longevity.postContractViableYears} viable post-deal yr
                              {longevity.postContractViableYears === 1 ? '' : 's'}
                            </span>
                          </div>
                        </td>

                        {/* 2026–2029 Cap Horizon Cells */}
                        {LEAGUE_YEARS.map((year) => {
                          const cy = player.contractYears[year];
                          const ageAssessment = longevity.yearlyAssessments[year];
                          const capCeiling =
                            derivedState.years[year].adjustedCapCeiling;

                          if (cy) {
                            const hit = getContractYearCapHit(cy);
                            const pctOfCap = (hit / capCeiling) * 100;
                            const barWidthPct = Math.min(
                              100,
                              Math.max(4, (pctOfCap / 20) * 100)
                            );

                            if (cy.isVoidYear) {
                              return (
                                <td key={year} className="py-3.5 px-4 align-middle">
                                  <div className="flex items-baseline justify-between font-mono-ledger text-xs text-[#8a8379]">
                                    <span className="uppercase text-[10px] tracking-wider">
                                      Void Proration
                                    </span>
                                    <span>${cy.proratedBonus.toFixed(2)}M</span>
                                  </div>
                                  <div className="mt-1.5 h-1 w-full border-b border-dashed border-[#8a8379]" />
                                  <div className="mt-1 font-mono-ledger text-[10px] text-[#8a8379]">
                                    Age {ageAssessment.age} · Accelerates
                                  </div>
                                </td>
                              );
                            }

                            const barColor = ageAssessment.isAtOrPastCliff
                              ? 'bg-[#b84a27]'
                              : 'bg-[#1c1917]';

                            return (
                              <td key={year} className="py-3.5 px-4 align-middle">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                                    ${hit.toFixed(2)}M
                                  </span>
                                  <span className="font-mono-ledger text-[11px] text-[#8a8379]">
                                    {pctOfCap.toFixed(1)}%
                                  </span>
                                </div>

                                {/* Crisp 4px Ink Bar */}
                                <div className="mt-1.5 h-1 w-full bg-[#e5dfd3] overflow-hidden">
                                  <motion.div
                                    className={`h-full ${barColor}`}
                                    initial={false}
                                    animate={{ width: `${barWidthPct}%` }}
                                    transition={{
                                      type: 'spring',
                                      stiffness: 260,
                                      damping: 30,
                                    }}
                                  />
                                </div>

                                <div className="mt-1 flex items-center justify-between font-mono-ledger text-[10px] text-[#8a8379]">
                                  <span>
                                    B ${cy.baseSalary.toFixed(1)}M · P $
                                    {cy.proratedBonus.toFixed(1)}M
                                  </span>
                                  <span
                                    className={
                                      ageAssessment.isAtOrPastCliff
                                        ? 'text-[#b84a27] font-medium'
                                        : ''
                                    }
                                  >
                                    Age {ageAssessment.age}
                                    {ageAssessment.isAtOrPastCliff ? ' (Cliff)' : ''}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          // Unprotected Viable Starter Year
                          const isUnprotectedViableYear =
                            longevity.contractExpirationYear !== null &&
                            year > longevity.contractExpirationYear &&
                            viableCounter < longevity.postContractViableYears;

                          if (isUnprotectedViableYear) {
                            viableCounter++;
                            return (
                              <td key={year} className="py-3.5 px-4 align-middle">
                                <div className="border-l-2 border-[#2d5a43] pl-2.5">
                                  <div className="flex items-baseline justify-between text-[11px] font-medium text-[#2d5a43]">
                                    <span>Unprotected Prime</span>
                                    <span className="font-mono-ledger text-[10px]">
                                      Age {ageAssessment.age}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#8a8379]">
                                    Viable yr #{viableCounter} — extend
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={year}
                              className="py-3.5 px-4 align-middle text-[#8a8379]/50"
                            >
                              <div className="font-mono-ledger text-[11px]">
                                — Unsigned (Age {ageAssessment.age})
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

      {/* Dead Money Footnote Ledger */}
      {derivedState.deadCapLedger.length > 0 && (
        <div className="mt-12 border-t border-[#1c1917] pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#57534e] mb-4">
            Dead Money & Bonus Acceleration Footnotes
          </h3>
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {derivedState.deadCapLedger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-baseline justify-between border-b border-[#dfd9cc] py-2 text-xs"
              >
                <div>
                  <span className="font-medium text-[#1c1917]">
                    {entry.playerName}
                  </span>{' '}
                  <span className="text-[11px] text-[#8a8379]">
                    ({entry.reason})
                  </span>
                </div>
                <div className="font-mono-ledger text-xs text-[#b84a27]">
                  {entry.amountsByYear[2026] > 0 &&
                    `'26: $${entry.amountsByYear[2026].toFixed(2)}M `}
                  {entry.amountsByYear[2027] > 0 &&
                    `'27: $${entry.amountsByYear[2027].toFixed(2)}M`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
