'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  DollarSign,
  PlusCircle,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  buildStructuredContract,
  ContractStructureTemplate,
  evaluatePlayerLongevity,
  FreeAgentTarget,
  LEAGUE_YEARS,
  POSITIONAL_AGING_CURVES,
} from '@/engine';
import { SEED_FREE_AGENTS } from '@/data/seed/freeAgents';
import { useGMStore } from '@/store/useGMStore';

export function FreeAgencySimulatorView({
  isModal = false,
}: {
  isModal?: boolean;
}) {
  const {
    derivedState,
    addSignFATransaction,
    selectPlayer,
    setActiveTab,
  } = useGMStore();

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

  const apySliderId = useId();

  const handleSelectFA = (fa: FreeAgentTarget) => {
    setSelectedFA(fa);
    setYears(fa.marketYears);
    setApy(fa.marketApy);
    setGuaranteedPct(fa.marketGuaranteedPct);
  };

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

  // Identify in-house extension candidates expiring in 2026
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

  return (
    <div className={isModal ? 'p-6' : 'mx-auto max-w-[1600px] px-4 py-6 sm:px-6'}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 5 Cols: Top Free Agent Market Pool + In-House Expiring Core */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Open Market Free Agent Targets (2026 Pool)
            </h3>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {SEED_FREE_AGENTS.map((fa) => {
                const isSelected = selectedFA.id === fa.id;
                const faCurve = POSITIONAL_AGING_CURVES[fa.position];
                return (
                  <button
                    key={fa.id}
                    type="button"
                    onClick={() => handleSelectFA(fa)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-emerald-500/80 bg-emerald-950/30 shadow-md'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          {fa.position}
                        </span>
                        <span className="font-bold text-sm text-white">
                          {fa.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Age {fa.ageIn2026} (Cliff @ {faCurve.cliffAge})
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        ~${fa.marketApy.toFixed(1)}M/yr
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                      {fa.scoutingNote}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* In-House Impending Free Agents */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2.5 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              In-House Impending Free Agents (Expiring After 2026)
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {inHouseExpiringPlayers.map((p) => {
                const lon = evaluatePlayerLongevity(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{p.name}</span>{' '}
                      <span className="text-slate-400">
                        ({p.position} • Age {p.ageIn2026} • OVR {p.overallRating})
                      </span>
                      <div className="text-[10px] text-emerald-400">
                        {lon.extensionRecommendation} (+
                        {lon.postContractViableYears} viable post-deal yrs)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        selectPlayer(p.id);
                      }}
                      className="rounded-lg bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 px-2.5 py-1 text-[11px] font-bold text-indigo-200 hover:text-white transition"
                    >
                      Extend
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Interactive Multi-Year Contract Architect */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                    {selectedFA.position}
                  </span>
                  <h2 className="text-xl font-black text-white">
                    {selectedFA.name}
                  </h2>
                  <span className="text-xs text-slate-400">
                    Age {selectedFA.ageIn2026} • OVR {selectedFA.overallRating} •
                    Prev: {selectedFA.previousTeam}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {selectedFA.scoutingNote}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-right">
                <div className="text-[10px] uppercase text-slate-400">
                  Total Contract Value
                </div>
                <div className="font-mono text-lg font-black text-emerald-400">
                  ${offer.totalValue.toFixed(1)}M{' '}
                  <span className="text-xs font-normal text-slate-400">
                    (${offer.totalGuaranteed.toFixed(1)}M Gtd)
                  </span>
                </div>
              </div>
            </div>

            {/* Sliders & Structure Templates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex justify-between text-xs mb-2">
                  <label htmlFor={apySliderId} className="font-bold text-slate-200">
                    Average Per Year (APY)
                  </label>
                  <span className="font-mono font-bold text-emerald-400">
                    ${apy.toFixed(1)}M / yr (
                    {(
                      (apy / derivedState.years[2026].adjustedCapCeiling) *
                      100
                    ).toFixed(1)}
                    % of Cap)
                  </span>
                </div>
                <input
                  id={apySliderId}
                  type="range"
                  min={2}
                  max={45}
                  step={0.5}
                  value={apy}
                  aria-valuetext={`$${apy.toFixed(1)} Million per year`}
                  onChange={(e) => setApy(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                  <span>Market Est: ${selectedFA.marketApy.toFixed(1)}M</span>
                  <span>Signing Bonus: ${offer.signingBonusTotal.toFixed(1)}M</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-bold text-slate-200">
                    Contract Length & Guarantee %
                  </span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {years} Yrs • {Math.round(guaranteedPct * 100)}% Gtd
                  </span>
                </div>
                <div className="flex gap-1.5 mb-2.5">
                  {[1, 2, 3, 4].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYears(y)}
                      className={`flex-1 rounded-lg py-1 text-xs font-bold ${
                        years === y
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {y} Yr{y > 1 ? 's' : ''}
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
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            {/* Structure Template Pills */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2">
                Cap Structure Template
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    {
                      id: 'Backloaded',
                      label: 'Team-Friendly Backload',
                      desc: 'Low 2026 base + prorated bonus',
                    },
                    {
                      id: 'Flat',
                      label: 'Flat / Balanced',
                      desc: 'Evenly paced cap hits',
                    },
                    {
                      id: 'FrontLoaded',
                      label: 'Front-Loaded',
                      desc: 'Pay early, $0 future dead cap',
                    },
                    {
                      id: 'VoidHeavy',
                      label: 'Void-Year Max Deferral',
                      desc: 'Pushes bonus into void years',
                    },
                  ] as const
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setStructure(tpl.id)}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      structure === tpl.id
                        ? 'border-emerald-500 bg-emerald-950/40 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{tpl.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tpl.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Year Cap & Positional Cliff Impact Preview */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-300">
                  4-Year Cap Hit & Team Effective Space Ripple Preview
                </span>
                <span className="text-[11px] text-teal-400">
                  2026 Top-51 Displacement: -$
                  {replacementCutoff.toFixed(2)}M offset applied
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {LEAGUE_YEARS.map((yr) => {
                  const cy = offer.contractYears[yr];
                  const hit = offer.capHitsByYear[yr];
                  const playerAge = selectedFA.ageIn2026 + (yr - 2026);
                  const isPastCliff = playerAge >= curve.cliffAge;
                  const currentTeamSpace =
                    derivedState.years[yr].effectiveCapSpace;
                  const newTeamSpace =
                    currentTeamSpace -
                    (cy && !cy.isVoidYear
                      ? Math.max(
                          0,
                          hit - derivedState.years[yr].replacementLevelCutoff
                        )
                      : cy?.isVoidYear
                      ? cy.proratedBonus
                      : 0);

                  return (
                    <div
                      key={yr}
                      className={`rounded-xl border p-3 text-xs ${
                        cy?.isVoidYear
                          ? 'border-dashed border-purple-500/40 bg-purple-950/20'
                          : cy
                          ? 'border-slate-800 bg-slate-950'
                          : 'border-dashed border-slate-800 bg-slate-950/40 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white">{yr}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            isPastCliff ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          Age {playerAge}
                          {isPastCliff ? ' ⚠️' : ''}
                        </span>
                      </div>

                      {cy ? (
                        <>
                          <div className="font-mono text-base font-black text-white">
                            ${hit.toFixed(2)}M
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {cy.isVoidYear
                              ? 'Void Year Proration'
                              : `Base $${cy.baseSalary.toFixed(1)}M + Bonus $${cy.proratedBonus.toFixed(1)}M`}
                          </div>
                          <div
                            className={`mt-2 border-t border-slate-800 pt-1.5 font-mono text-[10px] font-bold ${
                              newTeamSpace < 0
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            New {yr} Cap: ${newTeamSpace.toFixed(1)}M
                          </div>
                        </>
                      ) : (
                        <div className="py-3 text-[11px] text-slate-500">
                          Not Under Contract
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                2026 Gross Cap Hit:{' '}
                <strong className="text-white">
                  ${offer.capHitsByYear[2026].toFixed(2)}M
                </strong>{' '}
                • True Net Marginal Cost:{' '}
                <strong className="text-emerald-400">
                  -${net2026Impact.toFixed(2)}M
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
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition"
              >
                <PlusCircle className="h-4 w-4" />
                Sign {selectedFA.name} to Roster
              </button>
            </div>
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
      className="m-auto w-full max-w-6xl rounded-2xl border border-slate-700/80 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          <h2 id={titleId} className="text-base font-bold text-white">
            Free Agency & Multi-Year Contract Structure Simulator
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setFreeAgencyModalOpen(false)}
          aria-label="Close Free Agency Simulator"
          className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isFreeAgencyModalOpen && <FreeAgencySimulatorView isModal />}
    </dialog>
  );
}
