'use client';

import React, { useMemo, useState } from 'react';
import {
  evaluateFreeAgentTarget,
  POSITIONAL_AGING_CURVES,
  scanRosterForCapCasualties,
} from '@/engine';
import { SEED_FREE_AGENTS } from '@/data/seed/freeAgents';
import { runHistoricalBacktestSuite } from '@/data/seed/historicalBacktest2026';
import { useGMStore } from '@/store/useGMStore';

export function PredictorBacktestLab() {
  const {
    derivedState,
    selectPlayer,
    setActiveTab,
    setFreeAgencyModalOpen,
  } = useGMStore();

  const [filterClass, setFilterClass] = useState<
    'ALL' | 'STREET_FA' | 'LIKELY_UFA' | 'TAG_TRAP'
  >('ALL');

  // 1. Run Historical Backtest Suite (2025-2026 Offseason Cohort)
  const backtest = useMemo(() => runHistoricalBacktestSuite(), []);

  // 2. Scan Current Team Roster for Cap Casualties
  const rosterScan = useMemo(
    () =>
      scanRosterForCapCasualties(
        derivedState.roster,
        derivedState.years[2026].effectiveCapSpace,
        2026
      ),
    [derivedState.roster, derivedState.years]
  );

  // 3. Evaluate External Free Agent Pool
  const evaluatedMarketPool = useMemo(() => {
    return SEED_FREE_AGENTS.map((fa) => ({
      fa,
      prediction: evaluateFreeAgentTarget(fa),
    })).filter((item) => {
      if (filterClass === 'STREET_FA') {
        return !item.prediction.countsTowardCompFormula;
      }
      if (filterClass === 'LIKELY_UFA') {
        return item.prediction.classification === 'LIKELY_UFA';
      }
      if (filterClass === 'TAG_TRAP') {
        return item.prediction.classification === 'TAG_OR_EXTEND_TRAP';
      }
      return true;
    });
  }, [filterClass]);

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8 space-y-14">
      {/* SECTION 1: Historical Backtest Lab (Did our engine predict the 2025/2026 Free Agent & Cap Casualty Class?) */}
      <div>
        <div className="mb-6 flex flex-col gap-4 border-b-2 border-[#1c1917] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#8a8379]">
              Model Validation & Backtesting
            </p>
            <h2 className="font-editorial mt-1 text-3xl text-[#1c1917]">
              2026 Free Agent & Cap Casualty Predictor Backtest
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm text-[#57534e] leading-relaxed">
              Traditional salary cap sites list every expiring contract as a
              &ldquo;Free Agent&rdquo; and ignore under-contract veterans who
              are about to be cut. We backtested our deterministic predictor
              using only <strong>January pre-offseason snapshots</strong>{' '}
              (incumbent cap space, Franchise Tag vs. market APY delta,
              unguaranteed base savings, and positional age cliffs) against
              actual NFL offseason outcomes.
            </p>
          </div>

          {/* Summary Scorecard Strip */}
          <div className="flex flex-wrap items-baseline gap-8 border-t lg:border-t-0 pt-4 lg:pt-0 border-[#dfd9cc]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                Overall Accuracy
              </div>
              <div className="font-mono-ledger text-2xl font-semibold text-[#2d5a43]">
                {backtest.accuracyPct.toFixed(1)}%{' '}
                <span className="text-xs font-normal text-[#8a8379]">
                  ({backtest.correctPredictions}/{backtest.totalCases})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                Street FA / Cut Recall
              </div>
              <div className="font-mono-ledger text-2xl font-semibold text-[#1c1917]">
                {backtest.streetFACapCasualtyRecallPct.toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                Tag / Re-Sign Trap Detection
              </div>
              <div className="font-mono-ledger text-2xl font-semibold text-[#b84a27]">
                {backtest.tagOrExtendPrecisionPct.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Backtest Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
              <tr>
                <th className="py-3 pr-4">Player / Club (Jan Snapshot)</th>
                <th className="py-3 px-4">Pre-Offseason Contract State</th>
                <th className="py-3 px-4">Engine Blind Prediction</th>
                <th className="py-3 px-4">Primary Cap & Aging Signals</th>
                <th className="py-3 px-4">Actual NFL Offseason Outcome</th>
                <th className="py-3 pl-4 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfd9cc]">
              {backtest.detailedResults.map(({ caseItem, predicted, isMatch }) => (
                <tr
                  key={caseItem.id}
                  className="hover:bg-[#fcfaf6] transition-colors"
                >
                  <td className="py-3.5 pr-4">
                    <div className="font-medium text-sm text-[#1c1917]">
                      {caseItem.playerName}
                    </div>
                    <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                      {caseItem.position} · {caseItem.incumbentTeam} · Age{' '}
                      {caseItem.input.age} (OVR {caseItem.input.overallRating})
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono-ledger text-[11px] text-[#57534e]">
                    {caseItem.input.originType === 'UNDER_CONTRACT_VETERAN' ? (
                      <>
                        <div>Under Contract (${caseItem.input.scheduledCapHit.toFixed(1)}M Hit)</div>
                        <div className="text-[#2d5a43]">
                          Cut Saves +${caseItem.input.netCutSavings.toFixed(1)}M
                        </div>
                      </>
                    ) : (
                      <>
                        <div>Expiring Contract</div>
                        <div className="text-[#8a8379]">
                          Tag: ${caseItem.input.franchiseTagCost.toFixed(1)}M vs Mkt: $
                          {caseItem.input.marketApy.toFixed(1)}M
                        </div>
                      </>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div
                      className={`font-semibold ${
                        predicted.classification === 'TAG_OR_EXTEND_TRAP'
                          ? 'text-[#b84a27]'
                          : !predicted.countsTowardCompFormula
                          ? 'text-[#2d5a43]'
                          : 'text-[#1c1917]'
                      }`}
                    >
                      {predicted.classificationBadge}
                    </div>
                    <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                      {predicted.availabilityProbability}% Market Availability ·{' '}
                      {predicted.compPickImpactLabel}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-[11px] text-[#57534e] max-w-xs">
                    <ul className="list-disc pl-3.5 space-y-0.5">
                      {predicted.primaryDrivers.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-[#1c1917] max-w-sm">
                    {caseItem.actualOutcomeSummary}
                  </td>

                  <td className="py-3.5 pl-4 text-right font-mono-ledger font-semibold">
                    {isMatch ? (
                      <span className="text-[#2d5a43]">✓ HIT</span>
                    ) : (
                      <span className="text-[#b84a27]">✗ MISS</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Live 2026 Open-Market & Street FA Cap Casualty Radar */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#dfd9cc] border-t-2 border-[#1c1917] pt-10">
        {/* Left 7 Cols: League-Wide Free Agent & Street FA Radar */}
        <div className="lg:col-span-7 lg:pr-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
            <div>
              <h3 className="font-editorial text-2xl text-[#1c1917]">
                League-Wide Free Agent & Street FA Radar
              </h3>
              <p className="text-xs text-[#57534e]">
                Filter by Street FAs (Projected Cap Casualties) to upgrade your
                roster without cancelling a 2027 Compensatory Pick.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {(
                [
                  { id: 'ALL', label: 'All Targets' },
                  { id: 'STREET_FA', label: 'Street FAs (Comp-Pick Safe)' },
                  { id: 'LIKELY_UFA', label: 'Likely UFAs' },
                  { id: 'TAG_TRAP', label: 'Tag / Re-Sign Traps' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterClass(tab.id)}
                  className={`pb-0.5 cursor-pointer ${
                    filterClass === tab.id
                      ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                      : 'text-[#8a8379] hover:text-[#1c1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#dfd9cc] border-t border-[#1c1917]">
            {evaluatedMarketPool.map(({ fa, prediction }) => {
              const curve = POSITIONAL_AGING_CURVES[fa.position];
              return (
                <div
                  key={fa.id}
                  className="py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-medium text-sm text-[#1c1917]">
                        {fa.name}
                      </span>
                      <span className="font-mono-ledger text-xs text-[#8a8379]">
                        {fa.position} · Age {fa.ageIn2026} (Cliff @{curve.cliffAge}) ·{' '}
                        {fa.previousTeam}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`font-semibold ${
                          prediction.classification === 'TAG_OR_EXTEND_TRAP'
                            ? 'text-[#b84a27]'
                            : !prediction.countsTowardCompFormula
                            ? 'text-[#2d5a43]'
                            : 'text-[#1c1917]'
                        }`}
                      >
                        {prediction.classificationBadge} (
                        {prediction.availabilityProbability}% Prob)
                      </span>
                      <span className="text-[#8a8379]">·</span>
                      <span
                        className={
                          !prediction.countsTowardCompFormula
                            ? 'font-medium text-[#2d5a43]'
                            : 'text-[#57534e]'
                        }
                      >
                        {prediction.compPickImpactLabel}
                      </span>
                    </div>

                    <p className="text-xs text-[#57534e]">
                      {prediction.primaryDrivers[0]}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right font-mono-ledger">
                      <div className="text-xs font-semibold text-[#1c1917]">
                        ~${fa.marketApy.toFixed(1)}M/yr
                      </div>
                      <div className="text-[10px] text-[#8a8379]">
                        {fa.marketYears} yrs · OVR {fa.overallRating}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFreeAgencyModalOpen(true)}
                      className="border border-[#1c1917] px-3 py-1.5 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                    >
                      Make Offer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: In-House Cap Casualty Scanner on Active Roster */}
        <div className="lg:col-span-5 pt-8 lg:pt-0 lg:pl-8">
          <h3 className="font-editorial text-2xl text-[#1c1917] mb-1">
            {derivedState.teamName} Cap Casualty Scanner
          </h3>
          <p className="text-xs text-[#57534e] mb-4">
            Automated scan of your current 2026 roster ranking veterans by release
            probability based on net cap savings vs. dead money and positional
            age cliffs.
          </p>

          <div className="divide-y divide-[#dfd9cc] border-t border-[#1c1917]">
            {rosterScan.map((item) => (
              <div
                key={item.player.id}
                className="py-3.5 flex items-baseline justify-between gap-4"
              >
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm text-[#1c1917]">
                      {item.player.name}
                    </span>
                    <span className="font-mono-ledger text-xs text-[#8a8379]">
                      ({item.player.position} · Age {item.player.ageIn2026})
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono-ledger text-[11px] text-[#57534e]">
                    2026 Hit: ${item.scheduledCapHit.toFixed(2)}M · Pre-6/1 Saves:{' '}
                    <span className="text-[#2d5a43] font-semibold">
                      +${item.preJuneSavings.toFixed(2)}M
                    </span>{' '}
                    · Post-6/1 Saves:{' '}
                    <span className="text-[#2d5a43] font-semibold">
                      +${item.postJuneSavings.toFixed(2)}M
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8a8379]">
                    {item.prediction.primaryDrivers[0]}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`font-mono-ledger text-xs font-semibold ${
                      item.prediction.availabilityProbability >= 55
                        ? 'text-[#b84a27]'
                        : 'text-[#57534e]'
                    }`}
                  >
                    {item.prediction.availabilityProbability}% Cut Score
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      selectPlayer(item.player.id);
                      setActiveTab('matrix');
                    }}
                    className="mt-1 text-xs underline decoration-[#c7bfb0] underline-offset-4 text-[#1c1917] hover:text-[#b84a27] cursor-pointer"
                  >
                    Inspect →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
