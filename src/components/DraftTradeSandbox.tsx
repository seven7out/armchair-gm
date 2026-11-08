'use client';

import React, { useMemo, useState } from 'react';
import {
  generateRookieContract,
  getDraftPickTradeValue,
  getPlayerTradeValue,
  Player,
  TradeChartModel,
} from '@/engine';
import {
  TOP_DRAFT_PROSPECTS,
} from '@/data/seed/draftPicks';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';
import { PlayerAvatar } from './PlayerAvatar';

export function DraftTradeSandbox() {
  const { derivedState, addDraftSigningTransaction, addTradeTransaction } =
    useGMStore();

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

  const [selectedProspectByPick, setSelectedProspectByPick] = useState<
    Record<string, string>
  >({});

  const partnerTeams = useMemo(
    () =>
      Object.values(SEED_TEAMS)
        .filter((t) => t.id !== derivedState.teamId)
        .map((t) => ({
          id: t.id,
          name: `${t.city} ${t.name}`,
          abbreviation: t.abbreviation,
          logoUrl: t.logoUrl,
          availablePicks: t.draftPicks.slice(0, 5),
          availablePlayers: t.roster.slice(0, 10),
        })),
    [derivedState.teamId]
  );

  const partnerTeam = useMemo(
    () =>
      partnerTeams.find((t) => t.id === partnerTeamId) ??
      partnerTeams[0],
    [partnerTeams, partnerTeamId]
  );

  const replacementCutoff2026 =
    derivedState.years[2026].replacementLevelCutoff;

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

    let fairnessVerdict = 'Balanced Exchange';
    if (totalSent === 0 && totalReceived === 0) {
      fairnessVerdict = 'Select assets on both sides to evaluate parity';
    } else if (parityRatio >= 88 && parityRatio <= 115) {
      fairnessVerdict = 'Fair / Accepted by Partner Club';
    } else if (parityRatio > 115) {
      fairnessVerdict = 'Surplus Value for You (Partner Likely Declines)';
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
    <section className="mx-auto max-w-[1440px] px-6 py-8 space-y-14">
      {/* PART 1: Rookie Wage Scale Ledger */}
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#dfd9cc] pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#8a8379]">
              CBA Rookie Pool Schedule
            </p>
            <h2 className="font-editorial mt-1 text-3xl text-[#1c1917]">
              Draft Pick Wage Scale & Top-51 Displacement
            </h2>
            <p className="mt-1 text-sm text-[#57534e]">
              Signing a draft pick displaces the 51st-lowest contract ($
              {replacementCutoff2026.toFixed(2)}M), so net marginal cap impact is
              substantially lower than gross Year-1 cap hit.
            </p>
          </div>

          <div className="flex items-baseline gap-6 font-mono-ledger text-xs">
            <div>
              <span className="text-[#8a8379]">Gross Rookie Pool:</span>{' '}
              <strong className="text-[#1c1917]">
                ${derivedState.years[2026].rookiePoolReserve.toFixed(2)}M
              </strong>
            </div>
            <div>
              <span className="text-[#8a8379]">Net Cap Impact:</span>{' '}
              <strong className="text-[#2d5a43]">
                −${derivedState.years[2026].netRookiePoolImpact.toFixed(2)}M
              </strong>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
              <tr>
                <th className="py-3 pr-4">Pick / Round</th>
                <th className="py-3 px-4">4-Yr Total</th>
                <th className="py-3 px-4">Signing Bonus</th>
                <th className="py-3 px-4">2026 Gross Hit</th>
                <th className="py-3 px-4">2026 Net Marginal</th>
                <th className="py-3 px-4">2027–2029 Progression</th>
                <th className="py-3 px-4">5th-Yr Option</th>
                <th className="py-3 pl-4">Draft Selection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfd9cc]">
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
                    className="hover:bg-[#fcfaf6] transition-colors"
                  >
                    <td className="py-3.5 pr-4 font-medium text-[#1c1917]">
                      Round {pick.round}, Pick #{pick.overallPick}
                      {pick.originalTeamId !== derivedState.teamId && (
                        <span className="ml-2 font-mono-ledger text-[11px] text-[#8a8379]">
                          (via {pick.originalTeamId})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-ledger text-[#1c1917]">
                      ${slot.totalFourYearValue.toFixed(2)}M
                    </td>
                    <td className="py-3.5 px-4 font-mono-ledger text-[#57534e]">
                      ${slot.signingBonusTotal.toFixed(2)}M ($
                      {slot.annualProratedBonus.toFixed(2)}M/yr)
                    </td>
                    <td className="py-3.5 px-4 font-mono-ledger font-semibold text-[#1c1917]">
                      ${slot.year1CapHit.toFixed(2)}M
                    </td>
                    <td className="py-3.5 px-4 font-mono-ledger font-semibold text-[#2d5a43]">
                      −${slot.year1NetCapImpactAfterDisplacement.toFixed(2)}M
                    </td>
                    <td className="py-3.5 px-4 font-mono-ledger text-[11px] text-[#8a8379]">
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
                    <td className="py-3.5 px-4 font-mono-ledger text-[#57534e]">
                      {slot.projectedFifthYearOption
                        ? `$${slot.projectedFifthYearOption.toFixed(1)}M`
                        : '—'}
                    </td>
                    <td className="py-3.5 pl-4">
                      {pick.selectedPlayerName ? (
                        <span className="font-medium text-[#2d5a43]">
                          Selected: {pick.selectedPlayerName} (
                          {pick.selectedPosition})
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <select
                            aria-label={`Select draft prospect for pick ${pick.overallPick}`}
                            value={selectedProspectId}
                            onChange={(e) =>
                              setSelectedProspectByPick((prev) => ({
                                ...prev,
                                [pick.id]: e.target.value,
                              }))
                            }
                            className="border-b border-[#c7bfb0] bg-transparent py-1 text-xs text-[#1c1917] focus:border-[#1c1917] focus:outline-none"
                          >
                            {TOP_DRAFT_PROSPECTS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.position} · {p.school})
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
                            className="border border-[#1c1917] px-2.5 py-1 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                          >
                            Select
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

      {/* PART 2: Trade Desk */}
      <div className="border-t-2 border-[#1c1917] pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#8a8379]">
              Valuation Model
            </p>
            <h2 className="font-editorial mt-1 text-3xl text-[#1c1917]">
              Multi-Asset Trade Desk
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-3">
              <span className="uppercase tracking-[0.1em] text-[#8a8379]">
                Chart:
              </span>
              <button
                type="button"
                onClick={() => setChartModel('RichHill')}
                className={`pb-0.5 cursor-pointer ${
                  chartModel === 'RichHill'
                    ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                    : 'text-[#8a8379]'
                }`}
              >
                Rich Hill Consensus
              </button>
              <button
                type="button"
                onClick={() => setChartModel('FitzgeraldSpielberger')}
                className={`pb-0.5 cursor-pointer ${
                  chartModel === 'FitzgeraldSpielberger'
                    ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                    : 'text-[#8a8379]'
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
              className="border-b border-[#1c1917] bg-transparent py-1 text-xs font-semibold text-[#1c1917] cursor-pointer"
            >
              {partnerTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  Partner: {t.name} ({t.abbreviation})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Minimalist Parity Scale */}
        <div className="mb-8 border-y border-[#dfd9cc] py-4">
          <div className="flex items-baseline justify-between text-xs mb-2">
            <span className="font-mono-ledger">
              Outgoing Value: <strong>{tradeEvaluation.totalSent} pts</strong>
            </span>
            <span className="font-editorial text-sm italic text-[#1c1917]">
              {tradeEvaluation.fairnessVerdict}
            </span>
            <span className="font-mono-ledger">
              Incoming Value: <strong>{tradeEvaluation.totalReceived} pts</strong>
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#e5dfd3] flex overflow-hidden">
            <div
              className="bg-[#1c1917] h-full transition-all duration-300"
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
            <div className="bg-[#2d5a43] h-full flex-1 transition-all duration-300" />
          </div>
        </div>

        {/* Two-Column Open Ledger */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#dfd9cc]">
          {/* Left: Outgoing */}
          <div className="lg:pr-8">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#57534e] mb-3">
              {derivedState.teamName} Assets
            </h3>

            <div className="flex flex-wrap gap-2 mb-6">
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
                    className={`border px-2.5 py-1 text-xs font-mono-ledger transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                        : 'border-[#c7bfb0] text-[#1c1917] hover:border-[#1c1917]'
                    }`}
                  >
                    Rd {pk.round} (#{pk.overallPick}) · {val} pts
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-[#dfd9cc] border-t border-[#dfd9cc]">
              {derivedState.roster.slice(0, 10).map((p: Player) => {
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
                    className={`flex w-full items-baseline justify-between py-2.5 px-2 text-left text-xs transition-colors cursor-pointer ${
                      selected ? 'bg-[#ede8dd] font-semibold' : 'hover:bg-[#fcfaf6]'
                    }`}
                  >
                    <div>
                      <span className="text-[#1c1917]">{p.name}</span>{' '}
                      <span className="text-[#8a8379]">
                        ({p.position} · Age {p.ageIn2026})
                      </span>
                    </div>
                    <span className="font-mono-ledger text-[#57534e]">
                      {val} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Incoming */}
          <div className="pt-8 lg:pt-0 lg:pl-8">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#57534e] mb-3">
              {partnerTeam.logoUrl && (
                <img
                  src={partnerTeam.logoUrl}
                  alt=""
                  className="h-4 w-4 object-contain"
                />
              )}
              <span>{partnerTeam.name} Assets</span>
            </h3>

            <div className="flex flex-wrap gap-2 mb-6">
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
                    className={`border px-2.5 py-1 text-xs font-mono-ledger transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#2d5a43] bg-[#2d5a43] text-[#f6f3ec]'
                        : 'border-[#c7bfb0] text-[#1c1917] hover:border-[#1c1917]'
                    }`}
                  >
                    Rd {pk.round} (#{pk.overallPick}) · {val} pts
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-[#dfd9cc] border-t border-[#dfd9cc]">
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
                    className={`flex w-full items-center justify-between py-2.5 px-2 text-left text-xs transition-colors cursor-pointer ${
                      selected ? 'bg-[#ede8dd] font-semibold' : 'hover:bg-[#fcfaf6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        name={p.name}
                        headshotUrl={p.headshotUrl}
                        size="sm"
                      />
                      <div>
                        <div className="text-sm font-medium text-[#1c1917]">
                          {p.name}{' '}
                          <span className="text-xs font-normal text-[#8a8379]">
                            ({p.position} · OVR {p.overallRating})
                          </span>
                        </div>
                        <div className="font-mono-ledger text-[11px] text-[#8a8379]">
                          2026 Acquiring Base: ${acquiringHit.toFixed(2)}M
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-ledger text-[#2d5a43]">
                      {val} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[#dfd9cc] pt-5">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#8a8379]">Accounting:</span>
            <button
              type="button"
              onClick={() => setTradeDesignation('PRE_JUNE_1')}
              className={`cursor-pointer ${
                tradeDesignation === 'PRE_JUNE_1'
                  ? 'underline font-semibold text-[#1c1917]'
                  : 'text-[#8a8379]'
              }`}
            >
              Pre-June 1
            </button>
            <button
              type="button"
              onClick={() => setTradeDesignation('POST_JUNE_1')}
              className={`cursor-pointer ${
                tradeDesignation === 'POST_JUNE_1'
                  ? 'underline font-semibold text-[#1c1917]'
                  : 'text-[#8a8379]'
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
            className="bg-[#1c1917] px-6 py-2.5 text-xs font-medium text-[#f6f3ec] hover:bg-[#332e2a] disabled:opacity-40 cursor-pointer"
          >
            Record Trade in Notebook
          </button>
        </div>
      </div>
    </section>
  );
}
