'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  CalendarPlus,
  Check,
  Scissors,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import {
  applyPlayerExtension,
  ContractStructureTemplate,
  evaluatePlayerLongevity,
  getContractYearCapHit,
  getProjectedFifthYearOption,
  LEAGUE_YEARS,
  LeagueYear,
  simulateCutOrTrade,
  simulateRestructure,
} from '@/engine';
import { TRADE_PARTNER_TEAMS } from '@/data/seed/draftPicks';
import { useGMStore } from '@/store/useGMStore';

type ActionTab = 'cut' | 'restructure' | 'extend' | 'trade';

export function ContractActionDrawer() {
  const {
    derivedState,
    selectedPlayerId,
    selectPlayer,
    addCutTransaction,
    addRestructureTransaction,
    addExtensionTransaction,
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

  // Restructure Controls
  const [restructurePct, setRestructurePct] = useState<number>(1.0);
  const [addVoidYears, setAddVoidYears] = useState<number>(1);

  // Extension Controls
  const [extYears, setExtYears] = useState<number>(3);
  const [extApy, setExtApy] = useState<number>(22.0);
  const [extGuaranteedPct, setExtGuaranteedPct] = useState<number>(0.6);
  const [extStructure, setExtStructure] =
    useState<ContractStructureTemplate>('Backloaded');

  // Quick Trade Controls
  const [partnerTeamId, setPartnerTeamId] = useState<string>('LV');
  const [selectedIncomingPickId, setSelectedIncomingPickId] =
    useState<string>('lv-2026-2');
  const [tradeDesignation, setTradeDesignation] = useState<
    'PRE_JUNE_1' | 'POST_JUNE_1'
  >('PRE_JUNE_1');

  // Open / close native <dialog> modal
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (player) {
      if (!dialog.open) {
        dialog.showModal();
      }
      // Set default sensible tab & APY when opening for a new player
      const cy2026 = player.contractYears[2026];
      if (cy2026 && cy2026.baseSalary > 4.0) {
        setActiveTab('restructure');
      } else if (!player.contractYears[2027]) {
        setActiveTab('extend');
      } else {
        setActiveTab('cut');
      }
      const estimatedMarketApy = Math.max(
        4.5,
        Math.round((player.overallRating - 68) * 1.15 * 10) / 10
      );
      setExtApy(estimatedMarketApy);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [player]);

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
  const preJuneCut = simulateCutOrTrade(player, actionYear, 'PRE_JUNE_1_CUT');
  const postJuneCut = simulateCutOrTrade(player, actionYear, 'POST_JUNE_1_CUT');
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

  const partnerTeam =
    TRADE_PARTNER_TEAMS.find((t) => t.id === partnerTeamId) ??
    TRADE_PARTNER_TEAMS[0];
  const incomingPick =
    partnerTeam.availablePicks.find((pk) => pk.id === selectedIncomingPickId) ??
    partnerTeam.availablePicks[0];
  const tradeSim = simulateCutOrTrade(
    player,
    actionYear,
    tradeDesignation === 'POST_JUNE_1' ? 'POST_JUNE_1_TRADE' : 'PRE_JUNE_1_TRADE'
  );

  const fifthYearOptionAmount =
    player.draftRound === 1 &&
    player.isRookieContract &&
    !player.fifthYearOptionExercised &&
    player.draftPick
      ? getProjectedFifthYearOption(player.draftPick, player.position)
      : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      onClose={() => selectPlayer(null)}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          selectPlayer(null);
        }
      }}
      className="m-auto w-full max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300 border border-indigo-500/30">
              {player.position}
            </span>
            <h2 id={titleId} className="text-lg font-bold text-white">
              {player.name}
            </h2>
            <span className="text-xs text-slate-400">
              Age {player.ageIn2026} • OVR {player.overallRating} •{' '}
              {player.accruedSeasons} Accrued Seasons
            </span>
          </div>
          {player.notes && (
            <p className="mt-1 text-xs text-slate-300">{player.notes}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => selectPlayer(null)}
          aria-label="Close contract drawer"
          className="rounded-lg bg-slate-800/80 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Current 4-Year Contract Snapshot Strip */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-6 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-400 uppercase tracking-wider">
            Current 2026–2029 Contract Ledger
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Action League Year:</span>
            {([2026, 2027] as LeagueYear[]).map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setActionYear(yr)}
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  actionYear === yr
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {LEAGUE_YEARS.map((yr) => {
            const cy = player.contractYears[yr];
            const hit = getContractYearCapHit(cy);
            const age = player.ageIn2026 + (yr - 2026);
            return (
              <div
                key={yr}
                className={`rounded-lg border p-2.5 text-xs ${
                  cy?.isVoidYear
                    ? 'border-dashed border-purple-500/40 bg-purple-950/20'
                    : cy
                    ? 'border-slate-800 bg-slate-900'
                    : 'border-dashed border-slate-800 bg-slate-950/40 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-bold text-slate-200">{yr}</span>
                  <span>Age {age}</span>
                </div>
                {cy ? (
                  <>
                    <div className="font-mono text-sm font-black text-white">
                      ${hit.toFixed(2)}M{' '}
                      {cy.isVoidYear && (
                        <span className="text-[10px] font-semibold text-purple-300">
                          (VOID)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Base: ${cy.baseSalary.toFixed(2)}M | Bonus: $
                      {cy.proratedBonus.toFixed(2)}M
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 py-1">
                    Unsigned / FA
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Mode Selector Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-6 pt-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('restructure')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
            activeTab === 'restructure'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Restructure Slider
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cut')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
            activeTab === 'cut'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Scissors className="h-3.5 w-3.5" />
          Release (Pre vs Post-June 1)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('extend')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
            activeTab === 'extend'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Extend / 5th-Yr Option
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trade')}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition ${
            activeTab === 'trade'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Trade Player
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="p-6">
        {/* 1. RESTRUCTURE TAB */}
        {activeTab === 'restructure' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={restructureSliderId}
                  className="text-xs font-bold text-white"
                >
                  Convert {actionYear} Base Salary Above Vet Minimum ($
                  {restructureSim.vetMinimumFloor.toFixed(2)}M Floor)
                </label>
                <span className="font-mono text-sm font-black text-indigo-400">
                  {Math.round(restructurePct * 100)}% ($
                  {restructureSim.convertedBonusAmount.toFixed(2)}M Converted)
                </span>
              </div>

              <input
                id={restructureSliderId}
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(restructurePct * 100)}
                aria-valuetext={`${Math.round(restructurePct * 100)}% of restructurable salary ($${restructureSim.convertedBonusAmount.toFixed(2)}M)`}
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Add Void Years for Proration:</span>
                  {[0, 1, 2].map((vCount) => (
                    <button
                      key={vCount}
                      type="button"
                      onClick={() => setAddVoidYears(vCount)}
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        addVoidYears === vCount
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      +{vCount} Void Yr{vCount === 1 ? '' : 's'}
                    </button>
                  ))}
                </div>
                <span className="text-slate-300">
                  Prorated across{' '}
                  <strong>{restructureSim.prorationYearsCount} seasons</strong> (+$
                  {restructureSim.annualProrationAdded.toFixed(2)}M/yr)
                </span>
              </div>
            </div>

            {/* 4-Year Ripple Preview */}
            <div className="grid grid-cols-4 gap-2.5">
              {LEAGUE_YEARS.map((yr) => {
                const delta = restructureSim.capDeltaByYear[yr];
                const newHit = getContractYearCapHit(
                  restructureSim.updatedPlayer.contractYears[yr]
                );
                return (
                  <div
                    key={yr}
                    className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs"
                  >
                    <div className="text-slate-400 font-semibold">{yr} New Hit</div>
                    <div className="font-mono text-base font-bold text-white mt-0.5">
                      ${newHit.toFixed(2)}M
                    </div>
                    <div
                      className={`mt-1 font-mono text-xs font-bold ${
                        delta < 0
                          ? 'text-emerald-400'
                          : delta > 0
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {delta < 0
                        ? `Saves $${Math.abs(delta).toFixed(2)}M`
                        : delta > 0
                        ? `+$${delta.toFixed(2)}M Proration`
                        : 'No change'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">
                Creates{' '}
                <strong className="text-emerald-400">
                  +${restructureSim.currentYearCapSavings.toFixed(2)}M
                </strong>{' '}
                in {actionYear} cap space by pushing dead-cap risk into{' '}
                {actionYear + 1}–2029.
              </p>
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
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition"
              >
                <Check className="h-4 w-4" />
                Execute Restructure (+$
                {restructureSim.currentYearCapSavings.toFixed(2)}M)
              </button>
            </div>
          </div>
        )}

        {/* 2. RELEASE (PRE-JUNE 1 VS POST-JUNE 1) TAB */}
        {activeTab === 'cut' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Pre-June 1 Card */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Standard Pre-June 1 Release
                  </h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    Immediate Acceleration
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  All remaining unamortized signing bonus accelerates immediately into{' '}
                  {actionYear} Dead Money; {actionYear + 1}–2029 books are 100% clean.
                </p>

                <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{actionYear} Original Cap Hit:</span>
                    <span className="font-mono text-white">
                      ${preJuneCut.currentYearOriginalCapHit.toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{actionYear} Accelerated Dead Cap:</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      ${preJuneCut.currentYearDeadCap.toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{actionYear + 1} Dead Cap:</span>
                    <span className="font-mono text-emerald-400">$0.00M</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold">
                    <span className="text-white">{actionYear} Net Cap Savings:</span>
                    <span
                      className={`font-mono ${
                        preJuneCut.currentYearCapSavings >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {preJuneCut.currentYearCapSavings >= 0 ? '+' : ''}$
                      {preJuneCut.currentYearCapSavings.toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  addCutTransaction(player, 'PRE_JUNE_1_CUT', actionYear)
                }
                className="mt-4 w-full rounded-xl bg-rose-600/90 hover:bg-rose-500 py-2.5 text-xs font-bold text-white transition"
              >
                Release Pre-June 1 ({preJuneCut.currentYearCapSavings >= 0 ? '+' : ''}
                ${preJuneCut.currentYearCapSavings.toFixed(2)}M)
              </button>
            </div>

            {/* Post-June 1 Designation Card */}
            <div className="flex flex-col justify-between rounded-xl border border-indigo-500/40 bg-indigo-950/20 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Post-June 1 Designation
                  </h3>
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                    Split Dead Cap
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  Only {actionYear}&apos;s scheduled bonus proration stays on{' '}
                  {actionYear}; future unamortized bonus defers into {actionYear + 1}{' '}
                  Dead Money.
                </p>

                <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{actionYear} Original Cap Hit:</span>
                    <span className="font-mono text-white">
                      ${postJuneCut.currentYearOriginalCapHit.toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{actionYear} Dead Cap Kept:</span>
                    <span className="font-mono text-amber-300 font-semibold">
                      ${postJuneCut.currentYearDeadCap.toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {actionYear + 1} Deferred Dead Cap:
                    </span>
                    <span className="font-mono text-amber-400 font-semibold">
                      ${postJuneCut.nextYearDeadCap.toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold">
                    <span className="text-white">{actionYear} Net Cap Savings:</span>
                    <span
                      className={`font-mono ${
                        postJuneCut.currentYearCapSavings >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {postJuneCut.currentYearCapSavings >= 0 ? '+' : ''}$
                      {postJuneCut.currentYearCapSavings.toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  addCutTransaction(player, 'POST_JUNE_1_CUT', actionYear)
                }
                className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold text-white transition"
              >
                Designate Post-June 1 (
                {postJuneCut.currentYearCapSavings >= 0 ? '+' : ''}$
                {postJuneCut.currentYearCapSavings.toFixed(2)}M)
              </button>
            </div>
          </div>
        )}

        {/* 3. EXTEND / 5TH-YEAR OPTION TAB */}
        {activeTab === 'extend' && (
          <div className="space-y-4">
            {/* Optional 1st-Round 5th-Year Option Banner */}
            {fifthYearOptionAmount !== null && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <Sparkles className="h-4 w-4" />
                    Eligible for Round 1 Fifth-Year Option (2027)
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Pick #{player.draftPick} ({player.position}) projected 5th-year
                    option: <strong>${fifthYearOptionAmount.toFixed(2)}M</strong> fully
                    guaranteed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    addFifthYearOptionTransaction(
                      player,
                      2027,
                      fifthYearOptionAmount
                    )
                  }
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition"
                >
                  Exercise 2027 Option (${fifthYearOptionAmount.toFixed(1)}M)
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                  Years Added ({extYears} Yrs)
                </label>
                <div className="mt-2 flex gap-1.5">
                  {[1, 2, 3].map((yrs) => (
                    <button
                      key={yrs}
                      type="button"
                      onClick={() => setExtYears(yrs)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                        extYears === yrs
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      +{yrs} Yr{yrs > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                  New Money APY: ${extApy.toFixed(1)}M / yr
                </label>
                <input
                  type="range"
                  min={2}
                  max={60}
                  step={0.5}
                  value={extApy}
                  onChange={(e) => setExtApy(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-emerald-500"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Total New: ${(extApy * extYears).toFixed(1)}M</span>
                  <span>
                    {((extApy / derivedState.years[2026].adjustedCapCeiling) * 100).toFixed(
                      1
                    )}
                    % of 2026 Cap
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                  Structure Template
                </label>
                <select
                  value={extStructure}
                  onChange={(e) =>
                    setExtStructure(e.target.value as ContractStructureTemplate)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  <option value="Backloaded">Team-Friendly Backload</option>
                  <option value="Flat">Flat / Balanced</option>
                  <option value="FrontLoaded">Front-Loaded</option>
                  <option value="VoidHeavy">Max Void-Year Proration</option>
                </select>
              </div>
            </div>

            {/* Post-Extension 4-Year Cap Preview */}
            <div className="grid grid-cols-4 gap-2.5">
              {LEAGUE_YEARS.map((yr) => {
                const newCy = extensionSim.updatedPlayer.contractYears[yr];
                const newHit = getContractYearCapHit(newCy);
                const delta = extensionSim.capDeltaByYear[yr];
                return (
                  <div
                    key={yr}
                    className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs"
                  >
                    <div className="text-slate-400 font-semibold">{yr} Extended Hit</div>
                    <div className="font-mono text-base font-bold text-white mt-0.5">
                      ${newHit.toFixed(2)}M
                    </div>
                    <div
                      className={`mt-1 font-mono text-[11px] font-semibold ${
                        delta < 0
                          ? 'text-emerald-400'
                          : delta > 0
                          ? 'text-indigo-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {delta < 0
                        ? `Saves $${Math.abs(delta).toFixed(2)}M in ${yr}`
                        : delta > 0
                        ? `+$${delta.toFixed(2)}M added`
                        : 'Unchanged'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-300">
                Longevity Verdict:{' '}
                <strong className="text-emerald-400">
                  {longevity.extensionRecommendation}
                </strong>{' '}
                ({longevity.postContractViableYears} viable starter yr
                {longevity.postContractViableYears === 1 ? '' : 's'} before Age-
                {longevity.cliffAge} cliff)
              </div>
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
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition"
              >
                <Check className="h-4 w-4" />
                Sign {extYears}-Yr, ${(extYears * extApy).toFixed(1)}M Extension
              </button>
            </div>
          </div>
        )}

        {/* 4. QUICK TRADE TAB */}
        {activeTab === 'trade' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                  Trade Partner Team
                </label>
                <select
                  value={partnerTeamId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPartnerTeamId(nextId);
                    const found = TRADE_PARTNER_TEAMS.find((t) => t.id === nextId);
                    if (found && found.availablePicks[0]) {
                      setSelectedIncomingPickId(found.availablePicks[0].id);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  {TRADE_PARTNER_TEAMS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                  Draft Pick Compensation Received
                </label>
                <select
                  value={selectedIncomingPickId}
                  onChange={(e) => setSelectedIncomingPickId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
                >
                  {partnerTeam.availablePicks.map((pk) => (
                    <option key={pk.id} value={pk.id}>
                      2026 Round {pk.round}, Pick #{pk.overallPick} ({pk.originalTeamId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                  Trade Timing Designation
                </label>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTradeDesignation('PRE_JUNE_1')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                      tradeDesignation === 'PRE_JUNE_1'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Pre-June 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeDesignation('POST_JUNE_1')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                      tradeDesignation === 'POST_JUNE_1'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Post-June 1
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-slate-400">
                    Base Salary Transferred to {partnerTeam.abbreviation}:
                  </span>{' '}
                  <strong className="font-mono text-white">
                    ${player.contractYears[actionYear]?.baseSalary.toFixed(2) ?? '0.00'}M
                  </strong>
                  <p className="mt-1 text-slate-400">
                    Guaranteed base salary travels with the player on a trade; only
                    unamortized bonus proration stays on your dead cap.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-400">
                    {actionYear} Trade Cap Savings:{' '}
                    {tradeSim.currentYearCapSavings >= 0 ? '+' : ''}$
                    {tradeSim.currentYearCapSavings.toFixed(2)}M
                  </div>
                  <div className="text-amber-300 font-mono">
                    {actionYear} Dead Cap: ${tradeSim.currentYearDeadCap.toFixed(2)}M
                    {tradeSim.nextYearDeadCap > 0 &&
                      ` (+$${tradeSim.nextYearDeadCap.toFixed(2)}M in ${actionYear + 1})`}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
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
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Trade {player.name} to {partnerTeam.abbreviation} for Pick #
                {incomingPick?.overallPick}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
