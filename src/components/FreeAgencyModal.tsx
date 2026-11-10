'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  buildStructuredContract,
  computeRealContractXRay,
  ContractStructureTemplate,
  createSignedFreeAgentPlayer,
  evaluateFreeAgentTarget,
  evaluatePlayerLongevity,
  FreeAgentTarget,
  getContractYearCash,
  LEAGUE_YEARS,
  POSITION_GROUPS,
  POSITIONAL_AGING_CURVES,
  POSITIONAL_MARKET_COMPS,
  PositionGroup,
} from '@/engine';
import {
  getLeagueWideFreeAgentPool,
  SEED_FREE_AGENTS,
} from '@/data/seed/freeAgents';
import { useGMStore } from '@/store/useGMStore';
import { JargonTip } from './JargonTooltip';
import { PlayerAvatar } from './PlayerAvatar';

export function FreeAgencySimulatorView({
  isModal = false,
}: {
  isModal?: boolean;
}) {
  const {
    derivedState,
    preselectedFreeAgentId,
    freeAgencyPositionFilter,
    addSignFATransaction,
    selectPlayer,
    setActiveTab,
  } = useGMStore();

  const fullPool = useMemo(
    () => getLeagueWideFreeAgentPool(derivedState.teamId),
    [derivedState.teamId]
  );

  const [posFilter, setPosFilter] = useState<PositionGroup | 'ALL'>(
    freeAgencyPositionFilter
  );
  const [faSearch, setFaSearch] = useState<string>('');
  const [selectedFA, setSelectedFA] = useState<FreeAgentTarget>(
    SEED_FREE_AGENTS[0]
  );
  const [years, setYears] = useState<number>(SEED_FREE_AGENTS[0].marketYears);
  const [apy, setApy] = useState<number>(SEED_FREE_AGENTS[0].marketApy);
  const [guaranteedPct, setGuaranteedPct] = useState<number>(
    SEED_FREE_AGENTS[0].marketGuaranteedPct
  );
  const [structure, setStructure] =
    useState<ContractStructureTemplate>('Backloaded');
  const [showCompChart, setShowCompChart] = useState<boolean>(false);

  const apySliderId = useId();

  const handleSelectFA = (fa: FreeAgentTarget) => {
    setSelectedFA(fa);
    setYears(fa.marketYears);
    setApy(fa.marketApy);
    setGuaranteedPct(fa.marketGuaranteedPct);
  };

  useEffect(() => {
    setPosFilter(freeAgencyPositionFilter);
    if (preselectedFreeAgentId) {
      const match = fullPool.find((f) => f.id === preselectedFreeAgentId);
      if (match) {
        handleSelectFA(match);
        return;
      }
    }
    if (freeAgencyPositionFilter !== 'ALL') {
      const firstAtPos = fullPool.find(
        (f) => f.position === freeAgencyPositionFilter
      );
      if (firstAtPos) {
        handleSelectFA(firstAtPos);
      }
    }
  }, [preselectedFreeAgentId, freeAgencyPositionFilter, fullPool]);

  const filteredPool = useMemo(() => {
    return fullPool.filter((fa) => {
      if (posFilter !== 'ALL' && fa.position !== posFilter) return false;
      if (
        faSearch.trim() !== '' &&
        !fa.name.toLowerCase().includes(faSearch.toLowerCase()) &&
        !fa.previousTeam.toLowerCase().includes(faSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [fullPool, posFilter, faSearch]);

  const offer = useMemo(
    () =>
      buildStructuredContract(
        2026,
        years,
        apy,
        guaranteedPct,
        structure,
        selectedFA.accruedSeasons
      ),
    [years, apy, guaranteedPct, structure, selectedFA.accruedSeasons]
  );

  const inHouseExpiringPlayers = useMemo(() => {
    return derivedState.roster
      .filter((p) => {
        const c26 = p.contractYears[2026];
        const c27 = p.contractYears[2027];
        return c26 && !c26.isVoidYear && (!c27 || c27.isVoidYear);
      })
      .sort((a, b) => b.overallRating - a.overallRating);
  }, [derivedState.roster]);

  const replacementCutoff = derivedState.years[2026].replacementLevelCutoff;
  const net2026Impact = Math.max(0, offer.capHitsByYear[2026] - replacementCutoff);
  const curve = POSITIONAL_AGING_CURVES[selectedFA.position];
  const selectedPrediction = evaluateFreeAgentTarget(selectedFA);
  const marketComps = POSITIONAL_MARKET_COMPS[selectedFA.position] ?? [];
  const compSummary = derivedState.compPickSummary;

  const offerXRay = useMemo(() => {
    const tempPlayer = createSignedFreeAgentPlayer(
      selectedFA,
      2026,
      years,
      apy,
      guaranteedPct,
      structure
    );
    return computeRealContractXRay(tempPlayer);
  }, [selectedFA, years, apy, guaranteedPct, structure]);

  // Determine exact Comp Pick Cancellation pairing & what signing `selectedFA` would cancel
  const compCancellationPairs = useMemo(() => {
    const losses = [...compSummary.cfaQualifyingLosses].sort(
      (a, b) => b.estApy - a.estApy
    );
    const signings = [...compSummary.cfaQualifyingSignings].sort(
      (a, b) => b.apy - a.apy
    );
    return losses.map((loss, idx) => ({
      loss,
      canceledBy: signings[idx] ?? null,
    }));
  }, [compSummary]);

  const nextUncanceledLoss = compCancellationPairs.find(
    (p) => p.canceledBy === null
  )?.loss;

  return (
    <div className={isModal ? 'p-7' : 'mx-auto max-w-[1440px] px-6 py-8 space-y-6'}>
      {!isModal && (
        <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8379]">
            Journey 03 · 2026 Free Agency Market &amp; Comp-Pick Guard
          </span>
          <h1 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
            Who Can We Sign in Free Agency — And Will It Cancel a 2027 Comp Pick?
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
            <strong>Step 1:</strong> Pick an available Free Agent or Street Cap
            Casualty on the left. <strong>Step 2:</strong> Customize your offer
            on the right and check whether signing them is{' '}
            <span className="font-semibold text-[#2d5a43]">
              Comp-Pick Safe (Cut Player)
            </span>{' '}
            or cancels out one of your departing 2027 draft picks.
          </p>
        </section>
      )}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#dfd9cc]">
        {/* Left 5 Cols: Open Market Index + Comp Pick Cancellation Ledger */}
        <div className="lg:col-span-5 lg:pr-8 space-y-6">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                League-Wide Open Market &amp; Street FA Pool ({filteredPool.length})
              </h3>
              <span className="font-mono-ledger text-[10px] text-[#2d5a43]">
                <JargonTip term="COMP_PICK">
                  2027 Comp Picks: {compSummary.netProjectedCompPicks.length}
                </JargonTip>
              </span>
            </div>

            {/* Position Filter Strip + Search inside FA Pool */}
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
                <input
                  type="search"
                  value={faSearch}
                  onChange={(e) => setFaSearch(e.target.value)}
                  placeholder="Search free agent or team..."
                  aria-label="Search free agent or team"
                  className="w-full border-b border-[#c7bfb0] bg-transparent py-1 pl-7 pr-2 text-xs text-[#1c1917] placeholder-[#8a8379] focus:border-[#1c1917] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPosFilter('ALL')}
                  className={`px-1.5 py-0.5 cursor-pointer ${
                    posFilter === 'ALL'
                      ? 'bg-[#1c1917] text-[#f6f3ec] font-medium'
                      : 'text-[#57534e] hover:text-[#1c1917]'
                  }`}
                >
                  All
                </button>
                {POSITION_GROUPS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPosFilter(pos)}
                    className={`px-1.5 py-0.5 cursor-pointer ${
                      posFilter === pos
                        ? 'bg-[#1c1917] text-[#f6f3ec] font-medium'
                        : 'text-[#57534e] hover:text-[#1c1917]'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#dfd9cc] border-t border-[#dfd9cc] max-h-[320px] overflow-y-auto">
              {filteredPool.map((fa) => {
                const isSelected = selectedFA.id === fa.id;
                const pred = evaluateFreeAgentTarget(fa);
                return (
                  <button
                    key={fa.id}
                    type="button"
                    onClick={() => handleSelectFA(fa)}
                    className={`w-full py-3 px-2.5 text-left transition-colors cursor-pointer flex items-center gap-3 ${
                      isSelected ? 'bg-[#ede8dd]' : 'hover:bg-[#fcfaf6]'
                    }`}
                  >
                    <PlayerAvatar
                      name={fa.name}
                      headshotUrl={fa.headshotUrl}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="font-medium text-sm text-[#1c1917]">
                            {fa.name}
                          </span>{' '}
                          <span className="text-xs text-[#8a8379]">
                            ({fa.position} · Age {fa.ageIn2026})
                          </span>
                        </div>
                        <span className="font-mono-ledger text-xs font-semibold text-[#1c1917]">
                          ~${fa.marketApy.toFixed(1)}M/yr
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between text-[11px]">
                        <span
                          className={
                            pred.classification === 'TAG_OR_EXTEND_TRAP'
                              ? 'text-[#b84a27] font-medium'
                              : !pred.countsTowardCompFormula
                              ? 'text-[#2d5a43] font-medium'
                              : 'text-[#57534e]'
                          }
                        >
                          {pred.classificationBadge} ({pred.availabilityProbability}% Prob)
                        </span>
                        <span
                          className={`font-mono-ledger text-[10px] ${
                            !pred.countsTowardCompFormula
                              ? 'text-[#2d5a43] font-semibold'
                              : 'text-[#b84a27]'
                          }`}
                        >
                          {!pred.countsTowardCompFormula
                            ? '✓ Comp-Pick Safe (Cut)'
                            : '⚠ Cancels Comp Pick'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* LIVE COMPENSATORY PICK CANCELLATION LEDGER (Progressive Disclosure) */}
          <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-3.5 space-y-2.5 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                <JargonTip term="CFA_CANCELLATION">
                  2027 Comp Pick Impact Check
                </JargonTip>
              </span>
              <button
                type="button"
                onClick={() => setShowCompChart((prev) => !prev)}
                className="font-mono-ledger text-[10px] font-semibold text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4 cursor-pointer"
              >
                {showCompChart
                  ? 'Hide Cancellation Chart ▲'
                  : `View All ${compCancellationPairs.length} Comp-Pick Pairs ▼`}
              </button>
            </div>

            {/* Live Pre-Commit Warning for Selected FA (Shown First) */}
            {!selectedPrediction.countsTowardCompFormula ? (
              <div className="text-[11px] text-[#2d5a43]">
                <strong>✓ Safe Signing Stamp:</strong> {selectedFA.name} is a
                projected Cap Casualty (
                <JargonTip term="STREET_FREE_AGENT">Street FA</JargonTip>).
                Signing him will <strong>NOT</strong> cancel any of your{' '}
                {compSummary.netProjectedCompPicks.length} projected comp picks.
              </div>
            ) : nextUncanceledLoss ? (
              <div className="text-[11px] text-[#b84a27]">
                <strong>⚠ CFA Cancellation Warning:</strong> Signing{' '}
                {selectedFA.name} (qualifying UFA) will pair with{' '}
                <strong>{nextUncanceledLoss.name}</strong> and erase your
                projected{' '}
                <strong>2027 Round {nextUncanceledLoss.projectedRound}</strong>{' '}
                compensatory pick.
              </div>
            ) : (
              <div className="text-[11px] text-[#57534e]">
                All departing CFA comp picks are already canceled out, so
                signing {selectedFA.name} costs no additional comp picks.
              </div>
            )}

            {showCompChart && (
              <div className="divide-y divide-[#dfd9cc] border-t border-[#dfd9cc] pt-2 font-mono-ledger text-[11px]">
                {compCancellationPairs.map(({ loss, canceledBy }, idx) => (
                  <div
                    key={`${loss.name}-${idx}`}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div>
                      <span className="text-[#1c1917]">
                        Lost: {loss.name} ({loss.position})
                      </span>{' '}
                      <span className="text-[10px] text-[#8a8379]">
                        ~${loss.estApy.toFixed(1)}M → Rd {loss.projectedRound}
                      </span>
                    </div>
                    {canceledBy ? (
                      <span className="text-[#b84a27] line-through">
                        Erased by {canceledBy.name}
                      </span>
                    ) : (
                      <span className="font-semibold text-[#2d5a43]">
                        Active: 2027 Rd {loss.projectedRound} Pick
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8379] mb-2">
              In-House Expiring Contracts (Re-Signings Never Cancel Comp Picks)
            </h3>
            <div className="divide-y divide-[#dfd9cc] border-t border-[#dfd9cc] max-h-40 overflow-y-auto">
              {inHouseExpiringPlayers.map((p) => {
                const lon = evaluatePlayerLongevity(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-baseline justify-between py-2.5 px-2 text-xs"
                  >
                    <div>
                      <span className="font-medium text-[#1c1917]">
                        {p.name}
                      </span>{' '}
                      <span className="text-[#8a8379]">
                        ({p.position} · Age {p.ageIn2026})
                      </span>
                      <div className="text-[10px] text-[#2d5a43]">
                        {lon.extensionRecommendation}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectPlayer(p.id, 'extend')}
                      className="underline decoration-[#c7bfb0] underline-offset-4 text-[#1c1917] hover:text-[#2d5a43] cursor-pointer"
                    >
                      Extend / Tag →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Contract Term Sheet */}
        <div className="lg:col-span-7 pt-8 lg:pt-0 lg:pl-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#dfd9cc] pb-5">
            <div className="flex items-start gap-4 flex-1">
              <PlayerAvatar
                name={selectedFA.name}
                headshotUrl={selectedFA.headshotUrl}
                size="lg"
              />
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-[#8a8379]">
                  Contract Offer Sheet · {selectedFA.position} · Age{' '}
                  {selectedFA.ageIn2026} · {selectedFA.previousTeam}
                </div>
                <h2 className="font-editorial mt-1 text-3xl text-[#1c1917]">
                  {selectedFA.name}
                </h2>
                <p className="mt-1 text-xs text-[#57534e]">
                  {selectedFA.scoutingNote}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span
                    className={`font-semibold ${
                      selectedPrediction.classification === 'TAG_OR_EXTEND_TRAP'
                        ? 'text-[#b84a27]'
                        : !selectedPrediction.countsTowardCompFormula
                        ? 'text-[#2d5a43]'
                        : 'text-[#1c1917]'
                    }`}
                  >
                    Predictor: {selectedPrediction.classificationBadge} (
                    {selectedPrediction.availabilityProbability}% Market Availability)
                  </span>
                  <span>·</span>
                  <span
                    className={
                      !selectedPrediction.countsTowardCompFormula
                        ? 'text-[#2d5a43] font-medium'
                        : 'text-[#b84a27]'
                    }
                  >
                    {selectedPrediction.compPickImpactLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right font-mono-ledger">
              <div className="text-[10px] uppercase tracking-[0.1em] text-[#8a8379]">
                <JargonTip term="APY">Headline Total</JargonTip>
              </div>
              <div className="text-xl font-semibold text-[#1c1917]">
                ${offer.totalValue.toFixed(1)}M
              </div>
              <div className="text-[11px] text-[#57534e]">
                <JargonTip term="PRACTICAL_GUARANTEE">
                  ${offer.totalGuaranteed.toFixed(1)}M Guaranteed
                </JargonTip>
              </div>
            </div>
          </div>

          {/* "Real Contract" X-Ray Box on Offer Sheet */}
          <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="bg-[#1c1917] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f6f3ec]">
                Real Contract X-Ray
              </span>{' '}
              <span className="ml-2 font-mono-ledger text-[#57534e]">
                Agent Headline: {years} yr / ${offer.totalValue.toFixed(1)}M ($
                {apy.toFixed(1)}M/yr)
              </span>{' '}
              <span className="mx-1 text-[#8a8379]">→</span>
              <strong className="font-mono-ledger text-[#2d5a43]">
                {offerXRay.verdictLabel}
              </strong>
            </div>
            {offerXRay.voidYearsCount > 0 && (
              <span className="font-mono-ledger text-[11px] text-[#b84a27]">
                Ghost Bill: ${offerXRay.voidGhostBillTotal.toFixed(2)}M in Void Yrs
              </span>
            )}
          </div>

          {/* Positional Market Comps */}
          {marketComps.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8379] mb-2">
                {selectedFA.position} Market Benchmarks (% of $301.2M Cap)
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {marketComps.map((comp) => (
                  <button
                    key={comp.playerName}
                    type="button"
                    onClick={() => {
                      setApy(comp.equivalent2026Apy);
                      setYears(comp.years);
                      setGuaranteedPct(comp.guaranteedPct);
                    }}
                    className="border border-[#dfd9cc] p-2.5 text-left hover:border-[#1c1917] transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-[#1c1917]">
                      {comp.tierLabel}
                    </div>
                    <div className="text-[10px] text-[#8a8379] truncate">
                      {comp.playerName}
                    </div>
                    <div className="mt-1 font-mono-ledger text-xs font-semibold text-[#2d5a43]">
                      ${comp.equivalent2026Apy.toFixed(1)}M/yr ({comp.pctOfCapAtSigning}%)
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sliders */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <label htmlFor={apySliderId} className="font-medium text-[#1c1917]">
                  Annual Value (APY)
                </label>
                <span className="font-mono-ledger font-semibold text-[#1c1917]">
                  ${apy.toFixed(1)}M / yr
                </span>
              </div>
              <input
                id={apySliderId}
                type="range"
                min={2}
                max={45}
                step={0.5}
                value={apy}
                onChange={(e) => setApy(parseFloat(e.target.value))}
                className="w-full accent-[#1c1917]"
              />
              <div className="mt-1 flex justify-between font-mono-ledger text-[11px] text-[#8a8379]">
                <span>Market: ${selectedFA.marketApy.toFixed(1)}M</span>
                <span>Bonus: ${offer.signingBonusTotal.toFixed(1)}M</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-[#1c1917]">
                  Term Length & Guarantee
                </span>
                <span className="font-mono-ledger font-semibold text-[#1c1917]">
                  {years} Yrs · {Math.round(guaranteedPct * 100)}% Gtd
                </span>
              </div>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYears(y)}
                    className={`flex-1 py-1 font-mono-ledger text-xs cursor-pointer ${
                      years === y
                        ? 'bg-[#1c1917] text-[#f6f3ec]'
                        : 'border border-[#c7bfb0] text-[#57534e]'
                    }`}
                  >
                    {y} yr
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0.2}
                max={0.85}
                step={0.05}
                value={guaranteedPct}
                aria-label="Guaranteed Percentage"
                onChange={(e) => setGuaranteedPct(parseFloat(e.target.value))}
                className="w-full accent-[#1c1917]"
              />
            </div>
          </div>

          {/* Structure Template Selection */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#8a8379] mb-2">
              Cap Accounting Structure
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  { id: 'Backloaded', label: 'Backloaded', desc: 'Low Year-1 base' },
                  { id: 'Flat', label: 'Flat Pacing', desc: 'Even annual hits' },
                  { id: 'FrontLoaded', label: 'Front-Loaded', desc: '$0 late dead cap' },
                  { id: 'VoidHeavy', label: 'Void Deferral', desc: 'Max bonus spread' },
                ] as const
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setStructure(tpl.id)}
                  className={`border p-2.5 text-left transition-colors cursor-pointer ${
                    structure === tpl.id
                      ? 'border-[#1c1917] bg-[#ede8dd]'
                      : 'border-[#dfd9cc] hover:border-[#c7bfb0]'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#1c1917]">
                    {tpl.label}
                  </div>
                  <div className="text-[10px] text-[#8a8379]">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4-Year Schedule Breakdown (Cap Hit vs Cash Paid) */}
          <div className="grid grid-cols-4 divide-x divide-[#dfd9cc] border-y border-[#dfd9cc] py-4">
            {LEAGUE_YEARS.map((yr, idx) => {
              const cy = offer.contractYears[yr];
              const hit = offer.capHitsByYear[yr];
              const playerAge = selectedFA.ageIn2026 + (yr - 2026);
              const isPastCliff = playerAge >= curve.cliffAge;
              const isExitYr = offerXRay.firstCleanExitYear === yr;
              const yearCash =
                cy && !cy.isVoidYear
                  ? getContractYearCash(cy) +
                    (yr === 2026 ? offer.signingBonusTotal : 0)
                  : 0;

              return (
                <div
                  key={yr}
                  className={idx === 0 ? 'pr-4' : idx === 3 ? 'pl-4' : 'px-4'}
                >
                  <div className="flex items-baseline justify-between font-mono-ledger text-[11px] text-[#8a8379]">
                    <span>{yr}</span>
                    {isExitYr ? (
                      <span className="text-[9px] font-semibold uppercase text-[#2d5a43]">
                        Team Exit
                      </span>
                    ) : (
                      <span className={isPastCliff ? 'text-[#b84a27]' : ''}>
                        Age {playerAge}
                      </span>
                    )}
                  </div>
                  {cy ? (
                    <>
                      <div className="font-mono-ledger text-base font-semibold text-[#1c1917] mt-0.5">
                        ${hit.toFixed(2)}M
                      </div>
                      <div className="font-mono-ledger text-[10px] text-[#8a8379]">
                        {cy.isVoidYear
                          ? 'Ghost Yr (Void Proration)'
                          : `B $${cy.baseSalary.toFixed(1)}M · P $${cy.proratedBonus.toFixed(1)}M`}
                      </div>
                      {!cy.isVoidYear && (
                        <div className="mt-0.5 font-mono-ledger text-[10px] text-[#2d5a43]">
                          Cash Paid: ${yearCash.toFixed(1)}M
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-2 font-mono-ledger text-xs text-[#8a8379]/50">
                      —
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="font-mono-ledger text-xs text-[#57534e]">
              2026 Gross: ${offer.capHitsByYear[2026].toFixed(2)}M · Net Marginal:{' '}
              <strong className="text-[#2d5a43]">
                −${net2026Impact.toFixed(2)}M
              </strong>
            </div>

            <button
              type="button"
              onClick={() => {
                addSignFATransaction(
                  selectedFA,
                  years,
                  apy,
                  guaranteedPct,
                  structure
                );
                if (!isModal) {
                  setActiveTab('matrix');
                }
              }}
              className="bg-[#1c1917] px-6 py-2.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] cursor-pointer"
            >
              Sign {selectedFA.name} to Roster
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FreeAgencyModal() {
  const { isFreeAgencyModalOpen, setFreeAgencyModalOpen } = useGMStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isFreeAgencyModalOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isFreeAgencyModalOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      onClose={() => setFreeAgencyModalOpen(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) setFreeAgencyModalOpen(false);
      }}
      className="m-auto w-full max-w-5xl border border-[#1c1917] bg-[#f6f3ec] p-0 text-[#1c1917] shadow-xl backdrop:bg-[#1c1917]/30"
    >
      <div className="flex items-center justify-between border-b border-[#dfd9cc] px-7 py-4">
        <h2 id={titleId} className="font-editorial text-xl text-[#1c1917]">
          Free Agency & Contract Structure Desk
        </h2>
        <button
          type="button"
          onClick={() => setFreeAgencyModalOpen(false)}
          aria-label="Close Free Agency Simulator"
          className="p-1 text-[#8a8379] hover:text-[#1c1917] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isFreeAgencyModalOpen && <FreeAgencySimulatorView isModal />}
    </dialog>
  );
}
