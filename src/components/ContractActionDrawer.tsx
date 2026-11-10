'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  applyPlayerExtension,
  computeRealContractXRay,
  ContractStructureTemplate,
  evaluatePlayerLongevity,
  evaluateRosterPlayerFate,
  getContractYearCapHit,
  getPlayerTagCost,
  getProjectedFifthYearOption,
  LEAGUE_YEARS,
  LeagueYear,
  POSITIONAL_MARKET_COMPS,
  simulateCutOrTrade,
  simulateRestructure,
} from '@/engine';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';
import { JargonTip } from './JargonTooltip';
import { PlayerAvatar } from './PlayerAvatar';

type ActionTab = 'cut' | 'restructure' | 'extend' | 'trade';

export function ContractActionDrawer() {
  const {
    derivedState,
    selectedPlayerId,
    initialDrawerTab,
    selectPlayer,
    addCutTransaction,
    addRestructureTransaction,
    addExtensionTransaction,
    addFranchiseTagTransaction,
    addTradeTransaction,
    addFifthYearOptionTransaction,
  } = useGMStore();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const restructureSliderId = useId();

  const player = useMemo(
    () => derivedState.roster.find((p) => p.id === selectedPlayerId) ?? null,
    [derivedState.roster, selectedPlayerId]
  );

  const [activeTab, setActiveTab] = useState<ActionTab>('restructure');
  const [actionYear, setActionYear] = useState<LeagueYear>(2026);
  const [restructurePct, setRestructurePct] = useState<number>(1.0);
  const [addVoidYears, setAddVoidYears] = useState<number>(1);

  const [extYears, setExtYears] = useState<number>(3);
  const [extApy, setExtApy] = useState<number>(22.0);
  const [extGuaranteedPct, setExtGuaranteedPct] = useState<number>(0.6);
  const [extStructure, setExtStructure] =
    useState<ContractStructureTemplate>('Backloaded');

  const [partnerTeamId, setPartnerTeamId] = useState<string>('LV');
  const [selectedIncomingPickId, setSelectedIncomingPickId] =
    useState<string>('lv-2026-2');
  const [tradeDesignation, setTradeDesignation] = useState<
    'PRE_JUNE_1' | 'POST_JUNE_1'
  >('PRE_JUNE_1');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (player) {
      if (!dialog.open) {
        dialog.showModal();
      }
      const forecast = evaluateRosterPlayerFate(
        player,
        derivedState.years[2026].effectiveCapSpace
      );
      if (initialDrawerTab) {
        setActiveTab(initialDrawerTab);
      } else {
        setActiveTab(forecast.recommendedActionTab);
      }
      setExtApy(forecast.projectedMarketApy);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [player, initialDrawerTab, derivedState.years]);

  if (!player) {
    return (
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => selectPlayer(null)}
        className="hidden"
      />
    );
  }

  const longevity = evaluatePlayerLongevity(player);
  const xray = computeRealContractXRay(player);
  const fateForecast = evaluateRosterPlayerFate(
    player,
    derivedState.years[2026].effectiveCapSpace
  );
  const preJuneCut = simulateCutOrTrade(player, actionYear, 'PRE_JUNE_1_CUT');
  const postJuneCut = simulateCutOrTrade(player, actionYear, 'POST_JUNE_1_CUT');
  const preJuneTrade = simulateCutOrTrade(player, actionYear, 'PRE_JUNE_1_TRADE');
  const postJuneTrade = simulateCutOrTrade(player, actionYear, 'POST_JUNE_1_TRADE');
  const restructureSim = simulateRestructure(
    player,
    actionYear,
    restructurePct,
    addVoidYears
  );
  const extensionSim = applyPlayerExtension(
    player,
    actionYear,
    extYears,
    extApy,
    extGuaranteedPct,
    extStructure
  );

  const partnerTeams = Object.values(SEED_TEAMS)
    .filter((t) => t.id !== derivedState.teamId)
    .map((t) => ({
      id: t.id,
      name: `${t.city} ${t.name}`,
      abbreviation: t.abbreviation,
      availablePicks: t.draftPicks.slice(0, 5),
    }));

  const partnerTeam =
    partnerTeams.find((t) => t.id === partnerTeamId) ??
    partnerTeams[0];
  const incomingPick =
    partnerTeam.availablePicks.find((pk) => pk.id === selectedIncomingPickId) ??
    partnerTeam.availablePicks[0];
  const tradeSim =
    tradeDesignation === 'POST_JUNE_1' ? postJuneTrade : preJuneTrade;

  const fifthYearOptionAmount =
    player.draftRound === 1 &&
    player.isRookieContract &&
    !player.fifthYearOptionExercised &&
    player.draftPick
      ? getProjectedFifthYearOption(player.draftPick, player.position)
      : null;

  // Franchise & Transition Tag Calculations for Expiring Year
  const nextUncoveredYear: LeagueYear = !player.contractYears[2027] || player.contractYears[2027]?.isVoidYear
    ? 2027
    : 2028;
  const priorCapHit = getContractYearCapHit(
    player.contractYears[(nextUncoveredYear - 1) as LeagueYear]
  );
  const franchiseTagAmount = getPlayerTagCost(
    player.position,
    priorCapHit,
    player.priorTagsCount ?? 0,
    'NON_EXCLUSIVE_FRANCHISE',
    nextUncoveredYear
  );
  const transitionTagAmount = getPlayerTagCost(
    player.position,
    priorCapHit,
    player.priorTagsCount ?? 0,
    'TRANSITION',
    nextUncoveredYear
  );

  const marketComps = POSITIONAL_MARKET_COMPS[player.position] ?? [];
  const postJune1Used = derivedState.compPickSummary.postJune1DesignationsUsed;
  const bestCut =
    postJuneCut.currentYearCapSavings > preJuneCut.currentYearCapSavings
      ? postJuneCut
      : preJuneCut;
  const extCapDeltaThisYear = extensionSim.capDeltaByYear[actionYear] ?? 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      onClose={() => selectPlayer(null)}
      onClick={(e) => {
        if (e.target === dialogRef.current) selectPlayer(null);
      }}
      className="m-auto w-full max-w-3xl border border-[#1c1917] bg-[#f6f3ec] p-0 text-[#1c1917] shadow-xl backdrop:bg-[#1c1917]/30"
    >
      {/* Editorial Header */}
      <div className="flex items-start justify-between border-b border-[#dfd9cc] px-7 py-5">
        <div className="flex items-center gap-4">
          <PlayerAvatar
            name={player.name}
            headshotUrl={player.headshotUrl}
            size="lg"
          />
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#8a8379]">
              {player.position} · Age {player.ageIn2026} · OVR {player.overallRating}{' '}
              · {player.accruedSeasons} Accrued Seasons
            </div>
            <h2 id={titleId} className="font-editorial mt-1 text-2xl text-[#1c1917]">
              {player.name}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`font-semibold ${
                  fateForecast.fate === 'CAP_CASUALTY_RISK' ||
                  fateForecast.fate === 'WALK_CANDIDATE'
                    ? 'text-[#b84a27]'
                    : 'text-[#2d5a43]'
                }`}
              >
                Forecast: {fateForecast.badgeLabel}
              </span>
              <span className="text-[#8a8379]">·</span>
              <span className="text-[#57534e]">{fateForecast.rationale}</span>
            </div>
            {player.notes && (
              <p className="mt-1 text-xs text-[#8a8379]">{player.notes}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => selectPlayer(null)}
          aria-label="Close contract dossier"
          className="p-1 text-[#8a8379] hover:text-[#1c1917] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Current 4-Year Ledger Strip + "Real Contract" X-Ray */}
      <div className="border-b border-[#dfd9cc] bg-[#ede8dd]/50 px-7 py-4 space-y-3">
        {/* Real Contract X-Ray Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfd9cc] pb-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#1c1917] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f6f3ec]">
              Real Contract X-Ray
            </span>
            <span className="font-mono-ledger text-[#57534e]">
              <JargonTip term="APY">Headline</JargonTip>: {xray.headlineYears} yr / $
              {xray.headlineTotalCap.toFixed(1)}M (${xray.headlineApy.toFixed(1)}M/yr)
            </span>
            <span className="text-[#8a8379]">→</span>
            <span className="font-mono-ledger font-semibold text-[#2d5a43]">
              {xray.verdictLabel}
            </span>
          </div>
          {xray.voidYearsCount > 0 && (
            <span className="font-mono-ledger text-[11px] text-[#b84a27]">
              <JargonTip term="VOID_YEAR_DEAD_CAP">
                Ghost Bill: ${xray.voidGhostBillTotal.toFixed(2)}M ({xray.voidYearsCount}{' '}
                Void Yr{xray.voidYearsCount > 1 ? 's' : ''})
              </JargonTip>
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between text-xs">
          <span className="uppercase tracking-[0.12em] text-[10px] text-[#8a8379]">
            Current Contract Schedule
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#8a8379]">Effective Year:</span>
            {([2026, 2027] as LeagueYear[]).map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setActionYear(yr)}
                className={`font-mono-ledger text-xs cursor-pointer ${
                  actionYear === yr
                    ? 'border-b border-[#1c1917] font-semibold text-[#1c1917]'
                    : 'text-[#8a8379] hover:text-[#1c1917]'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 divide-x divide-[#dfd9cc]">
          {LEAGUE_YEARS.map((yr, idx) => {
            const cy = player.contractYears[yr];
            const hit = getContractYearCapHit(cy);
            const isCleanExit = xray.firstCleanExitYear === yr;
            return (
              <div
                key={yr}
                className={`${idx === 0 ? 'pr-4' : idx === 3 ? 'pl-4' : 'px-4'}`}
              >
                <div className="flex items-center justify-between font-mono-ledger text-[11px] text-[#8a8379]">
                  <span>{yr}</span>
                  {isCleanExit && (
                    <span className="text-[9px] font-semibold uppercase text-[#2d5a43]">
                      Team Exit
                    </span>
                  )}
                </div>
                {cy ? (
                  <>
                    <div className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                      ${hit.toFixed(2)}M{cy.isVoidYear ? ' (Ghost)' : ''}
                    </div>
                    <div className="font-mono-ledger text-[10px] text-[#8a8379]">
                      B ${cy.baseSalary.toFixed(1)}M · P ${cy.proratedBonus.toFixed(1)}M
                    </div>
                  </>
                ) : (
                  <div className="font-mono-ledger text-xs text-[#8a8379]/60">
                    Unsigned
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* THE "FOUR DOORS" SIDE-BY-SIDE COMPARISON CARD (Cut vs Trade vs Restructure vs Extend + Baseline) */}
      <div className="border-b border-[#dfd9cc] bg-[#fcfaf6] px-7 py-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
            The &ldquo;Four Doors&rdquo; Side-by-Side Comparison ({actionYear} Impact vs.{' '}
            {actionYear + 1} Bill)
          </span>
          <span className="text-[10px] text-[#8a8379]">
            Click any option to inspect or execute
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 text-xs">
          {/* Door 0: Do Nothing Baseline */}
          <div className="border border-[#dfd9cc] bg-[#f6f3ec]/70 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-[#8a8379]">
              Baseline
            </div>
            <div className="font-semibold text-[#1c1917]">Keep As-Is</div>
            <div className="mt-1 font-mono-ledger text-xs text-[#1c1917]">
              {actionYear}: ${preJuneCut.currentYearOriginalCapHit.toFixed(1)}M hit
            </div>
            <div className="font-mono-ledger text-[10px] text-[#8a8379]">
              {actionYear + 1}: ${preJuneCut.nextYearOriginalCapHit.toFixed(1)}M hit
            </div>
          </div>

          {/* Door 1: Restructure */}
          <button
            type="button"
            onClick={() => setActiveTab('restructure')}
            className={`border p-2.5 text-left transition-colors cursor-pointer ${
              activeTab === 'restructure'
                ? 'border-[#1c1917] bg-[#ede8dd]'
                : 'border-[#dfd9cc] hover:border-[#1c1917]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#8a8379]">
              Door 1 · Stay
            </div>
            <div className="font-semibold text-[#1c1917]">Restructure</div>
            <div className="mt-1 font-mono-ledger text-xs font-semibold text-[#2d5a43]">
              Saves +${restructureSim.currentYearCapSavings.toFixed(1)}M
            </div>
            <div className="font-mono-ledger text-[10px] text-[#b84a27]">
              Adds +${restructureSim.annualProrationAdded.toFixed(1)}M/yr later
            </div>
          </button>

          {/* Door 2: Release (Best of Pre/Post June 1) */}
          <button
            type="button"
            onClick={() => setActiveTab('cut')}
            className={`border p-2.5 text-left transition-colors cursor-pointer ${
              activeTab === 'cut'
                ? 'border-[#1c1917] bg-[#ede8dd]'
                : 'border-[#dfd9cc] hover:border-[#1c1917]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#8a8379]">
              Door 2 · Release
            </div>
            <div className="font-semibold text-[#1c1917]">Cut (Best)</div>
            <div
              className={`mt-1 font-mono-ledger text-xs font-semibold ${
                bestCut.currentYearCapSavings >= 0
                  ? 'text-[#2d5a43]'
                  : 'text-[#b84a27]'
              }`}
            >
              {bestCut.currentYearCapSavings >= 0 ? 'Saves +$' : 'Costs −$'}
              {Math.abs(bestCut.currentYearCapSavings).toFixed(1)}M
            </div>
            <div className="font-mono-ledger text-[10px] text-[#8a8379]">
              Dead: ${preJuneCut.currentYearDeadCap.toFixed(1)}M total
            </div>
          </button>

          {/* Door 3: Trade */}
          <button
            type="button"
            onClick={() => setActiveTab('trade')}
            className={`border p-2.5 text-left transition-colors cursor-pointer ${
              activeTab === 'trade'
                ? 'border-[#1c1917] bg-[#ede8dd]'
                : 'border-[#dfd9cc] hover:border-[#1c1917]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#8a8379]">
              Door 3 · Trade
            </div>
            <div className="font-semibold text-[#1c1917]">Trade Away</div>
            <div
              className={`mt-1 font-mono-ledger text-xs font-semibold ${
                preJuneTrade.currentYearCapSavings >= 0
                  ? 'text-[#2d5a43]'
                  : 'text-[#b84a27]'
              }`}
            >
              {preJuneTrade.currentYearCapSavings >= 0 ? 'Saves +$' : 'Costs −$'}
              {Math.abs(preJuneTrade.currentYearCapSavings).toFixed(1)}M
            </div>
            <div className="font-mono-ledger text-[10px] text-[#8a8379]">
              We eat ${preJuneTrade.currentYearDeadCap.toFixed(1)}M bonus
            </div>
          </button>

          {/* Door 4: Extend */}
          <button
            type="button"
            onClick={() => setActiveTab('extend')}
            className={`border p-2.5 text-left transition-colors cursor-pointer ${
              activeTab === 'extend'
                ? 'border-[#1c1917] bg-[#ede8dd]'
                : 'border-[#dfd9cc] hover:border-[#1c1917]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-[#8a8379]">
              Door 4 · Extend
            </div>
            <div className="font-semibold text-[#1c1917]">+{extYears} Yr Deal</div>
            <div
              className={`mt-1 font-mono-ledger text-xs font-semibold ${
                extCapDeltaThisYear <= 0 ? 'text-[#2d5a43]' : 'text-[#1c1917]'
              }`}
            >
              {extCapDeltaThisYear <= 0
                ? `Saves +$${Math.abs(extCapDeltaThisYear).toFixed(1)}M`
                : `+$${extCapDeltaThisYear.toFixed(1)}M in '${String(actionYear).slice(2)}`}
            </div>
            <div className="font-mono-ledger text-[10px] text-[#8a8379]">
              ~${extApy.toFixed(1)}M/yr market
            </div>
          </button>
        </div>
      </div>

      {/* Action Mode Tabs */}
      <div className="flex border-b border-[#dfd9cc] px-7 pt-3 gap-6 text-xs uppercase tracking-[0.1em]">
        {(
          [
            { id: 'restructure', label: 'Restructure' },
            { id: 'cut', label: 'Release (Pre / Post-June 1)' },
            { id: 'extend', label: 'Extend / Tag' },
            { id: 'trade', label: 'Trade' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2.5 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#8a8379] hover:text-[#1c1917]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-7">
        {activeTab === 'restructure' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label
                  htmlFor={restructureSliderId}
                  className="text-xs font-medium text-[#1c1917]"
                >
                  Convert {actionYear} Base Salary Above Vet Minimum ($
                  {restructureSim.vetMinimumFloor.toFixed(2)}M Floor)
                </label>
                <span className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                  {Math.round(restructurePct * 100)}% ($
                  {restructureSim.convertedBonusAmount.toFixed(2)}M)
                </span>
              </div>

              <input
                id={restructureSliderId}
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(restructurePct * 100)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  e.currentTarget.style.setProperty('--control-value', String(val));
                  setRestructurePct(val / 100);
                }}
                style={
                  {
                    '--attr-min': 10,
                    '--attr-max': 100,
                    '--control-value': Math.round(restructurePct * 100),
                  } as React.CSSProperties
                }
                className="gm-range-slider w-full"
              />

              <div className="mt-3 flex items-center justify-between text-xs text-[#57534e]">
                <div className="flex items-center gap-3">
                  <span>Void Years Added:</span>
                  {[0, 1, 2].map((vCount) => (
                    <button
                      key={vCount}
                      type="button"
                      onClick={() => setAddVoidYears(vCount)}
                      className={`px-2 py-0.5 font-mono-ledger cursor-pointer ${
                        addVoidYears === vCount
                          ? 'bg-[#1c1917] text-[#f6f3ec]'
                          : 'border border-[#c7bfb0] text-[#57534e]'
                      }`}
                    >
                      +{vCount}
                    </button>
                  ))}
                </div>
                <span className="font-mono-ledger">
                  +{restructureSim.annualProrationAdded.toFixed(2)}M/yr across{' '}
                  {restructureSim.prorationYearsCount} yrs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-[#dfd9cc] border-y border-[#dfd9cc] py-4">
              {LEAGUE_YEARS.map((yr, idx) => {
                const delta = restructureSim.capDeltaByYear[yr];
                const newHit = getContractYearCapHit(
                  restructureSim.updatedPlayer.contractYears[yr]
                );
                return (
                  <div
                    key={yr}
                    className={idx === 0 ? 'pr-4' : idx === 3 ? 'pl-4' : 'px-4'}
                  >
                    <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                      {yr} Revised
                    </div>
                    <div className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                      ${newHit.toFixed(2)}M
                    </div>
                    <div
                      className={`font-mono-ledger text-[11px] ${
                        delta < 0
                          ? 'text-[#2d5a43]'
                          : delta > 0
                          ? 'text-[#b84a27]'
                          : 'text-[#8a8379]'
                      }`}
                    >
                      {delta < 0
                        ? `Saves $${Math.abs(delta).toFixed(2)}M`
                        : delta > 0
                        ? `+$${delta.toFixed(2)}M`
                        : '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#57534e]">
                Immediate {actionYear} relief:{' '}
                <strong className="font-mono-ledger text-[#2d5a43]">
                  +${restructureSim.currentYearCapSavings.toFixed(2)}M
                </strong>
              </span>
              <button
                type="button"
                disabled={restructureSim.currentYearCapSavings <= 0}
                onClick={() =>
                  addRestructureTransaction(
                    player,
                    restructurePct,
                    addVoidYears,
                    actionYear
                  )
                }
                className="bg-[#1c1917] px-5 py-2.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] disabled:opacity-40 cursor-pointer"
              >
                Record Restructure (+$
                {restructureSim.currentYearCapSavings.toFixed(2)}M)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'cut' && (
          <div className="space-y-6">
            {/* The "June 2 Slider" Visual Bar: Same Total Bill, Different Due Dates */}
            <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                  The June 2 Rule · &ldquo;Same Dead-Money Bill, Different Due Dates&rdquo;
                </span>
                <span className="font-mono-ledger text-[11px] font-semibold text-[#b84a27]">
                  Total Unamortized Dead Bill: ${preJuneCut.currentYearDeadCap.toFixed(2)}M
                </span>
              </div>

              {preJuneCut.currentYearDeadCap > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono-ledger">
                    <span>
                      March–June 1 (100% in {actionYear}: $
                      {preJuneCut.currentYearDeadCap.toFixed(2)}M)
                    </span>
                    <span>
                      Post-June 1 Split ({actionYear}: $
                      {postJuneCut.currentYearDeadCap.toFixed(2)}M · {actionYear + 1}: $
                      {postJuneCut.nextYearDeadCap.toFixed(2)}M)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#e5dfd3] flex overflow-hidden">
                    <div
                      className="bg-[#b84a27] h-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (postJuneCut.currentYearDeadCap /
                            Math.max(0.01, preJuneCut.currentYearDeadCap)) *
                            100
                        )}%`,
                      }}
                      title={`${actionYear} Dead Cap Share`}
                    />
                    <div
                      className="bg-[#b57c1e] h-full flex-1"
                      title={`${actionYear + 1} Deferred Dead Cap Share`}
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[#57534e]">
                <strong>Timing Warning:</strong> Post-June 1 designations (max 2 per
                offseason; {postJune1Used}/2 used) do <em>not</em> erase dead money—they
                defer {actionYear + 1}–2029 bonus slices into {actionYear + 1}. You must
                carry the player&apos;s full ${preJuneCut.currentYearOriginalCapHit.toFixed(2)}M
                cap hit until <strong>June 2</strong> (after Wave 1 of Free Agency).
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#dfd9cc]">
              <div className="flex flex-col justify-between sm:pr-4">
                <div>
                  <h3 className="font-editorial text-lg text-[#1c1917]">
                    <JargonTip term="PRE_JUNE_1_RELEASE">
                      Pre-June 1 Release (Full Bill Now)
                    </JargonTip>
                  </h3>
                  <p className="mt-1 text-xs text-[#57534e]">
                    All remaining unamortized bonus accelerates immediately into{' '}
                    {actionYear}; clears {actionYear + 1}–2029 books completely.
                  </p>

                  <div className="mt-4 space-y-2 border-t border-[#dfd9cc] pt-3 font-mono-ledger text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#8a8379]">{actionYear} Dead Cap:</span>
                      <span className="text-[#b84a27]">
                        ${preJuneCut.currentYearDeadCap.toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8a8379]">{actionYear + 1} Dead Cap:</span>
                      <span>$0.00M (Clean Books)</span>
                    </div>
                    <div className="flex justify-between border-t border-[#dfd9cc] pt-2 font-semibold">
                      <span>{actionYear} Net Savings (March):</span>
                      <span
                        className={
                          preJuneCut.currentYearCapSavings >= 0
                            ? 'text-[#2d5a43]'
                            : 'text-[#b84a27]'
                        }
                      >
                        {preJuneCut.currentYearCapSavings >= 0 ? '+$' : '−$'}
                        {Math.abs(preJuneCut.currentYearCapSavings).toFixed(2)}M
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    addCutTransaction(player, 'PRE_JUNE_1_CUT', actionYear)
                  }
                  className="mt-5 w-full border border-[#1c1917] py-2 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                >
                  Release Pre-June 1
                </button>
              </div>

              <div className="flex flex-col justify-between pt-6 sm:pt-0 sm:pl-6">
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-editorial text-lg text-[#1c1917]">
                      <JargonTip term="POST_JUNE_1_DESIGNATION">
                        Post-June 1 Designation (Split Bill)
                      </JargonTip>
                    </h3>
                    <span className="font-mono-ledger text-[10px] text-[#8a8379]">
                      Slots used: {postJune1Used}/2
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#57534e]">
                    Keeps only {actionYear}&apos;s scheduled proration on{' '}
                    {actionYear} cap and defers remaining bonus to {actionYear + 1}.
                  </p>

                  <div className="mt-4 space-y-2 border-t border-[#dfd9cc] pt-3 font-mono-ledger text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#8a8379]">{actionYear} Dead Cap:</span>
                      <span className="text-[#b84a27]">
                        ${postJuneCut.currentYearDeadCap.toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8a8379]">
                        {actionYear + 1} Deferred Dead:
                      </span>
                      <span className="text-[#b84a27]">
                        ${postJuneCut.nextYearDeadCap.toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#dfd9cc] pt-2 font-semibold">
                      <span>{actionYear} Savings (Arrives June 2):</span>
                      <span
                        className={
                          postJuneCut.currentYearCapSavings >= 0
                            ? 'text-[#2d5a43]'
                            : 'text-[#b84a27]'
                        }
                      >
                        {postJuneCut.currentYearCapSavings >= 0 ? '+$' : '−$'}
                        {Math.abs(postJuneCut.currentYearCapSavings).toFixed(2)}M
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    addCutTransaction(player, 'POST_JUNE_1_CUT', actionYear)
                  }
                  className="mt-5 w-full bg-[#1c1917] py-2 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                >
                  Designate Post-June 1 ({2 - postJune1Used} left)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'extend' && (
          <div className="space-y-5">
            {/* Franchise / Transition Tag & 5th-Yr Option Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfd9cc] pb-4 text-xs">
              <div>
                <div className="font-medium text-[#1c1917]">
                  CBA Tender Options ({nextUncoveredYear})
                </div>
                <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                  Franchise Tag: ${franchiseTagAmount.toFixed(1)}M · Transition
                  Tag: ${transitionTagAmount.toFixed(1)}M (120% Rule Applied)
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fifthYearOptionAmount !== null && (
                  <button
                    type="button"
                    onClick={() =>
                      addFifthYearOptionTransaction(
                        player,
                        2027,
                        fifthYearOptionAmount
                      )
                    }
                    className="border border-[#2d5a43] px-2.5 py-1 text-xs font-medium text-[#2d5a43] hover:bg-[#2d5a43] hover:text-[#f6f3ec] cursor-pointer"
                  >
                    5th-Yr Option (${fifthYearOptionAmount.toFixed(1)}M)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    addFranchiseTagTransaction(
                      player,
                      'NON_EXCLUSIVE_FRANCHISE',
                      franchiseTagAmount,
                      nextUncoveredYear
                    )
                  }
                  className="border border-[#1c1917] px-2.5 py-1 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] cursor-pointer"
                >
                  Franchise Tag (${franchiseTagAmount.toFixed(1)}M)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addFranchiseTagTransaction(
                      player,
                      'TRANSITION',
                      transitionTagAmount,
                      nextUncoveredYear
                    )
                  }
                  className="border border-[#c7bfb0] px-2.5 py-1 text-xs text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917] cursor-pointer"
                >
                  Transition Tag (${transitionTagAmount.toFixed(1)}M)
                </button>
              </div>
            </div>

            {/* Real-World Positional Market Comps (% of Cap at Signing) */}
            {marketComps.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8379] mb-2">
                  Real-World {player.position} Market Comps (Adjusted to $301.2M Cap)
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {marketComps.map((comp) => (
                    <button
                      key={comp.playerName}
                      type="button"
                      onClick={() => {
                        setExtApy(comp.equivalent2026Apy);
                        setExtYears(Math.min(3, comp.years));
                        setExtGuaranteedPct(comp.guaranteedPct);
                      }}
                      className="border border-[#dfd9cc] p-2 text-left hover:border-[#1c1917] transition-colors cursor-pointer"
                    >
                      <div className="text-[11px] font-semibold text-[#1c1917]">
                        {comp.tierLabel}
                      </div>
                      <div className="text-[10px] text-[#8a8379] truncate">
                        {comp.playerName}
                      </div>
                      <div className="mt-1 font-mono-ledger text-xs font-semibold text-[#2d5a43]">
                        ${comp.equivalent2026Apy.toFixed(1)}M/yr ({comp.pctOfCapAtSigning}% cap)
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                  New Years Added
                </label>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((yrs) => (
                    <button
                      key={yrs}
                      type="button"
                      onClick={() => setExtYears(yrs)}
                      className={`flex-1 py-1.5 font-mono-ledger text-xs cursor-pointer ${
                        extYears === yrs
                          ? 'bg-[#1c1917] text-[#f6f3ec]'
                          : 'border border-[#c7bfb0] text-[#57534e]'
                      }`}
                    >
                      +{yrs} yr
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                  APY (${extApy.toFixed(1)}M / yr)
                </label>
                <input
                  type="range"
                  min={2}
                  max={65}
                  step={0.5}
                  value={extApy}
                  onChange={(e) => setExtApy(parseFloat(e.target.value))}
                  className="mt-3 w-full accent-[#1c1917]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                  Pacing Structure
                </label>
                <select
                  value={extStructure}
                  onChange={(e) =>
                    setExtStructure(e.target.value as ContractStructureTemplate)
                  }
                  className="mt-2 w-full border-b border-[#1c1917] bg-transparent py-1.5 text-xs font-medium text-[#1c1917]"
                >
                  <option value="Backloaded">Team-Friendly Backload</option>
                  <option value="Flat">Flat / Even</option>
                  <option value="FrontLoaded">Front-Loaded</option>
                  <option value="VoidHeavy">Void-Year Deferral</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-[#dfd9cc] border-y border-[#dfd9cc] py-4">
              {LEAGUE_YEARS.map((yr, idx) => {
                const newCy = extensionSim.updatedPlayer.contractYears[yr];
                const newHit = getContractYearCapHit(newCy);
                return (
                  <div
                    key={yr}
                    className={idx === 0 ? 'pr-4' : idx === 3 ? 'pl-4' : 'px-4'}
                  >
                    <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                      {yr} Extended
                    </div>
                    <div className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                      ${newHit.toFixed(2)}M
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#57534e]">
                {longevity.extensionRecommendation} ({longevity.postContractViableYears}{' '}
                viable post-deal yrs)
              </span>
              <button
                type="button"
                onClick={() =>
                  addExtensionTransaction(
                    player,
                    extYears,
                    extApy,
                    extGuaranteedPct,
                    extStructure,
                    actionYear
                  )
                }
                className="bg-[#1c1917] px-5 py-2.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] cursor-pointer"
              >
                Sign {extYears}-Yr Extension (${(extYears * extApy).toFixed(1)}M)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="space-y-5">
            {/* Trade Cap Math & June 2 Date Rule Box */}
            <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-4 space-y-2 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                  Trade Cap Math · Who Pays What?
                </span>
                <span className="font-mono-ledger text-[11px] text-[#57534e]">
                  Buyer ({partnerTeam.abbreviation}) Inherits:{' '}
                  <strong className="text-[#1c1917]">
                    ${(player.contractYears[actionYear]?.baseSalary ?? 0).toFixed(2)}M
                  </strong>{' '}
                  base salary
                </span>
              </div>
              <p className="text-[11px] text-[#57534e]">
                <strong>Seller Rule:</strong> Your team keeps all unpaid signing bonus
                slices (${preJuneTrade.currentYearDeadCap.toFixed(2)}M total).{' '}
                <strong>Trade Date Rule:</strong> Unlike releases, you{' '}
                <em>cannot</em> apply a March Post-June 1 designation to a trade—to
                split dead money across {actionYear} ($
                {postJuneTrade.currentYearDeadCap.toFixed(2)}M) and {actionYear + 1} ($
                {postJuneTrade.nextYearDeadCap.toFixed(2)}M), the trade must physically be
                processed on or after <strong>June 2</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                  Partner Club
                </label>
                <select
                  value={partnerTeamId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPartnerTeamId(nextId);
                    const found = partnerTeams.find((t) => t.id === nextId);
                    if (found && found.availablePicks[0]) {
                      setSelectedIncomingPickId(found.availablePicks[0].id);
                    }
                  }}
                  className="mt-2 w-full border-b border-[#1c1917] bg-transparent py-1.5 text-xs font-medium text-[#1c1917]"
                >
                  {partnerTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                  Pick Acquired
                </label>
                <select
                  value={selectedIncomingPickId}
                  onChange={(e) => setSelectedIncomingPickId(e.target.value)}
                  className="mt-2 w-full border-b border-[#1c1917] bg-transparent py-1.5 text-xs font-medium text-[#1c1917]"
                >
                  {partnerTeam.availablePicks.map((pk) => (
                    <option key={pk.id} value={pk.id}>
                      Round {pk.round}, Pick #{pk.overallPick}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#8a8379]">
                  Trade Processing Date
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeDesignation('PRE_JUNE_1')}
                    className={`flex-1 py-1.5 text-xs cursor-pointer ${
                      tradeDesignation === 'PRE_JUNE_1'
                        ? 'bg-[#1c1917] text-[#f6f3ec]'
                        : 'border border-[#c7bfb0] text-[#57534e]'
                    }`}
                  >
                    Before June 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeDesignation('POST_JUNE_1')}
                    className={`flex-1 py-1.5 text-xs cursor-pointer ${
                      tradeDesignation === 'POST_JUNE_1'
                        ? 'bg-[#1c1917] text-[#f6f3ec]'
                        : 'border border-[#c7bfb0] text-[#57534e]'
                    }`}
                  >
                    On/After June 2
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#dfd9cc] pt-4 text-xs">
              <div className="font-mono-ledger text-[#57534e]">
                {actionYear} Savings:{' '}
                <strong className="text-[#2d5a43]">
                  {tradeSim.currentYearCapSavings >= 0 ? '+$' : '−$'}
                  {Math.abs(tradeSim.currentYearCapSavings).toFixed(2)}M
                </strong>{' '}
                · {actionYear} Dead: ${tradeSim.currentYearDeadCap.toFixed(2)}M
                {tradeDesignation === 'POST_JUNE_1' &&
                  ` · ${actionYear + 1} Dead: $${tradeSim.nextYearDeadCap.toFixed(2)}M`}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!incomingPick) return;
                  addTradeTransaction({
                    partnerTeamId: partnerTeam.id,
                    partnerTeamName: partnerTeam.name,
                    designation: tradeDesignation,
                    outgoingPlayers: [player],
                    incomingPlayers: [],
                    outgoingPickIds: [],
                    incomingPicks: [incomingPick],
                    tradeValueSent: 150,
                    tradeValueReceived: 150,
                  });
                }}
                className="bg-[#1c1917] px-5 py-2.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] cursor-pointer"
              >
                Trade to {partnerTeam.abbreviation} for Pick #
                {incomingPick?.overallPick}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
