'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  generateRookieContract,
  getDraftPickTradeValue,
  getPlayerTradeValue,
  Player,
  roundCap,
  simulateCutOrTrade,
  simulateRestructure,
  TradeChartModel,
} from '@/engine';
import {
  TOP_DRAFT_PROSPECTS,
} from '@/data/seed/draftPicks';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';
import { JargonTip } from './JargonTooltip';
import { PlayerAvatar } from './PlayerAvatar';

export function DraftTradeSandbox() {
  const {
    derivedState,
    addDraftSigningTransaction,
    addTradeTransaction,
    addRestructureTransaction,
  } = useGMStore();

  const [chartModel, setChartModel] = useState<TradeChartModel>('RichHill');
  const [subTab, setSubTab] = useState<'trade' | 'draft'>('trade');
  const [futurePickDiscount, setFuturePickDiscount] = useState<number>(1);
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
  const [tradePlayerSearch, setTradePlayerSearch] = useState<string>('');

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
          availablePlayers: t.roster.slice(0, 12),
        })),
    [derivedState.teamId]
  );

  const leagueSearchMatches = useMemo(() => {
    const q = tradePlayerSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const matches: { teamId: string; teamAbbr: string; player: Player }[] = [];
    for (const t of partnerTeams) {
      for (const p of t.availablePlayers) {
        if (
          p.name.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q)
        ) {
          matches.push({
            teamId: t.id,
            teamAbbr: t.abbreviation,
            player: p,
          });
        }
      }
    }
    return matches.slice(0, 8);
  }, [partnerTeams, tradePlayerSearch]);

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

    const calcForChart = (chart: TradeChartModel) => {
      const sentPlayersVal = outgoingPlayers.reduce(
        (acc, p) => acc + getPlayerTradeValue(p, chart, 2026),
        0
      );
      const sentPicksVal = outgoingPicks.reduce(
        (acc, pk) =>
          acc +
          getDraftPickTradeValue(
            pk.overallPick,
            chart,
            pk.year > 2026 ? futurePickDiscount : 0
          ),
        0
      );
      const recPlayersVal = incomingPlayers.reduce(
        (acc, p) => acc + getPlayerTradeValue(p, chart, 2026),
        0
      );
      const recPicksVal = incomingPicks.reduce(
        (acc, pk) =>
          acc +
          getDraftPickTradeValue(
            pk.overallPick,
            chart,
            pk.year > 2026 ? futurePickDiscount : 0
          ),
        0
      );
      return {
        sent: sentPlayersVal + sentPicksVal,
        received: recPlayersVal + recPicksVal,
      };
    };

    const byChart: Record<TradeChartModel, { sent: number; received: number }> = {
      RichHill: calcForChart('RichHill'),
      JimmyJohnson: calcForChart('JimmyJohnson'),
      FitzgeraldSpielberger: calcForChart('FitzgeraldSpielberger'),
    };

    const totalSent = byChart[chartModel].sent;
    const totalReceived = byChart[chartModel].received;
    const parityRatio =
      totalSent + totalReceived > 0
        ? (totalReceived / Math.max(1, totalSent)) * 100
        : 100;

    // Anti-Exploit AI GM Logic (prevents bundling many late picks for a Round 1 pick or Elite star)
    const hasIncomingBlueChip =
      incomingPlayers.some((p) => p.overallRating >= 88 || p.position === 'QB') ||
      incomingPicks.some((pk) => pk.overallPick <= 20);
    const hasOutgoingTopAsset =
      outgoingPlayers.some((p) => p.overallRating >= 84) ||
      outgoingPicks.some((pk) => pk.round <= 2);
    const isQuantityForQualityExploit =
      hasIncomingBlueChip &&
      !hasOutgoingTopAsset &&
      outgoingPicks.length + outgoingPlayers.length >= 3;

    let fairnessVerdict = 'Balanced Exchange';
    let aiGmReason =
      'Select players or draft picks on both sides to see the partner GM verdict.';

    if (totalSent === 0 && totalReceived === 0) {
      fairnessVerdict = 'Select assets on both sides to evaluate parity';
    } else if (isQuantityForQualityExploit) {
      fairnessVerdict = 'Rejected by AI GM (No Blue-Chip Anchor)';
      aiGmReason = `${partnerTeam.name} refuse to trade a Round 1 / Elite asset for a bundle of Day-3 picks without a Round 1–2 cornerstone included.`;
    } else if (hasIncomingBlueChip && parityRatio > 105) {
      fairnessVerdict = 'Declined — Blue-Chip / QB Premium Required';
      aiGmReason = `${partnerTeam.name} demand at least a 95–105% return when moving a franchise cornerstone or Top-20 pick.`;
    } else if (parityRatio >= 88 && parityRatio <= 115) {
      fairnessVerdict = 'Fair / Accepted by Partner Club';
      aiGmReason = `${partnerTeam.name} accept (${Math.round(parityRatio)}% value parity on ${chartModel} chart).`;
    } else if (parityRatio > 115) {
      fairnessVerdict = 'Surplus Value for You (Partner Declines)';
      aiGmReason = `${partnerTeam.name} decline: package is ${Math.round(parityRatio - 100)}% short of market value.`;
    } else {
      fairnessVerdict = 'Overpay by Your Front Office (Partner Accepts)';
      aiGmReason = `${partnerTeam.name} immediately accept your ${Math.round(100 - parityRatio)}% overpay.`;
    }

    // Compute live 2026 Cap Space Delta, Seller Dead Cap, and Rookie Pool Cap Delta
    const mode =
      tradeDesignation === 'POST_JUNE_1'
        ? 'POST_JUNE_1_TRADE'
        : 'PRE_JUNE_1_TRADE';
    let ourCapDelta2026 = 0;
    let partnerCapDelta2026 = 0;
    let ourDeadCapAdded2026 = 0;
    let sellerDeadCapAdded2026 = 0;
    let buyerDayOfTradeCapNeeded = 0;

    for (const outP of outgoingPlayers) {
      const sim = simulateCutOrTrade(outP, 2026, mode);
      ourCapDelta2026 += sim.currentYearCapSavings;
      ourDeadCapAdded2026 += sim.currentYearDeadCap;
      const cy = outP.contractYears[2026];
      if (cy) {
        partnerCapDelta2026 -=
          cy.baseSalary + cy.rosterBonus + cy.workoutBonus;
      }
    }

    for (const inP of incomingPlayers) {
      const sim = simulateCutOrTrade(inP, 2026, mode);
      partnerCapDelta2026 += sim.currentYearCapSavings;
      sellerDeadCapAdded2026 += sim.currentYearDeadCap;
      const cy = inP.contractYears[2026];
      if (cy) {
        const inherited = cy.baseSalary + cy.rosterBonus + cy.workoutBonus;
        ourCapDelta2026 -= inherited;
        buyerDayOfTradeCapNeeded += inherited;
      }
    }

    // Rookie Pool Net Cap Impact of Draft Picks Traded
    let rookiePoolCapDelta2026 = 0;
    for (const outPk of outgoingPicks) {
      if (outPk.year === 2026) {
        const slot = generateRookieContract(
          outPk.overallPick,
          2026,
          'EDGE',
          replacementCutoff2026
        );
        rookiePoolCapDelta2026 += slot.year1NetCapImpactAfterDisplacement; // Sending pick saves rookie cap space
      }
    }
    for (const inPk of incomingPicks) {
      if (inPk.year === 2026) {
        const slot = generateRookieContract(
          inPk.overallPick,
          2026,
          'EDGE',
          replacementCutoff2026
        );
        rookiePoolCapDelta2026 -= slot.year1NetCapImpactAfterDisplacement; // Acquiring pick costs rookie cap space
      }
    }

    ourCapDelta2026 = roundCap(ourCapDelta2026 + rookiePoolCapDelta2026);
    const projectedOurSpaceAfterTrade = roundCap(
      derivedState.years[2026].effectiveCapSpace + ourCapDelta2026
    );
    const capShortfallToFitToday = roundCap(
      Math.max(0, -projectedOurSpaceAfterTrade)
    );

    // Suggested restructures on our roster to close any cap gap
    const suggestedRestructures = derivedState.roster
      .filter((p) => !selectedOutgoingPlayerIds.includes(p.id))
      .map((p) => ({
        player: p,
        sim: simulateRestructure(p, 2026, 1.0, 1),
      }))
      .filter((x) => x.sim.currentYearCapSavings >= 2.0)
      .sort(
        (a, b) => b.sim.currentYearCapSavings - a.sim.currentYearCapSavings
      )
      .slice(0, 3);

    return {
      outgoingPlayers,
      outgoingPicks,
      incomingPlayers,
      incomingPicks,
      byChart,
      totalSent,
      totalReceived,
      parityRatio,
      fairnessVerdict,
      aiGmReason,
      ourCapDelta2026,
      partnerCapDelta2026: roundCap(partnerCapDelta2026),
      ourDeadCapAdded2026: roundCap(ourDeadCapAdded2026),
      sellerDeadCapAdded2026: roundCap(sellerDeadCapAdded2026),
      buyerDayOfTradeCapNeeded: roundCap(buyerDayOfTradeCapNeeded),
      rookiePoolCapDelta2026: roundCap(rookiePoolCapDelta2026),
      projectedOurSpaceAfterTrade,
      capShortfallToFitToday,
      suggestedRestructures,
    };
  }, [
    derivedState.roster,
    derivedState.draftPicks,
    derivedState.years,
    partnerTeam,
    selectedOutgoingPlayerIds,
    selectedOutgoingPickIds,
    selectedIncomingPlayerIds,
    selectedIncomingPickIds,
    chartModel,
    futurePickDiscount,
    tradeDesignation,
    replacementCutoff2026,
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
    <section className="mx-auto max-w-[1440px] px-6 py-8 space-y-8">
      {/* Journey 04 Intro & Sub-Tab Switcher */}
      <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8379]">
              Journey 04 · Trade Wizard &amp; 2026 Rookie Draft
            </span>
            <h1 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
              {subTab === 'trade'
                ? 'Can We Fit This Trade Target Under Today’s Cap?'
                : '2026 NFL Draft Picks & Rookie Wage Scale'}
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              {subTab === 'trade'
                ? 'Remember the #1 NFL trade rule: the old team keeps any unpaid signing bonus, while your team only takes on the player’s remaining base salary—and must fit his cap hit on the day of the trade.'
                : 'Every draft pick gets a fixed 4-year rookie contract and displaces your 51st-lowest contract, so the net cap cost is much smaller than the gross salary.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSubTab('trade')}
              className={`border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'trade'
                  ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                  : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
              }`}
            >
              4A. &ldquo;Can We Fit Him?&rdquo; Trade Wizard
            </button>
            <button
              type="button"
              onClick={() => setSubTab('draft')}
              className={`border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'draft'
                  ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                  : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#1c1917] hover:border-[#1c1917]'
              }`}
            >
              4B. 2026 Mock Draft &amp; Rookie Scale ({derivedState.draftPicks.length} Picks)
            </button>
          </div>
        </div>
      </div>

      {/* PART 1: Rookie Wage Scale Ledger (Shown when subTab === 'draft') */}
      {subTab === 'draft' && (
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
      )}

      {/* PART 2: Trade Desk (Shown when subTab === 'trade') */}
      {subTab === 'trade' && (
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#8a8379]">
              Valuation Model &amp; &ldquo;Can We Fit Him?&rdquo; Trade Wizard
            </p>
            <h2 className="font-editorial mt-1 text-3xl text-[#1c1917]">
              Multi-Asset Trade Desk (3-Chart Comparison)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-3">
              <span className="uppercase tracking-[0.1em] text-[#8a8379]">
                <JargonTip term="TRADE_VALUE_CHART">Chart</JargonTip>:
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
                Rich Hill
              </button>
              <button
                type="button"
                onClick={() => setChartModel('JimmyJohnson')}
                className={`pb-0.5 cursor-pointer ${
                  chartModel === 'JimmyJohnson'
                    ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                    : 'text-[#8a8379]'
                }`}
              >
                Jimmy Johnson
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

            <button
              type="button"
              onClick={() =>
                setFuturePickDiscount((prev) => (prev === 1 ? 0 : 1))
              }
              className="border border-[#c7bfb0] px-2 py-0.5 font-mono-ledger text-[11px] text-[#57534e] hover:border-[#1c1917] cursor-pointer"
              title="Discount future draft picks by ~1 round (~18% per year)"
            >
              Future Pick Discount: {futurePickDiscount === 1 ? '1 Rd (−18%)' : 'Off'}
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="search"
                value={tradePlayerSearch}
                onChange={(e) => setTradePlayerSearch(e.target.value)}
                placeholder="Find player across 31 teams..."
                aria-label="Search trade targets across 31 teams"
                className="w-52 border-b border-[#c7bfb0] bg-transparent py-1 pl-7 pr-2 text-xs text-[#1c1917] placeholder-[#8a8379] focus:border-[#1c1917] focus:outline-none"
              />
              {leagueSearchMatches.length > 0 && (
                <div className="absolute right-0 top-full z-30 mt-1 w-72 border border-[#1c1917] bg-[#fcfaf6] shadow-lg divide-y divide-[#dfd9cc]">
                  {leagueSearchMatches.map(({ teamId, teamAbbr, player }) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        setPartnerTeamId(teamId);
                        setSelectedIncomingPlayerIds([player.id]);
                        setTradePlayerSearch('');
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#ede8dd] cursor-pointer"
                    >
                      <div>
                        <span className="font-medium text-[#1c1917]">
                          {player.name}
                        </span>{' '}
                        <span className="text-[11px] text-[#8a8379]">
                          ({player.position} · {teamAbbr})
                        </span>
                      </div>
                      <span className="font-mono-ledger text-[10px] text-[#2d5a43]">
                        Select →
                      </span>
                    </button>
                  ))}
                </div>
              )}
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

        {/* Minimalist Parity Scale + 3-Chart Comparison + "Can We Fit Him?" Trade Wizard */}
        <div className="mb-8 border-y border-[#dfd9cc] py-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-mono-ledger">
              Outgoing Value ({chartModel}):{' '}
              <strong>{tradeEvaluation.totalSent} pts</strong>
            </span>
            <div className="text-center">
              <div className="font-editorial text-sm italic text-[#1c1917]">
                {tradeEvaluation.fairnessVerdict}
              </div>
              <div className="text-[11px] text-[#57534e]">
                {tradeEvaluation.aiGmReason}
              </div>
            </div>
            <span className="font-mono-ledger">
              Incoming Value ({chartModel}):{' '}
              <strong>{tradeEvaluation.totalReceived} pts</strong>
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

          {/* All 3 Trade Charts Side-by-Side Comparison */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 border-b border-[#dfd9cc] pb-3 font-mono-ledger text-[11px] text-[#57534e]">
            <div>
              <strong>Rich Hill (NFL Consensus):</strong> Sent{' '}
              {tradeEvaluation.byChart.RichHill.sent} vs Rec{' '}
              {tradeEvaluation.byChart.RichHill.received} pts
            </div>
            <div>
              <strong>Jimmy Johnson (Classic):</strong> Sent{' '}
              {tradeEvaluation.byChart.JimmyJohnson.sent} vs Rec{' '}
              {tradeEvaluation.byChart.JimmyJohnson.received} pts
            </div>
            <div>
              <strong>Fitzgerald-Spielberger:</strong> Sent{' '}
              {tradeEvaluation.byChart.FitzgeraldSpielberger.sent} vs Rec{' '}
              {tradeEvaluation.byChart.FitzgeraldSpielberger.received} pts
            </div>
          </div>

          {/* THE "CAN WE FIT HIM TODAY?" TRADE WIZARD */}
          <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                  &ldquo;Can We Fit Him Today?&rdquo; Trade Cap Wizard
                </span>
                {tradeEvaluation.capShortfallToFitToday <= 0 ? (
                  <span className="bg-[#2d5a43] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#f6f3ec]">
                    ✓ Fits Now (+$
                    {tradeEvaluation.projectedOurSpaceAfterTrade.toFixed(2)}M Left
                    After Trade)
                  </span>
                ) : (
                  <span className="bg-[#b84a27] px-2 py-0.5 font-mono-ledger text-[11px] font-semibold text-[#f6f3ec]">
                    ⚠ Needs +${tradeEvaluation.capShortfallToFitToday.toFixed(2)}M
                    More Room on Trade Day
                  </span>
                )}
              </div>

              <div className="font-mono-ledger text-[11px] text-[#57534e]">
                {derivedState.teamName} 2026 Cap Delta:{' '}
                <strong
                  className={
                    tradeEvaluation.ourCapDelta2026 >= 0
                      ? 'text-[#2d5a43]'
                      : 'text-[#b84a27]'
                  }
                >
                  {tradeEvaluation.ourCapDelta2026 >= 0 ? '+$' : '−$'}
                  {Math.abs(tradeEvaluation.ourCapDelta2026).toFixed(2)}M
                </strong>
                {tradeEvaluation.rookiePoolCapDelta2026 !== 0 && (
                  <span className="ml-2 text-[#8a8379]">
                    (Includes{' '}
                    {tradeEvaluation.rookiePoolCapDelta2026 >= 0 ? '+$' : '−$'}
                    {Math.abs(tradeEvaluation.rookiePoolCapDelta2026).toFixed(2)}M
                    Rookie Pool shift)
                  </span>
                )}
              </div>
            </div>

            {/* Buyer vs Seller Cap Math Explanation */}
            <div className="flex flex-wrap items-center justify-between gap-4 font-mono-ledger text-[11px] text-[#57534e]">
              <div>
                Buyer ({derivedState.teamName}) Must Fit Full Base on Trade Day:{' '}
                <strong className="text-[#1c1917]">
                  ${tradeEvaluation.buyerDayOfTradeCapNeeded.toFixed(2)}M
                </strong>{' '}
                (Even if restructuring afterward)
              </div>
              <div>
                Seller ({partnerTeam.name}) 2026 Cap Delta:{' '}
                <strong
                  className={
                    tradeEvaluation.partnerCapDelta2026 >= 0
                      ? 'text-[#2d5a43]'
                      : 'text-[#b84a27]'
                  }
                >
                  {tradeEvaluation.partnerCapDelta2026 >= 0 ? '+$' : '−$'}
                  {Math.abs(tradeEvaluation.partnerCapDelta2026).toFixed(2)}M
                </strong>{' '}
                (Seller eats ${tradeEvaluation.sellerDeadCapAdded2026.toFixed(2)}M
                dead bonus)
              </div>
            </div>

            {/* 1-Click Suggestions to Close the Cap Gap (or Create Trade Room) */}
            {tradeEvaluation.suggestedRestructures.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dfd9cc] pt-2.5">
                <span className="text-[11px] text-[#57534e]">
                  <strong>1-Click Cap Levers to Fit Target Today:</strong>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {tradeEvaluation.suggestedRestructures.map(({ player, sim }) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() =>
                        addRestructureTransaction(player, 1.0, 1, 2026)
                      }
                      className="border border-[#1c1917] bg-[#f6f3ec] px-2.5 py-1 font-mono-ledger text-[11px] text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                    >
                      Restructure {player.name} (+$
                      {sim.currentYearCapSavings.toFixed(1)}M now, +$
                      {sim.annualProrationAdded.toFixed(1)}M/yr later)
                    </button>
                  ))}
                </div>
              </div>
            )}
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
      )}
    </section>
  );
}
