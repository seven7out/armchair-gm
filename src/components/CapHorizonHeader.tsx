'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  PlusCircle,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
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
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-md shadow-2xl">
      {/* Top Bar: Brand, Team Archetype Switcher, Navigation Tabs, & Scenario Stack Trigger */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 border-b border-slate-800/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg font-black text-white shadow-inner text-sm tracking-tighter"
              style={{ backgroundColor: baseTeam.primaryColor }}
            >
              {baseTeam.abbreviation}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  ARMCHAIR GM
                </h1>
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                  2026–2029 Cap Horizon
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {baseTeam.city} {baseTeam.name} •{' '}
                <span className="text-slate-300 font-medium">
                  {baseTeam.archetypeLabel}
                </span>
              </p>
            </div>
          </div>

          {/* Selectable NFL Front-Office Archetypes */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
            {Object.values(SEED_TEAMS).map((team) => {
              const isSelected = team.id === selectedTeamId;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => selectTeam(team.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={team.archetypeDescription}
                >
                  {team.abbreviation}{' '}
                  <span className="hidden md:inline font-normal text-[11px] text-slate-400">
                    ({team.id === 'DET' ? 'Contender' : team.id === 'WAS' ? 'Rookie QB' : 'Cap Purgatory'})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Roster Horizon Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('draft')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'draft'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Draft & Trade Sandbox
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('free-agency')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'free-agency'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Free Agency & Extensions
          </button>
        </nav>

        {/* Right Controls: Sign FA Quick Action, Cap Growth Config, Scenario Stack Drawer */}
        <div className="flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 border border-slate-800 text-xs text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>Cap Growth:</span>
            <select
              aria-label="Annual League Cap Growth Rate"
              value={capGrowthRate}
              onChange={(e) => setCapGrowthRate(parseFloat(e.target.value))}
              className="bg-transparent font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={0.05} className="bg-slate-900">5.0% / yr (Conservative)</option>
              <option value={0.075} className="bg-slate-900">7.5% / yr (Consensus)</option>
              <option value={0.09} className="bg-slate-900">9.0% / yr (Media Boom)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setFreeAgencyModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Sign FA / Offer Builder</span>
          </button>

          <button
            type="button"
            onClick={() => setScenarioDrawerOpen(true)}
            className="relative flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span>Scenario Stack</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                enabledCount > 0
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {enabledCount}/{transactions.length}
            </span>
          </button>

          {transactions.length > 0 && (
            <button
              type="button"
              onClick={resetScenarioStack}
              title="Reset all simulated GM moves"
              className="rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-700/60 p-1.5 text-slate-400 hover:text-rose-300 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4-Year Cap Horizon Grid (2026, 2027, 2028, 2029) */}
      <div className="mx-auto max-w-[1600px] px-4 py-2.5 sm:px-6">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {LEAGUE_YEARS.map((year) => {
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
            const rookiePct = Math.min(
              100 - activePct - deadPct,
              (yData.netRookiePoolImpact / yData.adjustedCapCeiling) * 100
            );

            return (
              <div
                key={year}
                className={`rounded-xl border p-3 transition-colors ${
                  isOverCap
                    ? 'border-rose-500/60 bg-rose-950/25 shadow-[0_0_20px_rgba(244,63,94,0.12)]'
                    : 'border-slate-800/90 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{year}</span>
                    <span className="text-[11px] text-slate-400">
                      Ceil: ${yData.adjustedCapCeiling.toFixed(1)}M
                    </span>
                    {yData.rolloverFromPriorYear > 0 && (
                      <span
                        className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20"
                        title={`Includes $${yData.rolloverFromPriorYear.toFixed(1)}M rollover from ${year - 1}`}
                      >
                        +${yData.rolloverFromPriorYear.toFixed(1)}M Roll
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isOverCap ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span
                      className={`text-sm font-black tracking-tight ${
                        isOverCap ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {isOverCap ? '' : '+'}
                      ${yData.effectiveCapSpace.toFixed(2)}M
                    </span>
                  </div>
                </div>

                {/* Animated Stacked Bar: Active Top-51 vs Dead Money vs Rookie Reserve */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="flex h-full w-full">
                    <motion.div
                      className={`${
                        isOverCap ? 'bg-rose-500' : 'bg-indigo-500'
                      } h-full`}
                      initial={false}
                      animate={{ width: `${activePct}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                      title={`Active Top-51 Cap: $${yData.activeTop51Cap.toFixed(2)}M`}
                    />
                    <motion.div
                      className="bg-amber-500 h-full"
                      initial={false}
                      animate={{ width: `${deadPct}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                      title={`Dead Cap: $${yData.deadMoneyTotal.toFixed(2)}M`}
                    />
                    <motion.div
                      className="bg-teal-400 h-full"
                      initial={false}
                      animate={{ width: `${rookiePct}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                      title={`Net Rookie Pool Impact: $${yData.netRookiePoolImpact.toFixed(2)}M`}
                    />
                  </div>
                </div>

                {/* Breakdown Footer */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isOverCap ? 'bg-rose-500' : 'bg-indigo-500'
                        }`}
                      />
                      Active: <strong className="text-slate-200">${yData.activeTop51Cap.toFixed(1)}M</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Dead: <strong className="text-amber-300">${yData.deadMoneyTotal.toFixed(1)}M</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {yData.activeRosterCount} signed
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
