'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
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
        if (e.target === dialogRef.current) selectPlayer(null);
      }}
      className="m-auto w-full max-w-2xl border border-[#1c1917] bg-[#f6f3ec] p-0 text-[#1c1917] shadow-xl backdrop:bg-[#1c1917]/30"
    >
      {/* Editorial Header */}
      <div className="flex items-start justify-between border-b border-[#dfd9cc] px-7 py-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-[#8a8379]">
            {player.position} · Age {player.ageIn2026} · OVR {player.overallRating}{' '}
            · {player.accruedSeasons} Accrued Seasons
          </div>
          <h2 id={titleId} className="font-editorial mt-1 text-2xl text-[#1c1917]">
            {player.name}
          </h2>
          {player.notes && (
            <p className="mt-1 text-xs text-[#57534e]">{player.notes}</p>
          )}
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

      {/* Current 4-Year Ledger Strip */}
      <div className="border-b border-[#dfd9cc] bg-[#ede8dd]/50 px-7 py-4">
        <div className="mb-2.5 flex items-baseline justify-between text-xs">
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
            return (
              <div
                key={yr}
                className={`${idx === 0 ? 'pr-4' : idx === 3 ? 'pl-4' : 'px-4'}`}
              >
                <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                  {yr}
                </div>
                {cy ? (
                  <>
                    <div className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                      ${hit.toFixed(2)}M{cy.isVoidYear ? ' (Void)' : ''}
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

      {/* Action Mode Tabs */}
      <div className="flex border-b border-[#dfd9cc] px-7 pt-3 gap-6 text-xs uppercase tracking-[0.1em]">
        {(
          [
            { id: 'restructure', label: 'Restructure' },
            { id: 'cut', label: 'Release (Pre / Post-June 1)' },
            { id: 'extend', label: 'Extend Contract' },
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
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#dfd9cc]">
            <div className=" flex flex-col justify-between sm:pr-4">
              <div>
                <h3 className="font-editorial text-lg text-[#1c1917]">
                  Pre-June 1 Release
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
                    <span>$0.00M</span>
                  </div>
                  <div className="flex justify-between border-t border-[#dfd9cc] pt-2 font-semibold">
                    <span>{actionYear} Net Savings:</span>
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
                <h3 className="font-editorial text-lg text-[#1c1917]">
                  Post-June 1 Designation
                </h3>
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
                    <span>{actionYear} Net Savings:</span>
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
                Designate Post-June 1
              </button>
            </div>
          </div>
        )}

        {activeTab === 'extend' && (
          <div className="space-y-5">
            {fifthYearOptionAmount !== null && (
              <div className="flex items-center justify-between border border-[#2d5a43] bg-[#2d5a43]/5 px-4 py-3 text-xs">
                <div>
                  <div className="font-semibold text-[#2d5a43]">
                    Eligible for Round 1 Fifth-Year Option (2027)
                  </div>
                  <div className="text-[#57534e]">
                    Projected fully guaranteed salary: $
                    {fifthYearOptionAmount.toFixed(2)}M
                  </div>
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
                  className="bg-[#2d5a43] px-3 py-1.5 text-xs font-medium text-[#f6f3ec] cursor-pointer"
                >
                  Exercise Option
                </button>
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
                  max={60}
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
                    const found = TRADE_PARTNER_TEAMS.find((t) => t.id === nextId);
                    if (found && found.availablePicks[0]) {
                      setSelectedIncomingPickId(found.availablePicks[0].id);
                    }
                  }}
                  className="mt-2 w-full border-b border-[#1c1917] bg-transparent py-1.5 text-xs font-medium text-[#1c1917]"
                >
                  {TRADE_PARTNER_TEAMS.map((t) => (
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
                  Timing
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
                    Pre-June 1
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
                    Post-June 1
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
                · Dead Cap: ${tradeSim.currentYearDeadCap.toFixed(2)}M
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
