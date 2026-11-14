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
    baselineState,
    derivedState,
    activeTab,
    ledgerMode,
    selectTeam,
    setCapGrowthRate,
    setActiveTab,
    openInTeamBuilder,
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
  const isCurrentStateMode = activeTab === 'player-fate';
  const displayCapState = isCurrentStateMode ? baselineState : derivedState;
  const compSummary = displayCapState.compPickSummary;

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

          {/* Center Navigation — 2 Primary Modes Switcher (Desktop md+) */}
          <nav
            aria-label="Primary Modes"
            className="hidden md:flex items-center border-2 border-[#111827] bg-white p-0.5"
          >
            <button
              type="button"
              onClick={() => setActiveTab('player-fate')}
              className={`flex flex-col items-start px-3.5 py-1.5 text-left transition-colors cursor-pointer ${
                isCurrentStateMode
                  ? 'bg-[#1e3a5f] text-white'
                  : 'text-[#111827] hover:bg-[#f1f5f9]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold tracking-tight">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono-ledger text-xs ${
                    isCurrentStateMode
                      ? 'bg-white text-[#1e3a5f]'
                      : 'bg-[#e2e8f0] text-[#334155]'
                  }`}
                >
                  1
                </span>
                <span>Roster Grid &amp; Needs</span>
              </div>
              <span
                className={`text-[11px] font-medium tracking-[0.02em] ${
                  isCurrentStateMode ? 'text-[#e2e8f0]' : 'text-[#475569]'
                }`}
              >
                Current State (2026–2031)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'team-builder') {
                  setActiveTab('team-builder');
                }
              }}
              className={`flex flex-col items-start px-3.5 py-1.5 text-left transition-colors cursor-pointer border-l border-[#d6d0c4] ${
                !isCurrentStateMode
                  ? 'bg-[#15803d] text-white'
                  : 'text-[#111827] hover:bg-[#f1f5f9]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold tracking-tight">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono-ledger text-xs ${
                    !isCurrentStateMode
                      ? 'bg-white text-[#15803d]'
                      : 'bg-[#dcfce7] text-[#15803d]'
                  }`}
                >
                  2
                </span>
                <span>Team Builder</span>
                {enabledCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold ${
                      !isCurrentStateMode
                        ? 'bg-white text-[#15803d]'
                        : 'bg-[#15803d] text-white'
                    }`}
                  >
                    {enabledCount} Move{enabledCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-medium tracking-[0.02em] ${
                  !isCurrentStateMode ? 'text-[#dcfce7]' : 'text-[#475569]'
                }`}
              >
                Modify Roster, Add FAs, Trade &amp; Project Cap
              </span>
            </button>
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
              onClick={() => {
                if (isCurrentStateMode) {
                  openInTeamBuilder({ subTab: 'fa-dock' });
                }
                openFreeAgencyModal({ position: 'ALL' });
              }}
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
        <div className="md:hidden px-3 py-2 bg-white border-b border-[#d6d0c4]">
          <div className="grid grid-cols-5 items-center gap-1.5">
            {LEAGUE_YEARS.map((year) => {
              const yData = displayCapState.years[year];
              const isOverCap = yData.effectiveCapSpace < 0;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setShowMobileCapDetails(true);
                    setReceiptYear((prev) => (prev === year ? null : year));
                  }}
                  className="flex flex-col items-center border border-[#d6d0c4] bg-[#f7f5f0] py-1.5 px-1 text-center"
                >
                  <span className="font-mono-ledger text-[11px] font-semibold text-[#334155]">
                    &apos;{String(year).slice(2)}{' '}
                    {isCurrentStateMode ? 'Now' : 'Proj'}
                  </span>
                  <span
                    className={`font-mono-ledger text-xs font-bold ${
                      isOverCap ? 'text-[#b91c1c]' : 'text-[#15803d]'
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
              className="flex flex-col items-center justify-center h-full border border-[#111827] bg-[#1e3a5f] py-1.5 px-1 text-[11px] font-semibold text-white"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3">
          {LEAGUE_YEARS.map((year) => {
            const yData = displayCapState.years[year];
            const baseYearData = baselineState.years[year];
            const deltaVsCurrent =
              Math.round(
                (yData.effectiveCapSpace - baseYearData.effectiveCapSpace) * 100
              ) / 100;
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
                className="border border-[#d6d0c4] bg-white px-4 py-3 shadow-2xs"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-editorial text-xl font-bold text-[#111827]">
                      {year}
                    </span>
                    <span className="font-mono-ledger text-xs font-medium text-[#475569]">
                      <JargonTip term="ADJUSTED_CAP">
                        Limit ${yData.adjustedCapCeiling.toFixed(1)}M
                      </JargonTip>
                    </span>
                  </div>

                  {ledgerMode === 'CAP' ? (
                    <div className="text-right shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptYear((prev) => (prev === year ? null : year))
                        }
                        title="Click to see exact Spendable Now math receipt & why sites disagree"
                        className={`font-mono-ledger text-lg sm:text-xl font-bold underline decoration-dotted underline-offset-4 cursor-pointer ${
                          isOverCap ? 'text-[#b91c1c]' : 'text-[#15803d]'
                        }`}
                      >
                        {isOverCap ? '−$' : '+$'}
                        {Math.abs(yData.effectiveCapSpace).toFixed(2)}M
                      </button>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#475569]">
                        {isReceiptOpen
                          ? 'Hide Receipt ▲'
                          : isCurrentStateMode
                          ? 'Current Space ▼'
                          : 'Projected Space ▼'}
                      </div>
                      {!isCurrentStateMode &&
                        enabledCount > 0 &&
                        Math.abs(deltaVsCurrent) >= 0.05 && (
                          <div
                            className={`mt-0.5 font-mono-ledger text-[11px] font-semibold ${
                              deltaVsCurrent >= 0
                                ? 'text-[#15803d]'
                                : 'text-[#b91c1c]'
                            }`}
                          >
                            Was {baseYearData.effectiveCapSpace >= 0 ? '+$' : '−$'}
                            {Math.abs(baseYearData.effectiveCapSpace).toFixed(1)}M
                            {' ('}Δ {deltaVsCurrent >= 0 ? '+' : '−'}$
                            {Math.abs(deltaVsCurrent).toFixed(1)}M{')'}
                          </div>
                        )}
                    </div>
                  ) : (
                    <span className="font-mono-ledger text-lg font-bold text-[#111827]">
                      <JargonTip term="CASH_SPEND">
                        Cash ${yData.totalCashSpend.toFixed(1)}M
                      </JargonTip>
                    </span>
                  )}
                </div>

                {/* Single hairline progress rule */}
                <div className="mt-2 h-2 w-full bg-[#e2e8f0] rounded-xs overflow-hidden flex">
                  <motion.div
                    className={`h-full ${
                      isOverCap ? 'bg-[#b91c1c]' : 'bg-[#1e3a5f]'
                    }`}
                    initial={false}
                    animate={{ width: `${activePct}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  />
                  <motion.div
                    className="h-full bg-[#d97706]"
                    initial={false}
                    animate={{ width: `${deadPct}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 font-mono-ledger text-xs font-medium text-[#334155]">
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
                    <span className="text-[11px] font-semibold text-[#475569]">
                      <JargonTip term="COMP_PICK">
                        Comp: {compSummary.netProjectedCompPicks.length}
                      </JargonTip>{' '}
                      ·{' '}
                      <JargonTip term="POST_JUNE_1_DESIGNATION">
                        Post-6/1:{' '}
                        <strong
                          className={
                            compSummary.postJune1DesignationsUsed > 2
                              ? 'text-[#b91c1c]'
                              : ''
                          }
                        >
                          {compSummary.postJune1DesignationsUsed}/2
                        </strong>
                      </JargonTip>
                    </span>
                  ) : yData.rolloverFromPriorYear > 0 ? (
                    <span className="text-[#15803d] font-semibold">
                      <JargonTip term="ROLLOVER">
                        +${yData.rolloverFromPriorYear.toFixed(1)}M roll
                      </JargonTip>
                    </span>
                  ) : (
                    <span className="text-[#475569]">
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
          <div className="border border-[#d6d0c4] bg-white py-3.5 px-4 mb-3 text-sm shadow-2xs">
            {(() => {
              const rData = displayCapState.years[receiptYear];
              const rawCapSpaceBeforeRookies =
                rData.adjustedCapCeiling -
                rData.activeTop51Cap -
                rData.deadMoneyTotal;
              return (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.1em] text-[#475569]">
                      {receiptYear} Exact Cap Accounting Receipt · Why Sites Disagree
                    </div>
                    <p className="mt-1 text-xs text-[#334155]">
                      Basic cap trackers show{' '}
                      <strong className="font-mono-ledger text-[#111827]">
                        {rawCapSpaceBeforeRookies >= 0 ? '+$' : '−$'}
                        {Math.abs(rawCapSpaceBeforeRookies).toFixed(2)}M
                      </strong>{' '}
                      (Raw Top-51 Space). True{' '}
                      <strong className="text-[#15803d]">Spendable Now</strong>{' '}
                      subtracts the net rookie class reserve (gross rookie pool
                      minus{' '}
                      <span className="font-mono-ledger">
                        ${rData.replacementLevelCutoff.toFixed(2)}M
                      </span>{' '}
                      displaced 51st contract per pick).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 font-mono-ledger text-xs bg-[#f1f5f9] px-3 py-2 border border-[#cbd5e1] text-[#111827]">
                    <span>
                      League Cap{' '}
                      <strong>${rData.baseLeagueCap.toFixed(1)}M</strong>
                    </span>
                    <span>+</span>
                    <span>
                      Rollover{' '}
                      <strong className="text-[#15803d]">
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
                      <strong className="text-[#b91c1c]">
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
                      className={`font-bold ${
                        rData.effectiveCapSpace < 0
                          ? 'text-[#b91c1c]'
                          : 'text-[#15803d]'
                      }`}
                    >
                      Spendable: {rData.effectiveCapSpace < 0 ? '−$' : '+$'}
                      {Math.abs(rData.effectiveCapSpace).toFixed(2)}M
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptYear(null)}
                      className="ml-2 text-[#475569] hover:text-[#111827] cursor-pointer"
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

    {/* FIXED BOTTOM MOBILE NAVIGATION BAR (iPhone & Pixel <768px) — 2 Primary Modes */}
    <nav
      aria-label="Mobile Primary Mode Switcher"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t-2 border-[#111827] bg-white/98 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(17,24,39,0.1)]"
    >
      <div className="grid grid-cols-2 divide-x divide-[#d6d0c4]">
        <button
          type="button"
          onClick={() => setActiveTab('player-fate')}
          className={`flex flex-col items-center justify-center py-2.5 px-2 text-center transition-colors ${
            isCurrentStateMode
              ? 'bg-[#1e3a5f] text-white'
              : 'text-[#111827] hover:bg-[#f1f5f9]'
          }`}
        >
          <span className="text-xs sm:text-sm font-bold leading-tight">
            1. Roster Grid &amp; Needs
          </span>
          <span
            className={`mt-0.5 font-mono-ledger text-[11px] font-medium tracking-wide ${
              isCurrentStateMode ? 'text-[#e2e8f0]' : 'text-[#475569]'
            }`}
          >
            Current State
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeTab !== 'team-builder') {
              setActiveTab('team-builder');
            }
          }}
          className={`flex flex-col items-center justify-center py-2.5 px-2 text-center transition-colors ${
            !isCurrentStateMode
              ? 'bg-[#15803d] text-white'
              : 'text-[#111827] hover:bg-[#f1f5f9]'
          }`}
        >
          <span className="text-xs sm:text-sm font-bold leading-tight">
            2. Team Builder
            {enabledCount > 0 ? ` (${enabledCount})` : ''}
          </span>
          <span
            className={`mt-0.5 font-mono-ledger text-[11px] font-medium tracking-wide ${
              !isCurrentStateMode ? 'text-[#dcfce7]' : 'text-[#15803d]'
            }`}
          >
            Modify &amp; Project
          </span>
        </button>
      </div>
    </nav>
    </>
  );
}
