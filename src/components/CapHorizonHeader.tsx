'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Home, RotateCcw } from 'lucide-react';
import {
  computeDerivedTeamCapState,
  DEFAULT_CAP_GROWTH_RATE,
  LEAGUE_YEARS,
  LeagueYear,
} from '@/engine';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';
import { JargonDecoderButton, JargonTip } from './JargonTooltip';
import { GlobalPlayerSearch } from './PlayerDossierModal';

const NFL_DIVISIONS = [
  'NFC North',
  'NFC East',
  'NFC West',
  'NFC South',
  'AFC North',
  'AFC East',
  'AFC West',
  'AFC South',
] as const;

export function CapHorizonHeader() {
  const {
    selectedTeamId,
    baseTeam,
    capGrowthRate,
    transactions,
    derivedState,
    activeTab,
    ledgerMode,
    selectTeam,
    setCapGrowthRate,
    setActiveTab,
    goBack,
    goHome,
    setLedgerMode,
    setScenarioDrawerOpen,
    openFreeAgencyModal,
    resetScenarioStack,
  } = useGMStore();

  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [receiptYear, setReceiptYear] = useState<LeagueYear | null>(null);
  const [showMobileCapDetails, setShowMobileCapDetails] = useState(false);

  const enabledCount = transactions.filter((t) => t.enabled).length;
  const compSummary = derivedState.compPickSummary;

  const teamsByDivision = useMemo(() => {
    const allTeams = Object.values(SEED_TEAMS);
    return NFL_DIVISIONS.map((div) => ({
      division: div,
      teams: allTeams
        .filter((t) => t.division === div)
        .map((t) => {
          const cap26 = computeDerivedTeamCapState(
            t,
            [],
            DEFAULT_CAP_GROWTH_RATE
          ).years[2026].effectiveCapSpace;
          return { ...t, cap26 };
        }),
    }));
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#dfd9cc] bg-[#f6f3ec]/95 backdrop-blur-sm">
        {/* Masthead Row — Compact on iPhone/Pixel, Full on Desktop */}
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-6 sm:py-4 border-b border-[#dfd9cc]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {activeTab !== 'player-fate' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goBack}
                  title="Go back to previous journey"
                  className="flex items-center gap-1 border border-[#1c1917] bg-[#1c1917] px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  title="Return to Roster Grid & Needs (Home)"
                  className="hidden sm:flex items-center gap-1.5 border border-[#1c1917] bg-[#fcfaf6] px-2.5 py-1.5 text-xs font-semibold text-[#1c1917] hover:bg-[#ede8dd] transition-colors cursor-pointer"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Roster Grid (Home)</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={goHome}
              title="Return to Armchair GM Home Hub"
              className="flex items-center gap-2 sm:gap-3 text-left hover:opacity-80 transition-opacity cursor-pointer"
            >
              {baseTeam.logoUrl && (
                <img
                  src={baseTeam.logoUrl}
                  alt={`${baseTeam.city} ${baseTeam.name} logo`}
                  className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
                />
              )}
              <div>
                <span className="font-editorial text-lg sm:text-2xl font-normal tracking-tight text-[#1c1917]">
                  Armchair GM
                </span>
                <span className="ml-3 hidden xl:inline text-xs uppercase tracking-[0.14em] text-[#8a8379]">
                  {baseTeam.city} {baseTeam.name} · OTC Live Ledger
                </span>
              </div>
            </button>

            {/* All-32 NFL Franchise Directory Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsDirectoryOpen((prev) => !prev)}
                aria-expanded={isDirectoryOpen}
                className="flex items-center gap-1.5 sm:gap-2 border border-[#1c1917] bg-[#fcfaf6] px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-[#1c1917] hover:bg-[#ede8dd] transition-colors cursor-pointer"
              >
                {baseTeam.logoUrl && (
                  <img
                    src={baseTeam.logoUrl}
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                )}
                <span className="font-semibold sm:font-medium">
                  <span className="hidden sm:inline">{baseTeam.city} </span>
                  {baseTeam.name} ({baseTeam.abbreviation})
                </span>
                <span className="hidden sm:inline text-[10px] text-[#8a8379]">
                  · 32 Clubs
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    isDirectoryOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Center Navigation Links — Hidden on Phone (moved to Bottom Tab Bar), Visible on md+ */}
          <nav
            aria-label="Customer Journeys"
            className="hidden md:flex flex-wrap items-center gap-1.5 lg:gap-2"
          >
          {[
            {
              id: 'player-fate' as const,
              step: '1',
              label: 'Roster Grid & Needs (Home)',
              subtitle: '2026–2031 Bars + Add FAs',
            },
            {
              id: 'cap-checkup' as const,
              step: '2',
              label: 'Cap Checkup & Clear Space',
              subtitle: 'Fix Cap Crunch',
            },
            {
              id: 'free-agency' as const,
              step: '3',
              label: 'Full FA Market',
              subtitle: 'Market & Comp Picks',
            },
            {
              id: 'draft' as const,
              step: '4',
              label: 'Trade & Draft',
              subtitle: 'Fit Targets & Picks',
            },
            {
              id: 'matrix' as const,
              step: '5',
              label: 'Full Spreadsheet',
              subtitle: '4-Yr Ledger & Lab',
            },
          ].map((item) => {
            const isActive =
              activeTab === item.id ||
              (item.id === 'matrix' && activeTab === 'predictor');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`group flex flex-col items-start border px-3 py-1.5 text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                    : 'border-[#dfd9cc] bg-[#fcfaf6] text-[#1c1917] hover:border-[#1c1917] hover:bg-[#ede8dd]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-tight">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full font-mono-ledger text-[10px] ${
                      isActive
                        ? 'bg-[#f6f3ec] text-[#1c1917]'
                        : 'bg-[#ede8dd] text-[#57534e]'
                    }`}
                  >
                    {item.step}
                  </span>
                  <span>{item.label}</span>
                </div>
                <span
                  className={`hidden xl:inline text-[9px] uppercase tracking-[0.08em] ${
                    isActive ? 'text-[#f6f3ec]/75' : 'text-[#8a8379]'
                  }`}
                >
                  {item.subtitle}
                </span>
              </button>
            );
          })}
        </nav>

          {/* Right Controls: Global Player Lookup, Cap vs Cash Toggle, Growth & Scenario Notebook */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-xs">
            <div className="hidden lg:block">
              <GlobalPlayerSearch
                placeholder="Lookup any NFL player (age, yrs left, deal)..."
                className="w-56 xl:w-64"
              />
            </div>

            <div className="hidden sm:block">
              <JargonDecoderButton />
            </div>

            {/* Cap vs Cash Accounting Toggle */}
            <div className="hidden md:flex items-center border border-[#c7bfb0] text-[11px]">
              <button
                type="button"
                onClick={() => setLedgerMode('CAP')}
                className={`px-2 py-1 cursor-pointer ${
                  ledgerMode === 'CAP'
                    ? 'bg-[#1c1917] text-[#f6f3ec] font-medium'
                    : 'text-[#57534e]'
                }`}
              >
                Cap Hit
              </button>
              <button
                type="button"
                onClick={() => setLedgerMode('CASH')}
                className={`px-2 py-1 cursor-pointer ${
                  ledgerMode === 'CASH'
                    ? 'bg-[#1c1917] text-[#f6f3ec] font-medium'
                    : 'text-[#57534e]'
                }`}
              >
                Owner Cash
              </button>
            </div>

            <div className="hidden 2xl:flex items-center gap-1.5 text-[#57534e]">
              <select
                aria-label="Annual League Cap Growth Rate"
                value={capGrowthRate}
                onChange={(e) => setCapGrowthRate(parseFloat(e.target.value))}
                className="bg-transparent font-mono-ledger text-xs font-medium text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4 focus:outline-none cursor-pointer"
              >
                <option value={0.05}>+5.0%/yr</option>
                <option value={0.075}>+7.5%/yr</option>
                <option value={0.09}>+9.0%/yr</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => openFreeAgencyModal({ position: 'ALL' })}
              className="hidden sm:inline-flex border border-[#1c1917] px-3 py-1.5 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
            >
              + Sign Free Agent
            </button>

            <button
              type="button"
              onClick={() => setScenarioDrawerOpen(true)}
              className="flex items-center gap-1.5 bg-[#1c1917] px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
            >
              <span className="hidden sm:inline">Moves Notebook</span>
              <span className="sm:hidden">Moves</span>
              <span className="font-mono-ledger text-[11px] opacity-80">
                [{enabledCount}/{transactions.length}]
              </span>
            </button>

            {transactions.length > 0 && (
              <button
                type="button"
                onClick={resetScenarioStack}
                title="Reset all simulated GM moves"
                className="p-1 sm:p-1.5 text-[#57534e] hover:text-[#b84a27] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Expandable All-32 NFL Club Directory (Grouped by Division) */}
        {isDirectoryOpen && (
          <div className="max-h-[75dvh] overflow-y-auto border-b-2 border-[#1c1917] bg-[#fcfaf6] shadow-lg">
            <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
              <div className="mb-3 flex items-baseline justify-between border-b border-[#dfd9cc] pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534e]">
                  All 32 NFL Franchises · Live Over The Cap 2026–2029 Books
                </span>
                <button
                  type="button"
                  onClick={() => setIsDirectoryOpen(false)}
                  className="text-xs font-semibold text-[#1c1917] cursor-pointer"
                >
                  Close ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
                {teamsByDivision.map((group) => (
                  <div key={group.division} className="space-y-1.5">
                    <div className="border-b border-[#dfd9cc] pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                      {group.division}
                    </div>
                    <div className="space-y-1">
                      {group.teams.map((team) => {
                        const isSelected = team.id === selectedTeamId;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => {
                              selectTeam(team.id);
                              setIsDirectoryOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-1.5 py-1 text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#1c1917] font-semibold text-[#f6f3ec]'
                                : 'text-[#1c1917] hover:bg-[#ede8dd]'
                            }`}
                          >
                            {team.logoUrl && (
                              <img
                                src={team.logoUrl}
                                alt=""
                                className="h-4 w-4 shrink-0 object-contain"
                              />
                            )}
                            <span className="truncate">{team.name}</span>
                            <span
                              className={`ml-auto font-mono-ledger text-[10px] ${
                                isSelected
                                  ? 'text-[#f6f3ec]/90'
                                  : team.cap26 < 10
                                  ? 'text-[#b84a27] font-semibold'
                                  : team.cap26 >= 35
                                  ? 'text-[#2d5a43] font-medium'
                                  : 'text-[#8a8379]'
                              }`}
                            >
                              {team.cap26 < 0 ? '−$' : '$'}
                              {Math.abs(team.cap26).toFixed(0)}M
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MOBILE COMPACT 4-YEAR CAP PILL STRIP (Visible on Phone <768px so sticky header stays slim) */}
        <div className="md:hidden px-3 py-1.5 bg-[#fcfaf6] border-b border-[#dfd9cc]">
          <div className="grid grid-cols-5 items-center gap-1">
            {LEAGUE_YEARS.map((year) => {
              const yData = derivedState.years[year];
              const isOverCap = yData.effectiveCapSpace < 0;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setShowMobileCapDetails(true);
                    setReceiptYear((prev) => (prev === year ? null : year));
                  }}
                  className="flex flex-col items-center border border-[#dfd9cc] bg-[#f6f3ec] py-1 px-1 text-center"
                >
                  <span className="font-mono-ledger text-[9px] font-semibold text-[#8a8379]">
                    &apos;{String(year).slice(2)} Cap
                  </span>
                  <span
                    className={`font-mono-ledger text-[11px] font-bold ${
                      isOverCap ? 'text-[#b84a27]' : 'text-[#2d5a43]'
                    }`}
                  >
                    {isOverCap ? '−$' : '+$'}
                    {Math.abs(yData.effectiveCapSpace).toFixed(0)}M
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowMobileCapDetails((v) => !v)}
              className="flex flex-col items-center justify-center h-full border border-[#1c1917] bg-[#1c1917] py-1 px-1 text-[9px] font-semibold text-[#f6f3ec]"
            >
              <span>Details</span>
              <span>{showMobileCapDetails ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {/* 4-Year Cap Horizon Strip — Full on Desktop (md+), Expandable on Phone */}
        <div
          className={`mx-auto max-w-[1440px] px-4 sm:px-6 ${
            showMobileCapDetails ? 'block' : 'hidden md:block'
          }`}
        >
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#dfd9cc]">
          {LEAGUE_YEARS.map((year, idx) => {
            const yData = derivedState.years[year];
            const isOverCap = yData.effectiveCapSpace < 0;
            const activePct = Math.min(
              100,
              (yData.activeTop51Cap / yData.adjustedCapCeiling) * 100
            );
            const deadPct = Math.min(
              100 - activePct,
              (yData.deadMoneyTotal / yData.adjustedCapCeiling) * 100
            );
            const isReceiptOpen = receiptYear === year;

            return (
              <div
                key={year}
                className={`py-3 ${
                  idx === 0
                    ? 'lg:pr-6'
                    : idx === 3
                    ? 'lg:pl-6'
                    : 'lg:px-6'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-editorial text-lg text-[#1c1917]">
                      {year}
                    </span>
                    <span className="font-mono-ledger text-[11px] text-[#8a8379]">
                      <JargonTip term="ADJUSTED_CAP">
                        Limit ${yData.adjustedCapCeiling.toFixed(1)}M
                      </JargonTip>
                    </span>
                  </div>

                  {ledgerMode === 'CAP' ? (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptYear((prev) => (prev === year ? null : year))
                        }
                        title="Click to see exact Spendable Now math receipt & why sites disagree"
                        className={`font-mono-ledger text-base font-semibold underline decoration-dotted underline-offset-4 cursor-pointer ${
                          isOverCap ? 'text-[#b84a27]' : 'text-[#2d5a43]'
                        }`}
                      >
                        {isOverCap ? '−$' : '+$'}
                        {Math.abs(yData.effectiveCapSpace).toFixed(2)}M
                      </button>
                      <div className="text-[9px] uppercase tracking-[0.1em] text-[#8a8379]">
                        {isReceiptOpen ? 'Hide Receipt ▲' : 'Spendable Now ▼'}
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono-ledger text-base font-semibold text-[#1c1917]">
                      <JargonTip term="CASH_SPEND">
                        Cash ${yData.totalCashSpend.toFixed(1)}M
                      </JargonTip>
                    </span>
                  )}
                </div>

                {/* Single hairline progress rule */}
                <div className="mt-1.5 h-1.5 w-full bg-[#e5dfd3] overflow-hidden flex">
                  <motion.div
                    className={`h-full ${
                      isOverCap ? 'bg-[#b84a27]' : 'bg-[#1c1917]'
                    }`}
                    initial={false}
                    animate={{ width: `${activePct}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  />
                  <motion.div
                    className="h-full bg-[#b57c1e]"
                    initial={false}
                    animate={{ width: `${deadPct}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between font-mono-ledger text-[11px] text-[#57534e]">
                  <span>
                    <JargonTip term="TOP_51_RULE">
                      Top-51 ${yData.activeTop51Cap.toFixed(1)}M
                    </JargonTip>{' '}
                    ·{' '}
                    <JargonTip term="DEAD_MONEY">
                      Dead ${yData.deadMoneyTotal.toFixed(1)}M
                    </JargonTip>
                  </span>
                  {year === 2026 ? (
                    <span className="text-[10px] text-[#8a8379]">
                      <JargonTip term="COMP_PICK">
                        Comp: {compSummary.netProjectedCompPicks.length}
                      </JargonTip>{' '}
                      ·{' '}
                      <JargonTip term="POST_JUNE_1_DESIGNATION">
                        Post-6/1:{' '}
                        <strong
                          className={
                            compSummary.postJune1DesignationsUsed > 2
                              ? 'text-[#b84a27]'
                              : ''
                          }
                        >
                          {compSummary.postJune1DesignationsUsed}/2
                        </strong>
                      </JargonTip>
                    </span>
                  ) : yData.rolloverFromPriorYear > 0 ? (
                    <span className="text-[#2d5a43]">
                      <JargonTip term="ROLLOVER">
                        +${yData.rolloverFromPriorYear.toFixed(1)}M roll
                      </JargonTip>
                    </span>
                  ) : (
                    <span className="text-[#8a8379]">
                      {yData.activeRosterCount} contracts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expandable "Spendable Now" Math Receipt ("Why Cap Sites Disagree") */}
        {receiptYear !== null && (
          <div className="border-t border-[#dfd9cc] bg-[#fcfaf6] py-3.5 px-4 mb-2 text-xs">
            {(() => {
              const rData = derivedState.years[receiptYear];
              const rawCapSpaceBeforeRookies =
                rData.adjustedCapCeiling -
                rData.activeTop51Cap -
                rData.deadMoneyTotal;
              return (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                      {receiptYear} Exact Cap Accounting Receipt · Why Sites Disagree
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#57534e]">
                      Basic cap trackers show{' '}
                      <strong className="font-mono-ledger text-[#1c1917]">
                        {rawCapSpaceBeforeRookies >= 0 ? '+$' : '−$'}
                        {Math.abs(rawCapSpaceBeforeRookies).toFixed(2)}M
                      </strong>{' '}
                      (Raw Top-51 Space). True{' '}
                      <strong className="text-[#2d5a43]">Spendable Now</strong>{' '}
                      subtracts the net rookie class reserve (gross rookie pool
                      minus{' '}
                      <span className="font-mono-ledger">
                        ${rData.replacementLevelCutoff.toFixed(2)}M
                      </span>{' '}
                      displaced 51st contract per pick).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 font-mono-ledger text-[11px] bg-[#ede8dd]/70 px-3 py-2 border border-[#dfd9cc]">
                    <span>
                      League Cap{' '}
                      <strong>${rData.baseLeagueCap.toFixed(1)}M</strong>
                    </span>
                    <span>+</span>
                    <span>
                      Rollover{' '}
                      <strong className="text-[#2d5a43]">
                        ${rData.rolloverFromPriorYear.toFixed(1)}M
                      </strong>
                    </span>
                    <span>−</span>
                    <span>
                      Top-51 Active{' '}
                      <strong>${rData.activeTop51Cap.toFixed(1)}M</strong>
                    </span>
                    <span>−</span>
                    <span>
                      Dead{' '}
                      <strong className="text-[#b84a27]">
                        ${rData.deadMoneyTotal.toFixed(1)}M
                      </strong>
                    </span>
                    <span>−</span>
                    <span title={`Gross Rookie Pool: $${rData.rookiePoolReserve.toFixed(2)}M minus Top-51 displacement`}>
                      Net Rookies{' '}
                      <strong>${rData.netRookiePoolImpact.toFixed(2)}M</strong>
                    </span>
                    <span>=</span>
                    <span
                      className={`font-semibold ${
                        rData.effectiveCapSpace < 0
                          ? 'text-[#b84a27]'
                          : 'text-[#2d5a43]'
                      }`}
                    >
                      Spendable: {rData.effectiveCapSpace < 0 ? '−$' : '+$'}
                      {Math.abs(rData.effectiveCapSpace).toFixed(2)}M
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptYear(null)}
                      className="ml-2 text-[#8a8379] hover:text-[#1c1917] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </header>

    {/* FIXED BOTTOM MOBILE NAVIGATION BAR (iPhone & Pixel <768px) */}
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t-2 border-[#1c1917] bg-[#fcfaf6]/98 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(28,25,23,0.08)]"
    >
      <div className="grid grid-cols-5 divide-x divide-[#dfd9cc]">
        {[
          {
            id: 'player-fate' as const,
            step: '1',
            shortLabel: 'Roster Grid',
            subLabel: 'Home & Needs',
          },
          {
            id: 'cap-checkup' as const,
            step: '2',
            shortLabel: 'Cap Checkup',
            subLabel: 'Fix Space',
          },
          {
            id: 'free-agency' as const,
            step: '3',
            shortLabel: 'FA Market',
            subLabel: 'Sign Targets',
          },
          {
            id: 'draft' as const,
            step: '4',
            shortLabel: 'Trade/Draft',
            subLabel: 'Mock Picks',
          },
          {
            id: 'matrix' as const,
            step: '5',
            shortLabel: 'Full Ledger',
            subLabel: '4-Yr Table',
          },
        ].map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'matrix' && activeTab === 'predictor');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 text-center transition-colors ${
                isActive
                  ? 'bg-[#1c1917] text-[#f6f3ec]'
                  : 'text-[#1c1917] hover:bg-[#ede8dd]'
              }`}
            >
              <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                {item.shortLabel}
              </span>
              <span
                className={`mt-0.5 font-mono-ledger text-[8px] uppercase tracking-wider truncate max-w-full ${
                  isActive ? 'text-[#f6f3ec]/80' : 'text-[#8a8379]'
                }`}
              >
                {item.subLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}
