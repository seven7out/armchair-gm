'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  computeDerivedTeamCapState,
  DEFAULT_CAP_GROWTH_RATE,
  LEAGUE_YEARS,
} from '@/engine';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';

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
    setLedgerMode,
    setScenarioDrawerOpen,
    openFreeAgencyModal,
    resetScenarioStack,
  } = useGMStore();

  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);

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
    <header className="sticky top-0 z-30 border-b border-[#dfd9cc] bg-[#f6f3ec]/95 backdrop-blur-sm">
      {/* Masthead Row */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#dfd9cc]">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3">
            {baseTeam.logoUrl && (
              <img
                src={baseTeam.logoUrl}
                alt={`${baseTeam.city} ${baseTeam.name} logo`}
                className="h-8 w-8 object-contain"
              />
            )}
            <div>
              <span className="font-editorial text-2xl font-normal tracking-tight text-[#1c1917]">
                Armchair GM
              </span>
              <span className="ml-3 text-xs uppercase tracking-[0.14em] text-[#8a8379]">
                {baseTeam.city} {baseTeam.name} · OTC Live Ledger
              </span>
            </div>
          </div>

          {/* All-32 NFL Franchise Directory Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsDirectoryOpen((prev) => !prev)}
              aria-expanded={isDirectoryOpen}
              className="flex items-center gap-2 border border-[#1c1917] bg-[#fcfaf6] px-3 py-1.5 text-xs font-medium text-[#1c1917] hover:bg-[#ede8dd] transition-colors cursor-pointer"
            >
              {baseTeam.logoUrl && (
                <img
                  src={baseTeam.logoUrl}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>
                {baseTeam.city} {baseTeam.name} ({baseTeam.abbreviation})
              </span>
              <span className="text-[10px] text-[#8a8379]">
                · All 32 Clubs
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  isDirectoryOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Center Navigation Links — Clean Underline Tabs */}
        <nav className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.1em]">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#57534e] hover:text-[#1c1917]'
            }`}
          >
            01. Roster Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('predictor')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'predictor'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#57534e] hover:text-[#1c1917]'
            }`}
          >
            02. FA Predictor & Backtest
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('draft')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'draft'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#57534e] hover:text-[#1c1917]'
            }`}
          >
            03. Draft & Trade Desk
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('free-agency')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'free-agency'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#57534e] hover:text-[#1c1917]'
            }`}
          >
            04. Free Agency Market
          </button>
        </nav>

        {/* Right Controls: Cap vs Cash Toggle, Growth & Scenario Notebook */}
        <div className="flex items-center gap-3 text-xs">
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
            className="border border-[#1c1917] px-3 py-1.5 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
          >
            + Sign Free Agent
          </button>

          <button
            type="button"
            onClick={() => setScenarioDrawerOpen(true)}
            className="flex items-center gap-2 bg-[#1c1917] px-3.5 py-1.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
          >
            <span>Moves Notebook</span>
            <span className="font-mono-ledger text-[11px] opacity-80">
              [{enabledCount}/{transactions.length}]
            </span>
          </button>

          {transactions.length > 0 && (
            <button
              type="button"
              onClick={resetScenarioStack}
              title="Reset all simulated GM moves"
              className="p-1.5 text-[#57534e] hover:text-[#b84a27] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable All-32 NFL Club Directory (Grouped by Division) */}
      {isDirectoryOpen && (
        <div className="border-b-2 border-[#1c1917] bg-[#fcfaf6] shadow-lg">
          <div className="mx-auto max-w-[1440px] px-6 py-5">
            <div className="mb-3 flex items-baseline justify-between border-b border-[#dfd9cc] pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#57534e]">
                All 32 NFL Franchises · Live Over The Cap 2026–2029 Books
              </span>
              <button
                type="button"
                onClick={() => setIsDirectoryOpen(false)}
                className="text-xs text-[#8a8379] hover:text-[#1c1917] cursor-pointer"
              >
                Close Directory ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-8">
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

      {/* 4-Year Cap Horizon Strip — Open Newspaper Column Dividers */}
      <div className="mx-auto max-w-[1440px] px-6">
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
                      Cap ${yData.adjustedCapCeiling.toFixed(1)}M
                    </span>
                  </div>

                  {ledgerMode === 'CAP' ? (
                    <span
                      className={`font-mono-ledger text-base font-semibold ${
                        isOverCap ? 'text-[#b84a27]' : 'text-[#2d5a43]'
                      }`}
                    >
                      {isOverCap ? '−$' : '+$'}
                      {Math.abs(yData.effectiveCapSpace).toFixed(2)}M
                    </span>
                  ) : (
                    <span className="font-mono-ledger text-base font-semibold text-[#1c1917]">
                      Cash ${yData.totalCashSpend.toFixed(1)}M
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
                    Active ${yData.activeTop51Cap.toFixed(1)}M · Dead $
                    {yData.deadMoneyTotal.toFixed(1)}M
                  </span>
                  {year === 2026 ? (
                    <span className="text-[10px] text-[#8a8379]">
                      Comp Picks: {compSummary.netProjectedCompPicks.length} · Post-6/1:{' '}
                      <strong
                        className={
                          compSummary.postJune1DesignationsUsed > 2
                            ? 'text-[#b84a27]'
                            : ''
                        }
                      >
                        {compSummary.postJune1DesignationsUsed}/2
                      </strong>
                    </span>
                  ) : yData.rolloverFromPriorYear > 0 ? (
                    <span className="text-[#2d5a43]">
                      +${yData.rolloverFromPriorYear.toFixed(1)}M roll
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
      </div>
    </header>
  );
}
