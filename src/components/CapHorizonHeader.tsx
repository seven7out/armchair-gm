'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { LEAGUE_YEARS } from '@/engine';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';

export function CapHorizonHeader() {
  const {
    selectedTeamId,
    baseTeam,
    capGrowthRate,
    transactions,
    derivedState,
    activeTab,
    selectTeam,
    setCapGrowthRate,
    setActiveTab,
    setScenarioDrawerOpen,
    setFreeAgencyModalOpen,
    resetScenarioStack,
  } = useGMStore();

  const enabledCount = transactions.filter((t) => t.enabled).length;

  return (
    <header className="sticky top-0 z-30 border-b border-[#dfd9cc] bg-[#f6f3ec]/95 backdrop-blur-sm">
      {/* Masthead Row */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-baseline justify-between gap-4 px-6 py-4 border-b border-[#dfd9cc]">
        <div className="flex flex-wrap items-baseline gap-6">
          <div>
            <span className="font-editorial text-2xl font-normal tracking-tight text-[#1c1917]">
              Armchair GM
            </span>
            <span className="ml-3 text-xs uppercase tracking-[0.14em] text-[#8a8379]">
              Front Office Ledger • {baseTeam.city} {baseTeam.name}
            </span>
          </div>

          {/* Minimalist Editorial Franchise Switcher */}
          <div className="flex items-center gap-4 text-xs">
            <span className="uppercase tracking-[0.12em] text-[#8a8379]">
              Book:
            </span>
            {Object.values(SEED_TEAMS).map((team) => {
              const isSelected = team.id === selectedTeamId;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => selectTeam(team.id)}
                  className={`pb-0.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                      : 'text-[#8a8379] hover:text-[#1c1917]'
                  }`}
                  title={team.archetypeDescription}
                >
                  {team.city}{' '}
                  <span className="font-mono-ledger text-[11px] opacity-75">
                    ({team.abbreviation})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Navigation Links — Clean Underline Tabs */}
        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.1em]">
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
            onClick={() => setActiveTab('draft')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'draft'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#57534e] hover:text-[#1c1917]'
            }`}
          >
            02. Draft & Trade Desk
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
            03. Free Agency Market
          </button>
        </nav>

        {/* Right Controls: Cap Growth & Scenario Notebook */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden xl:flex items-center gap-1.5 text-[#57534e]">
            <span className="uppercase tracking-[0.1em] text-[10px] text-[#8a8379]">
              Growth:
            </span>
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
            onClick={() => setFreeAgencyModalOpen(true)}
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

      {/* 4-Year Cap Horizon Strip — Open Newspaper Column Dividers (No Boxes) */}
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
                className={`py-3.5 ${
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

                  <span
                    className={`font-mono-ledger text-base font-semibold ${
                      isOverCap ? 'text-[#b84a27]' : 'text-[#2d5a43]'
                    }`}
                  >
                    {isOverCap ? '−$' : '+$'}
                    {Math.abs(yData.effectiveCapSpace).toFixed(2)}M
                  </span>
                </div>

                {/* Ultra-clean single hairline progress rule */}
                <div className="mt-2 h-1.5 w-full bg-[#e5dfd3] overflow-hidden flex">
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
                  {yData.rolloverFromPriorYear > 0 ? (
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
