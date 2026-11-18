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
    initialActionYear,
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
  const [customSlidersKey, setCustomSlidersKey] = useState<string | null>(null);
  const currentSlidersKey = `${player?.id ?? ''}:${activeTab}`;
  const showCustomSliders = customSlidersKey === currentSlidersKey;
  const toggleCustomSliders = () =>
    setCustomSlidersKey((prev) =>
      prev === currentSlidersKey ? null : currentSlidersKey
    );
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

  const [showTeammateCompare, setShowTeammateCompare] = useState(false);
  const [compareTeammateId, setCompareTeammateId] = useState<string>('');
  const comparableTeammates = useMemo(() => {
    if (!player) return [];
    return derivedState.roster
      .filter((p) => p.id !== player.id && p.contractYears[actionYear])
      .sort((a, b) => {
        const aSamePos = a.position === player.position ? 1 : 0;
        const bSamePos = b.position === player.position ? 1 : 0;
        if (bSamePos !== aSamePos) return bSamePos - aSamePos;
        return (
          getContractYearCapHit(b.contractYears[actionYear]) -
          getContractYearCapHit(a.contractYears[actionYear])
        );
      });
  }, [derivedState.roster, player, actionYear]);
  const selectedTeammate =
    comparableTeammates.find((p) => p.id === compareTeammateId) ??
    comparableTeammates[0] ??
    null;

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
      if (initialActionYear) {
        setActionYear(initialActionYear);
      } else {
        setActionYear(2026);
      }
      setExtApy(forecast.projectedMarketApy);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [player, initialDrawerTab, initialActionYear, derivedState.years]);

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
      className="mt-auto mb-0 sm:m-auto w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-xs"
    >
      {/* Clean Fintech Drawer Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-7 sm:py-5">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <PlayerAvatar
            name={player.name}
            headshotUrl={player.headshotUrl}
            teamId={derivedState.teamId}
            size="lg"
          />
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-[#475569]">
              {player.position} · Age {player.ageIn2026} · Rating{' '}
              {player.overallRating}/99 · {player.accruedSeasons} Accrued
            </div>
            <h2 id={titleId} className="font-editorial mt-0.5 text-xl sm:text-2xl text-[#1c1917]">
              {player.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={`font-semibold ${
                  fateForecast.fate === 'CAP_CASUALTY_RISK' ||
                  fateForecast.fate === 'WALK_CANDIDATE'
                    ? 'text-[#b84a27]'
                    : 'text-[#2d5a43]'
                }`}
              >
                {fateForecast.badgeLabel}
              </span>
              <span className="hidden sm:inline text-[#8a8379]">·</span>
              <span className="hidden sm:inline text-[#57534e]">{fateForecast.rationale}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => selectPlayer(null)}
          aria-label="Close contract dossier"
          className="min-h-[40px] min-w-[40px] shrink-0 inline-flex items-center justify-center border border-[#1c1917] bg-[#fcfaf6] text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Current 4-Year Ledger Strip + "Real Contract" X-Ray */}
      <div className="border-b border-[#dfd9cc] bg-[#ede8dd]/50 px-4 py-3.5 sm:px-7 sm:py-4 space-y-3">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-0 sm:divide-x divide-[#dfd9cc]">
          {LEAGUE_YEARS.map((yr, idx) => {
            const cy = player.contractYears[yr];
            const hit = getContractYearCapHit(cy);
            const isCleanExit = xray.firstCleanExitYear === yr;
            return (
              <div
                key={yr}
                className={`border sm:border-0 border-[#dfd9cc] bg-[#fcfaf6] sm:bg-transparent p-2 sm:p-0 ${idx === 0 ? 'sm:pr-3' : idx === 3 ? 'sm:pl-3' : 'sm:px-3'}`}
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
      <div className="border-b border-[#dfd9cc] bg-[#fcfaf6] px-4 py-3.5 sm:px-7 sm:py-4">
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
      <div className="flex overflow-x-auto no-scrollbar border-b border-[#dfd9cc] px-4 sm:px-7 pt-3 gap-5 sm:gap-6 text-xs uppercase tracking-[0.1em] whitespace-nowrap">
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
            className={`shrink-0 pb-2.5 min-h-[36px] transition-colors cursor-pointer ${
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
      <div className="p-4 sm:p-7">
        {activeTab === 'restructure' && (
          <div className="space-y-5">
            {/* 1-Tap Visual Restructure Choice Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    title: 'Max Cap Relief',
                    badge: '100% + 2 Void Yrs',
                    pct: 1.0,
                    voidYrs: 2,
                    btnLabel: 'Apply Max Relief',
                    accent: 'border-[#15803d] bg-[#f0fdf4]',
                    btnClass: 'bg-[#15803d] text-white hover:bg-[#14532d]',
                  },
                  {
                    title: 'Standard Restructure',
                    badge: '100% · 0 Void Yrs',
                    pct: 1.0,
                    voidYrs: 0,
                    btnLabel: 'Apply Standard',
                    accent: 'border-[#1e3a5f] bg-[#eff6ff]',
                    btnClass: 'bg-[#1e3a5f] text-white hover:bg-[#152c4a]',
                  },
                  {
                    title: 'Light Restructure',
                    badge: '50% · 0 Void Yrs',
                    pct: 0.5,
                    voidYrs: 0,
                    btnLabel: 'Apply Light',
                    accent: 'border-[#dfd9cc] bg-[#fcfaf6]',
                    btnClass: 'bg-[#1c1917] text-[#f6f3ec] hover:bg-[#332e2a]',
                  },
                ] as const
              ).map((preset) => {
                const sim = simulateRestructure(
                  player,
                  actionYear,
                  preset.pct,
                  preset.voidYrs
                );
                const disabled = sim.currentYearCapSavings <= 0.01;
                return (
                  <div
                    key={preset.title}
                    className={`flex flex-col justify-between border p-3.5 space-y-3 ${preset.accent}`}
                  >
                    <div>
                      <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                        {preset.badge}
                      </div>
                      <h3 className="mt-0.5 font-editorial text-base font-bold text-[#111827]">
                        {preset.title}
                      </h3>
                      <div className="mt-2 font-mono-ledger text-lg font-bold text-[#15803d]">
                        +${sim.currentYearCapSavings.toFixed(2)}M
                        <span className="ml-1 text-[11px] font-normal text-[#475569]">
                          in {actionYear}
                        </span>
                      </div>
                      <div className="mt-1 font-mono-ledger text-[11px] text-[#475569]">
                        +${sim.annualProrationAdded.toFixed(2)}M/yr across{' '}
                        {sim.prorationYearsCount} yr
                        {sim.prorationYearsCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        addRestructureTransaction(
                          player,
                          preset.pct,
                          preset.voidYrs,
                          actionYear
                        )
                      }
                      className={`w-full py-2 px-3 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer ${preset.btnClass}`}
                    >
                      {disabled ? 'No Salary Eligible' : preset.btnLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#dfd9cc] pt-3">
              <button
                type="button"
                onClick={toggleCustomSliders}
                className="font-mono-ledger text-xs font-semibold text-[#1e3a5f] hover:underline cursor-pointer"
              >
                {showCustomSliders
                  ? 'Hide Custom Sliders ▲'
                  : 'Customize Exact % & Void Years ▾'}
              </button>
            </div>

            {showCustomSliders && (
              <div className="space-y-5 border border-[#dfd9cc] bg-[#fcfaf6] p-4">
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
                      e.currentTarget.style.setProperty(
                        '--control-value',
                        String(val)
                      );
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 sm:divide-x divide-[#dfd9cc] border-y border-[#dfd9cc] py-4">
                  {LEAGUE_YEARS.map((yr, idx) => {
                    const delta = restructureSim.capDeltaByYear[yr];
                    const newHit = getContractYearCapHit(
                      restructureSim.updatedPlayer.contractYears[yr]
                    );
                    return (
                      <div
                        key={yr}
                        className={
                          idx === 0
                            ? 'sm:pr-3'
                            : idx === 3
                            ? 'sm:pl-3'
                            : 'sm:px-3'
                        }
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
                    Record Custom Restructure (+$
                    {restructureSim.currentYearCapSavings.toFixed(2)}M)
                  </button>
                </div>
              </div>
            )}
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

            {/* Yellow #8: Collapsible "Keep One / Cut One" Side-by-Side Teammate Comparator */}
            {selectedTeammate && (() => {
              const teammateCut = simulateCutOrTrade(
                selectedTeammate,
                actionYear,
                'PRE_JUNE_1_CUT'
              );
              const playerHit = preJuneCut.currentYearOriginalCapHit;
              const teammateHit = teammateCut.currentYearOriginalCapHit;
              const playerLastName = player.name.split(' ').pop() ?? player.name;
              const teammateLastName =
                selectedTeammate.name.split(' ').pop() ?? selectedTeammate.name;

              return (
                <div className="border-t border-[#dfd9cc] pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTeammateCompare((v) => !v)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <span>
                      Compare &ldquo;Keep One / Cut One&rdquo; vs.{' '}
                      {selectedTeammate.name} ({selectedTeammate.position})
                    </span>
                    <span className="font-mono-ledger text-[11px] text-[#57534e]">
                      {showTeammateCompare ? 'Hide ▲' : 'Compare ▾'}
                    </span>
                  </button>

                  {showTeammateCompare && (
                    <div className="mt-3 border border-[#dfd9cc] bg-[#fcfaf6] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#57534e]">
                          Side-by-Side Cap Relief ({actionYear} Pre-June 1)
                        </span>
                        <label className="flex items-center gap-1.5 text-[11px] text-[#57534e]">
                          <span>Compare against:</span>
                          <select
                            value={selectedTeammate.id}
                            onChange={(e) => setCompareTeammateId(e.target.value)}
                            className="border border-[#c7bfb0] bg-[#f6f3ec] px-2 py-1 text-xs font-medium text-[#1c1917]"
                          >
                            {comparableTeammates.slice(0, 18).map((tm) => (
                              <option key={tm.id} value={tm.id}>
                                {tm.name} ({tm.position} · $
                                {getContractYearCapHit(
                                  tm.contractYears[actionYear]
                                ).toFixed(1)}
                                M)
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayerAvatar
                                name={player.name}
                                headshotUrl={player.headshotUrl}
                                teamId={derivedState.teamId}
                                size="sm"
                              />
                              <span className="truncate font-editorial text-sm font-bold text-[#1c1917]">
                                {player.name}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono-ledger text-[11px] text-[#57534e]">
                              {player.position} · Age {player.ageIn2026} ·{' '}
                              {player.overallRating} OVR
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 font-mono-ledger text-[11px] pt-1 border-t border-[#dfd9cc]">
                            <div>
                              <div className="text-[#8a8379]">Cap Hit</div>
                              <div className="font-bold text-[#1c1917]">
                                ${playerHit.toFixed(1)}M
                              </div>
                            </div>
                            <div>
                              <div className="text-[#8a8379]">Cut Saves</div>
                              <div
                                className={`font-bold ${
                                  preJuneCut.currentYearCapSavings >= 0
                                    ? 'text-[#2d5a43]'
                                    : 'text-[#b84a27]'
                                }`}
                              >
                                {preJuneCut.currentYearCapSavings >= 0
                                  ? '+$'
                                  : '−$'}
                                {Math.abs(
                                  preJuneCut.currentYearCapSavings
                                ).toFixed(1)}
                                M
                              </div>
                            </div>
                            <div>
                              <div className="text-[#8a8379]">Dead Cap</div>
                              <div className="font-bold text-[#b84a27]">
                                ${preJuneCut.currentYearDeadCap.toFixed(1)}M
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              addCutTransaction(
                                player,
                                'PRE_JUNE_1_CUT',
                                actionYear
                              )
                            }
                            className="w-full border border-[#1c1917] bg-[#fcfaf6] py-1.5 text-[11px] font-semibold text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                          >
                            Keep {teammateLastName} · Cut {playerLastName} (
                            {preJuneCut.currentYearCapSavings >= 0 ? '+$' : '−$'}
                            {Math.abs(preJuneCut.currentYearCapSavings).toFixed(1)}
                            M)
                          </button>
                        </div>

                        <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayerAvatar
                                name={selectedTeammate.name}
                                headshotUrl={selectedTeammate.headshotUrl}
                                teamId={derivedState.teamId}
                                size="sm"
                              />
                              <span className="truncate font-editorial text-sm font-bold text-[#1c1917]">
                                {selectedTeammate.name}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono-ledger text-[11px] text-[#57534e]">
                              {selectedTeammate.position} · Age{' '}
                              {selectedTeammate.ageIn2026} ·{' '}
                              {selectedTeammate.overallRating} OVR
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 font-mono-ledger text-[11px] pt-1 border-t border-[#dfd9cc]">
                            <div>
                              <div className="text-[#8a8379]">Cap Hit</div>
                              <div className="font-bold text-[#1c1917]">
                                ${teammateHit.toFixed(1)}M
                              </div>
                            </div>
                            <div>
                              <div className="text-[#8a8379]">Cut Saves</div>
                              <div
                                className={`font-bold ${
                                  teammateCut.currentYearCapSavings >= 0
                                    ? 'text-[#2d5a43]'
                                    : 'text-[#b84a27]'
                                }`}
                              >
                                {teammateCut.currentYearCapSavings >= 0
                                  ? '+$'
                                  : '−$'}
                                {Math.abs(
                                  teammateCut.currentYearCapSavings
                                ).toFixed(1)}
                                M
                              </div>
                            </div>
                            <div>
                              <div className="text-[#8a8379]">Dead Cap</div>
                              <div className="font-bold text-[#b84a27]">
                                ${teammateCut.currentYearDeadCap.toFixed(1)}M
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              addCutTransaction(
                                selectedTeammate,
                                'PRE_JUNE_1_CUT',
                                actionYear
                              );
                              selectPlayer(null);
                            }}
                            className="w-full border border-[#1c1917] bg-[#1c1917] py-1.5 text-[11px] font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                          >
                            Keep {playerLastName} · Cut {teammateLastName} (
                            {teammateCut.currentYearCapSavings >= 0
                              ? '+$'
                              : '−$'}
                            {Math.abs(
                              teammateCut.currentYearCapSavings
                            ).toFixed(1)}
                            M)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
                  {fateForecast.projectedCompPickRound && (
                    <span className="ml-2 font-semibold text-[#92400e]">
                      · If Walks in {nextUncoveredYear}: Proj. Rd{' '}
                      {fateForecast.projectedCompPickRound} Comp Pick
                    </span>
                  )}
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

            {/* 1-Tap Visual Extension Choice Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    title: 'Team-Friendly Backload',
                    badge: `+3 Yrs · $${fateForecast.projectedMarketApy.toFixed(1)}M/yr`,
                    yearsAdded: 3,
                    apyVal: fateForecast.projectedMarketApy,
                    gtd: 0.55,
                    structure: 'Backloaded' as ContractStructureTemplate,
                    btnLabel: 'Sign +3 Yr Backload',
                    accent: 'border-[#15803d] bg-[#f0fdf4]',
                    btnClass: 'bg-[#15803d] text-white hover:bg-[#14532d]',
                  },
                  {
                    title: 'Cap-Saver Void Deal',
                    badge: `+3 Yrs · $${fateForecast.projectedMarketApy.toFixed(1)}M/yr`,
                    yearsAdded: 3,
                    apyVal: fateForecast.projectedMarketApy,
                    gtd: 0.6,
                    structure: 'VoidHeavy' as ContractStructureTemplate,
                    btnLabel: 'Sign +3 Yr Void Deal',
                    accent: 'border-[#1e3a5f] bg-[#eff6ff]',
                    btnClass: 'bg-[#1e3a5f] text-white hover:bg-[#152c4a]',
                  },
                  {
                    title: 'Short Bridge Deal',
                    badge: `+1 Yr · $${Math.max(1.5, Math.round(fateForecast.projectedMarketApy * 0.9 * 10) / 10).toFixed(1)}M`,
                    yearsAdded: 1,
                    apyVal: Math.max(
                      1.5,
                      Math.round(fateForecast.projectedMarketApy * 0.9 * 10) / 10
                    ),
                    gtd: 0.7,
                    structure: 'Flat' as ContractStructureTemplate,
                    btnLabel: 'Sign +1 Yr Bridge',
                    accent: 'border-[#dfd9cc] bg-[#fcfaf6]',
                    btnClass: 'bg-[#1c1917] text-[#f6f3ec] hover:bg-[#332e2a]',
                  },
                ] as const
              ).map((preset) => {
                const sim = applyPlayerExtension(
                  player,
                  actionYear,
                  preset.yearsAdded,
                  preset.apyVal,
                  preset.gtd,
                  preset.structure
                );
                const deltaCurr = sim.capDeltaByYear[actionYear] ?? 0;
                const hit27 = getContractYearCapHit(
                  sim.updatedPlayer.contractYears[2027]
                );
                return (
                  <div
                    key={preset.title}
                    className={`flex flex-col justify-between border p-3.5 space-y-3 ${preset.accent}`}
                  >
                    <div>
                      <div className="font-mono-ledger text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                        {preset.badge}
                      </div>
                      <h3 className="mt-0.5 font-editorial text-base font-bold text-[#111827]">
                        {preset.title}
                      </h3>
                      <div
                        className={`mt-2 font-mono-ledger text-sm font-bold ${
                          deltaCurr <= 0 ? 'text-[#15803d]' : 'text-[#b91c1c]'
                        }`}
                      >
                        {deltaCurr <= 0
                          ? `Saves +$${Math.abs(deltaCurr).toFixed(1)}M`
                          : `+$${deltaCurr.toFixed(1)}M`}{' '}
                        <span className="text-[11px] font-normal text-[#475569]">
                          in {actionYear}
                        </span>
                      </div>
                      <div className="mt-1 font-mono-ledger text-[11px] text-[#475569]">
                        2027 Cap Hit: ${hit27.toFixed(1)}M
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        addExtensionTransaction(
                          player,
                          preset.yearsAdded,
                          preset.apyVal,
                          preset.gtd,
                          preset.structure,
                          actionYear
                        )
                      }
                      className={`w-full py-2 px-3 text-xs font-semibold transition-colors cursor-pointer ${preset.btnClass}`}
                    >
                      {preset.btnLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Red #11: "Extend Early vs. Wait 1 Year vs. Double-Tag" Cost Comparison */}
            {(() => {
              const fateApy = fateForecast.projectedMarketApy;
              const extendNow3YrTotal = Math.round(fateApy * 3 * 10) / 10;
              const waitOneYearApy = Math.round(fateApy * 1.075 * 10) / 10;
              const waitOneYear3YrTotal = Math.round(waitOneYearApy * 3 * 10) / 10;
              const waitingPenalty =
                Math.round((waitOneYear3YrTotal - extendNow3YrTotal) * 10) / 10;
              const tag1 = franchiseTagAmount;
              const tag2 = Math.round(franchiseTagAmount * 1.2 * 10) / 10;
              const doubleTagTotal = Math.round((tag1 + tag2) * 10) / 10;

              return (
                <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#57534e]">
                      Cost of Waiting · Extend Early vs. Wait 1 Yr vs. Double-Tag
                    </span>
                    <span className="font-mono-ledger text-[11px] font-bold text-[#15803d]">
                      Extending Now Saves +${waitingPenalty.toFixed(1)}M vs. Waiting
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs font-mono-ledger">
                    <div className="border border-[#15803d]/40 bg-[#f0fdf4] p-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#15803d]">
                        1. Extend Early Now
                      </div>
                      <div className="mt-1 text-sm font-bold text-[#111827]">
                        ${fateApy.toFixed(1)}M/yr · ${extendNow3YrTotal.toFixed(1)}M
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#334155]">
                        Locks {actionYear}–{actionYear + 2} rate &amp; spreads bonus
                      </div>
                    </div>

                    <div className="border border-[#d97706]/40 bg-[#fffbeb] p-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#b45309]">
                        2. Wait Until {actionYear + 1} (+7.5% Cap)
                      </div>
                      <div className="mt-1 text-sm font-bold text-[#111827]">
                        ${waitOneYearApy.toFixed(1)}M/yr · +${waitingPenalty.toFixed(1)}M
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#57534e]">
                        ${waitOneYear3YrTotal.toFixed(1)}M over 3 yrs as cap rises
                      </div>
                    </div>

                    <div className="border border-[#dc2626]/40 bg-[#fef2f2] p-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#b91c1c]">
                        3. Double Franchise Tag (120%)
                      </div>
                      <div className="mt-1 text-sm font-bold text-[#111827]">
                        ${doubleTagTotal.toFixed(1)}M (2 yrs Gtd)
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#57534e]">
                        Yr 1 ${tag1.toFixed(1)}M + Yr 2 ${tag2.toFixed(1)}M spike
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <button
                type="button"
                onClick={toggleCustomSliders}
                className="font-mono-ledger text-xs font-semibold text-[#1e3a5f] hover:underline cursor-pointer"
              >
                {showCustomSliders
                  ? 'Hide Custom Terms ▲'
                  : 'Customize Years, APY & Comps ▾'}
              </button>
            </div>

            {showCustomSliders && (
              <div className="space-y-5 border border-[#dfd9cc] bg-[#fcfaf6] p-4">
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
                          className="border border-[#dfd9cc] bg-white p-2 text-left hover:border-[#1c1917] transition-colors cursor-pointer"
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
                    Sign Custom {extYears}-Yr Extension (${(extYears * extApy).toFixed(1)}M)
                  </button>
                </div>
              </div>
            )}
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
