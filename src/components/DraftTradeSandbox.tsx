'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Award,
  CheckCircle2,
  Scale,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  generateRookieContract,
  getDraftPickTradeValue,
  getPlayerTradeValue,
  Player,
  TradeChartModel,
} from '@/engine';
import {
  TOP_DRAFT_PROSPECTS,
  TRADE_PARTNER_TEAMS,
} from '@/data/seed/draftPicks';
import { useGMStore } from '@/store/useGMStore';

export function DraftTradeSandbox() {
  const {
    derivedState,
    addDraftSigningTransaction,
    addTradeTransaction,
  } = useGMStore();

  const [chartModel, setChartModel] = useState<TradeChartModel>('RichHill');
  const [partnerTeamId, setPartnerTeamId] = useState<string>('LV');
  const [tradeDesignation, setTradeDesignation] = useState<
    'PRE_JUNE_1' | 'POST_JUNE_1'
  >('PRE_JUNE_1');

  const [selectedOutgoingPlayerIds, setSelectedOutgoingPlayerIds] = useState<
    string[]
  >([]);
  const [selectedOutgoingPickIds, setSelectedOutgoingPickIds] = useState<
    string[]
  >([]);
  const [selectedIncomingPlayerIds, setSelectedIncomingPlayerIds] = useState<
    string[]
  >([]);
  const [selectedIncomingPickIds, setSelectedIncomingPickIds] = useState<
    string[]
  >([]);

  // Selected prospect per pick ID for quick rookie simulation
  const [selectedProspectByPick, setSelectedProspectByPick] = useState<
    Record<string, string>
  >({});

  const partnerTeam = useMemo(
    () =>
      TRADE_PARTNER_TEAMS.find((t) => t.id === partnerTeamId) ??
      TRADE_PARTNER_TEAMS[0],
    [partnerTeamId]
  );

  const replacementCutoff2026 =
    derivedState.years[2026].replacementLevelCutoff;

  // Compute Trade Value Sent vs Received
  const tradeEvaluation = useMemo(() => {
    const outgoingPlayers = derivedState.roster.filter((p) =>
      selectedOutgoingPlayerIds.includes(p.id)
    );
    const outgoingPicks = derivedState.draftPicks.filter((pk) =>
      selectedOutgoingPickIds.includes(pk.id)
    );
    const incomingPlayers = partnerTeam.availablePlayers.filter((p) =>
      selectedIncomingPlayerIds.includes(p.id)
    );
    const incomingPicks = partnerTeam.availablePicks.filter((pk) =>
      selectedIncomingPickIds.includes(pk.id)
    );

    const sentPlayersVal = outgoingPlayers.reduce(
      (acc, p) => acc + getPlayerTradeValue(p, chartModel, 2026),
      0
    );
    const sentPicksVal = outgoingPicks.reduce(
      (acc, pk) => acc + getDraftPickTradeValue(pk.overallPick, chartModel),
      0
    );
    const recPlayersVal = incomingPlayers.reduce(
      (acc, p) => acc + getPlayerTradeValue(p, chartModel, 2026),
      0
    );
    const recPicksVal = incomingPicks.reduce(
      (acc, pk) => acc + getDraftPickTradeValue(pk.overallPick, chartModel),
      0
    );

    const totalSent = sentPlayersVal + sentPicksVal;
    const totalReceived = recPlayersVal + recPicksVal;
    const parityRatio =
      totalSent + totalReceived > 0
        ? (totalReceived / Math.max(1, totalSent)) * 100
        : 100;

    let fairnessVerdict = 'Balanced Trade Package';
    if (totalSent === 0 && totalReceived === 0) {
      fairnessVerdict = 'Select assets on both sides to evaluate parity';
    } else if (parityRatio >= 88 && parityRatio <= 115) {
      fairnessVerdict = 'Fair / Accepted by AI Front Office';
    } else if (parityRatio > 115) {
      fairnessVerdict = 'Favorable Surplus for You (Partner Likely Declines Without Sweetener)';
    } else {
      fairnessVerdict = 'Overpay by Your Front Office';
    }

    return {
      outgoingPlayers,
      outgoingPicks,
      incomingPlayers,
      incomingPicks,
      totalSent,
      totalReceived,
      parityRatio,
      fairnessVerdict,
    };
  }, [
    derivedState.roster,
    derivedState.draftPicks,
    partnerTeam,
    selectedOutgoingPlayerIds,
    selectedOutgoingPickIds,
    selectedIncomingPlayerIds,
    selectedIncomingPickIds,
    chartModel,
  ]);

  const toggleId = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    id: string
  ) => {
    setList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 space-y-8">
      {/* PART 1: Rookie Wage Scale & Top-51 Displacement Calculator */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-teal-400" />
              Rookie Pool Wage Scale & Top-51 Displacement Simulator
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every draft pick signed displaces the 51st-lowest contract on your
              roster (currently{' '}
              <strong className="text-slate-200">
                ${replacementCutoff2026.toFixed(2)}M
              </strong>
              ), so Net Cap Impact reflects true marginal cap space consumed.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs">
            <div>
              <span className="text-slate-400">Gross Rookie Pool:</span>{' '}
              <strong className="font-mono text-white">
                ${derivedState.years[2026].rookiePoolReserve.toFixed(2)}M
              </strong>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400">Net Cap Impact (After Top-51):</span>{' '}
              <strong className="font-mono text-teal-400">
                ${derivedState.years[2026].netRookiePoolImpact.toFixed(2)}M
              </strong>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-[11px] uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Pick / Round</th>
                <th className="py-2.5 px-3">4-Yr Total Deal</th>
                <th className="py-2.5 px-3">Signing Bonus (Prorated)</th>
                <th className="py-2.5 px-3">2026 Gross Cap Hit</th>
                <th className="py-2.5 px-3">2026 Net Marginal Cost</th>
                <th className="py-2.5 px-3">2027–2029 Cap Hits</th>
                <th className="py-2.5 px-3">5th-Yr Option Est.</th>
                <th className="py-2.5 px-4">Simulate Draft Selection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {derivedState.draftPicks.map((pick) => {
                const slot = generateRookieContract(
                  pick.overallPick,
                  pick.year,
                  'EDGE',
                  replacementCutoff2026
                );
                const selectedProspectId =
                  selectedProspectByPick[pick.id] ?? TOP_DRAFT_PROSPECTS[0].id;
                const prospect =
                  TOP_DRAFT_PROSPECTS.find((p) => p.id === selectedProspectId) ??
                  TOP_DRAFT_PROSPECTS[0];

                return (
                  <tr
                    key={pick.id}
                    className="bg-slate-900/40 hover:bg-slate-900/80 transition"
                  >
                    <td className="py-3 px-4 font-bold text-white">
                      Rd {pick.round}, Pick #{pick.overallPick}
                      {pick.originalTeamId !== derivedState.teamId && (
                        <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                          via {pick.originalTeamId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-200">
                      ${slot.totalFourYearValue.toFixed(2)}M
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      ${slot.signingBonusTotal.toFixed(2)}M ($
                      {slot.annualProratedBonus.toFixed(2)}M/yr)
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      ${slot.year1CapHit.toFixed(2)}M
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-teal-400">
                      -${slot.year1NetCapImpactAfterDisplacement.toFixed(2)}M
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      ${(
                        (slot.contractYears[2027]?.baseSalary ?? 0) +
                        slot.annualProratedBonus
                      ).toFixed(2)}
                      M → $
                      {(
                        (slot.contractYears[2028]?.baseSalary ?? 0) +
                        slot.annualProratedBonus
                      ).toFixed(2)}
                      M → $
                      {(
                        (slot.contractYears[2029]?.baseSalary ?? 0) +
                        slot.annualProratedBonus
                      ).toFixed(2)}
                      M
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {slot.projectedFifthYearOption
                        ? `$${slot.projectedFifthYearOption.toFixed(1)}M`
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {pick.selectedPlayerName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Drafted: {pick.selectedPlayerName} ({pick.selectedPosition})
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Select draft prospect for pick ${pick.overallPick}`}
                            value={selectedProspectId}
                            onChange={(e) =>
                              setSelectedProspectByPick((prev) => ({
                                ...prev,
                                [pick.id]: e.target.value,
                              }))
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                          >
                            {TOP_DRAFT_PROSPECTS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.position} - {p.school})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              addDraftSigningTransaction({
                                pickId: pick.id,
                                overallPick: pick.overallPick,
                                round: pick.round,
                                prospectName: prospect.name,
                                position: prospect.position,
                              })
                            }
                            className="flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 px-2.5 py-1 text-xs font-bold text-white transition"
                          >
                            <UserPlus className="h-3 w-3" /> Draft
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PART 2: Interactive Multi-Asset Trade Value Calculator */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="h-4 w-4 text-amber-400" />
              Front-Office Trade Builder & Value Chart Parity Meter
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Package players and draft picks across teams. Toggle between the{' '}
              <strong>Rich Hill</strong> consensus chart and the analytical{' '}
              <strong>Fitzgerald-Spielberger</strong> curve.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setChartModel('RichHill')}
                className={`rounded px-2.5 py-1 font-semibold ${
                  chartModel === 'RichHill'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rich Hill Chart
              </button>
              <button
                type="button"
                onClick={() => setChartModel('FitzgeraldSpielberger')}
                className={`rounded px-2.5 py-1 font-semibold ${
                  chartModel === 'FitzgeraldSpielberger'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fitzgerald-Spielberger
              </button>
            </div>

            <select
              aria-label="Select Trade Partner Team"
              value={partnerTeamId}
              onChange={(e) => {
                setPartnerTeamId(e.target.value);
                setSelectedIncomingPlayerIds([]);
                setSelectedIncomingPickIds([]);
              }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white"
            >
              {TRADE_PARTNER_TEAMS.map((t) => (
                <option key={t.id} value={t.id}>
                  Partner: {t.name} ({t.abbreviation})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Parity Meter Banner */}
        <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <div>
              <span className="text-slate-400">Your Package Sent:</span>{' '}
              <strong className="font-mono text-sm text-indigo-400">
                {tradeEvaluation.totalSent} pts
              </strong>
            </div>
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {tradeEvaluation.fairnessVerdict}
            </div>
            <div>
              <span className="text-slate-400">
                {partnerTeam.abbreviation} Package Received:
              </span>{' '}
              <strong className="font-mono text-sm text-emerald-400">
                {tradeEvaluation.totalReceived} pts
              </strong>
            </div>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 flex">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{
                width: `${
                  tradeEvaluation.totalSent + tradeEvaluation.totalReceived > 0
                    ? (tradeEvaluation.totalSent /
                        (tradeEvaluation.totalSent +
                          tradeEvaluation.totalReceived)) *
                      100
                    : 50
                }%`,
              }}
            />
            <div className="bg-emerald-500 h-full flex-1 transition-all duration-300" />
          </div>
        </div>

        {/* Two-Column Asset Selector */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Your Team Assets */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3">
              {derivedState.teamName} Outgoing Assets
            </h3>

            <div className="mb-3 text-[11px] font-semibold text-slate-400">
              Draft Picks
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {derivedState.draftPicks.map((pk) => {
                const val = getDraftPickTradeValue(pk.overallPick, chartModel);
                const selected = selectedOutgoingPickIds.includes(pk.id);
                return (
                  <button
                    key={pk.id}
                    type="button"
                    onClick={() =>
                      toggleId(
                        selectedOutgoingPickIds,
                        setSelectedOutgoingPickIds,
                        pk.id
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-indigo-400 bg-indigo-600/30 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Rd {pk.round} (#{pk.overallPick}) •{' '}
                    <span className="font-mono text-indigo-300">{val} pts</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-2 text-[11px] font-semibold text-slate-400">
              Tradeable Roster Players (Top 12)
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 max-h-60 overflow-y-auto pr-1">
              {derivedState.roster.slice(0, 12).map((p: Player) => {
                const val = getPlayerTradeValue(p, chartModel, 2026);
                const selected = selectedOutgoingPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      toggleId(
                        selectedOutgoingPlayerIds,
                        setSelectedOutgoingPlayerIds,
                        p.id
                      )
                    }
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                      selected
                        ? 'border-indigo-400 bg-indigo-600/30 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {p.position} • Age {p.ageIn2026}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-indigo-300">
                      {val} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Partner Team Assets */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-3">
              {partnerTeam.name} Incoming Assets
            </h3>

            <div className="mb-3 text-[11px] font-semibold text-slate-400">
              Partner Draft Picks
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {partnerTeam.availablePicks.map((pk) => {
                const val = getDraftPickTradeValue(pk.overallPick, chartModel);
                const selected = selectedIncomingPickIds.includes(pk.id);
                return (
                  <button
                    key={pk.id}
                    type="button"
                    onClick={() =>
                      toggleId(
                        selectedIncomingPickIds,
                        setSelectedIncomingPickIds,
                        pk.id
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-emerald-400 bg-emerald-600/30 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Rd {pk.round} (#{pk.overallPick}) •{' '}
                    <span className="font-mono text-emerald-300">{val} pts</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-2 text-[11px] font-semibold text-slate-400">
              Partner Blockbuster Trade Targets
            </div>
            <div className="grid grid-cols-1 gap-2">
              {partnerTeam.availablePlayers.map((p) => {
                const val = getPlayerTradeValue(p, chartModel, 2026);
                const selected = selectedIncomingPlayerIds.includes(p.id);
                const acquiringHit = p.contractYears[2026]?.baseSalary ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      toggleId(
                        selectedIncomingPlayerIds,
                        setSelectedIncomingPlayerIds,
                        p.id
                      )
                    }
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-xs transition ${
                      selected
                        ? 'border-emerald-400 bg-emerald-600/30 text-white'
                        : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">
                        {p.name}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          ({p.position} • OVR {p.overallRating})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Acquiring 2026 Base Salary: ${acquiringHit.toFixed(2)}M (Zero
                        Prior Bonus Proration)
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-300">
                      {val} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Cap Accounting Designation:</span>
            <button
              type="button"
              onClick={() => setTradeDesignation('PRE_JUNE_1')}
              className={`rounded px-2.5 py-1 font-semibold ${
                tradeDesignation === 'PRE_JUNE_1'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400'
              }`}
            >
              Pre-June 1
            </button>
            <button
              type="button"
              onClick={() => setTradeDesignation('POST_JUNE_1')}
              className={`rounded px-2.5 py-1 font-semibold ${
                tradeDesignation === 'POST_JUNE_1'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400'
              }`}
            >
              Post-June 1
            </button>
          </div>

          <button
            type="button"
            disabled={
              tradeEvaluation.totalSent === 0 &&
              tradeEvaluation.totalReceived === 0
            }
            onClick={() => {
              addTradeTransaction({
                partnerTeamId: partnerTeam.id,
                partnerTeamName: partnerTeam.name,
                designation: tradeDesignation,
                outgoingPlayers: tradeEvaluation.outgoingPlayers,
                incomingPlayers: tradeEvaluation.incomingPlayers,
                outgoingPickIds: selectedOutgoingPickIds,
                incomingPicks: tradeEvaluation.incomingPicks,
                tradeValueSent: tradeEvaluation.totalSent,
                tradeValueReceived: tradeEvaluation.totalReceived,
              });
              setSelectedOutgoingPlayerIds([]);
              setSelectedOutgoingPickIds([]);
              setSelectedIncomingPlayerIds([]);
              setSelectedIncomingPickIds([]);
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Execute Multi-Asset Trade onto Scenario Stack
          </button>
        </div>
      </div>
    </section>
  );
}
