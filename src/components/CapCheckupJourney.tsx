'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Scissors,
  Wand2,
} from 'lucide-react';
import {
  evaluateTeamCapHealth,
  getContractYearCapHit,
  simulateCutOrTrade,
  simulateRestructure,
} from '@/engine';
import { useGMStore } from '@/store/useGMStore';
import { PlayerAvatar } from './PlayerAvatar';
import { JargonTip } from './JargonTooltip';

export function CapCheckupJourney() {
  const {
    derivedState,
    transactions,
    selectPlayer,
    applyMaxTopRestructures,
    addRestructureTransaction,
    addCutTransaction,
  } = useGMStore();

  const [showMathReceipt, setShowMathReceipt] = useState(false);
  const [showSecondContractWall, setShowSecondContractWall] = useState(false);

  const capHealth = useMemo(
    () => evaluateTeamCapHealth(derivedState),
    [derivedState]
  );

  const y26 = derivedState.years[2026];
  const rawCapSpaceBeforeRookies =
    y26.adjustedCapCeiling - y26.activeTop51Cap - y26.deadMoneyTotal;

  // Build top Restructure & Cut candidates with live 1-click simulations
  const { restructureCards, cutCards } = useMemo(() => {
    const activePlayers = derivedState.roster;

    const alreadyRestructuredIds = new Set(
      transactions
        .filter((t) => t.type === 'RESTRUCTURE' && t.enabled)
        .map((t) => (t.type === 'RESTRUCTURE' ? t.playerId : ''))
    );

    const restructures = activePlayers
      .map((player) => {
        const sim = simulateRestructure(player, 2026, 1.0, 2);
        const capHit26 = getContractYearCapHit(player.contractYears[2026]);
        return {
          player,
          sim,
          capHit26,
          revisedCapHit26: getContractYearCapHit(
            sim.updatedPlayer.contractYears[2026]
          ),
          alreadyDone: alreadyRestructuredIds.has(player.id),
        };
      })
      .filter((item) => item.sim.currentYearCapSavings >= 1.5)
      .sort(
        (a, b) => b.sim.currentYearCapSavings - a.sim.currentYearCapSavings
      )
      .slice(0, 5);

    const cuts = activePlayers
      .map((player) => {
        const preJune = simulateCutOrTrade(player, 2026, 'PRE_JUNE_1_CUT');
        const postJune = simulateCutOrTrade(player, 2026, 'POST_JUNE_1_CUT');
        const bestSavings = Math.max(
          preJune.currentYearCapSavings,
          postJune.currentYearCapSavings
        );
        return {
          player,
          preJune,
          postJune,
          bestSavings,
          capHit26: getContractYearCapHit(player.contractYears[2026]),
        };
      })
      .filter((item) => item.bestSavings >= 2.0)
      .sort((a, b) => b.bestSavings - a.bestSavings)
      .slice(0, 5);

    return { restructureCards: restructures, cutCards: cuts };
  }, [derivedState.roster, transactions]);

  const tierStyles = {
    CAP_WARCHEST: {
      badgeBg: 'bg-[#2d5a43]/15 text-[#2d5a43] border-[#2d5a43]/40',
      borderAccent: 'border-l-4 border-l-[#2d5a43]',
      amountColor: 'text-[#2d5a43]',
    },
    HEALTHY_FLEXIBLE: {
      badgeBg: 'bg-[#2d5a43]/10 text-[#2d5a43] border-[#2d5a43]/30',
      borderAccent: 'border-l-4 border-l-[#2d5a43]',
      amountColor: 'text-[#2d5a43]',
    },
    TIGHT_SQUEEZE: {
      badgeBg: 'bg-[#b57c1e]/15 text-[#b57c1e] border-[#b57c1e]/40',
      borderAccent: 'border-l-4 border-l-[#b57c1e]',
      amountColor: 'text-[#b57c1e]',
    },
    SEVERE_CRUNCH: {
      badgeBg: 'bg-[#b84a27]/15 text-[#b84a27] border-[#b84a27]/40',
      borderAccent: 'border-l-4 border-l-[#b84a27]',
      amountColor: 'text-[#b84a27]',
    },
  }[capHealth.tier];

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
      {/* 2026 Team Cap Verdict Card */}
      <section
        className={`border border-[#dfd9cc] bg-[#fcfaf6] p-6 ${tierStyles.borderAccent}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${tierStyles.badgeBg}`}
            >
              {capHealth.tierLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowMathReceipt((prev) => !prev)}
            className="flex items-center gap-1.5 border border-[#dfd9cc] bg-[#f6f3ec] px-3 py-1 text-xs font-medium text-[#1c1917] hover:border-[#1c1917] cursor-pointer"
          >
            <span>
              {showMathReceipt ? 'Hide Math Receipt' : '2026 Cap Math'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                showMathReceipt ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        <h2 className="mt-2 font-editorial text-xl text-[#1c1917]">
          {capHealth.headlineAnswer}
        </h2>

        {/* 3 Big One-Glance Answers */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Box 1: Spendable Right Now */}
          <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534e]">
              1.{' '}
              <JargonTip term="EFFECTIVE_CAP_SPACE">
                2026 Spendable Space Right Now
              </JargonTip>
            </div>
            <div
              className={`mt-1.5 font-mono-ledger text-3xl font-semibold ${tierStyles.amountColor}`}
            >
              {y26.effectiveCapSpace >= 0 ? '+$' : '−$'}
              {Math.abs(y26.effectiveCapSpace).toFixed(2)}M
            </div>
            <p className="mt-1 text-xs text-[#57534e]">
              True buying power after setting aside{' '}
              <strong className="font-mono-ledger text-[#1c1917]">
                ${y26.netRookiePoolImpact.toFixed(1)}M
              </strong>{' '}
              to sign your 2026 draft class.
            </p>
          </div>

          {/* Box 2: Room We Could Create in 10 Seconds */}
          <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534e]">
              2.{' '}
              <JargonTip term="RESTRUCTURE">
                Extra Room We Can Create Today
              </JargonTip>
            </div>
            <div className="mt-1.5 font-mono-ledger text-3xl font-semibold text-[#2d5a43]">
              +${capHealth.roomWeCouldCreate.restructuresOnly.toFixed(1)}M
            </div>
            <p className="mt-1 text-xs text-[#57534e]">
              Available immediately via simple restructures without cutting a
              single player (or up to{' '}
              <strong className="font-mono-ledger text-[#1c1917]">
                +${capHealth.roomWeCouldCreate.combinedMaxFlex.toFixed(1)}M
              </strong>{' '}
              if combined with veteran cuts).
            </p>
          </div>

          {/* Box 3: When Do the Books Clear? */}
          <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#57534e]">
              3. When Do Our Cap Books Clear?
            </div>
            <div className="mt-1.5 font-editorial text-3xl font-semibold text-[#1c1917]">
              {capHealth.cleanBooksYear} Season
            </div>
            <p className="mt-1 text-xs text-[#57534e]">
              {capHealth.cleanBooksNote}
            </p>
          </div>
        </div>

        {/* Progressive Disclosure: Exact Math Receipt */}
        {showMathReceipt && (
          <div className="mt-4 border border-[#dfd9cc] bg-[#f6f3ec] p-4 text-xs">
            <div className="font-mono-ledger text-xs text-[#57534e]">
              Raw Top-51 Space:{' '}
              <strong className="text-[#1c1917]">
                {rawCapSpaceBeforeRookies >= 0 ? '+$' : '−$'}
                {Math.abs(rawCapSpaceBeforeRookies).toFixed(2)}M
              </strong>{' '}
              · Net After Rookies:{' '}
              <strong className="text-[#2d5a43]">
                {y26.effectiveCapSpace >= 0 ? '+$' : '−$'}
                {Math.abs(y26.effectiveCapSpace).toFixed(2)}M
              </strong>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6 font-mono-ledger text-xs">
              <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-2.5">
                <div className="text-[10px] text-[#8a8379]">League Cap</div>
                <div className="mt-0.5 font-semibold text-[#1c1917]">
                  ${y26.baseLeagueCap.toFixed(2)}M
                </div>
              </div>
              <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-2.5">
                <div className="text-[10px] text-[#8a8379]">+ 2025 Rollover</div>
                <div className="mt-0.5 font-semibold text-[#2d5a43]">
                  +${y26.rolloverFromPriorYear.toFixed(2)}M
                </div>
              </div>
              <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-2.5">
                <div className="text-[10px] text-[#8a8379]">− Active Top 51</div>
                <div className="mt-0.5 font-semibold text-[#1c1917]">
                  −${y26.activeTop51Cap.toFixed(2)}M
                </div>
              </div>
              <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-2.5">
                <div className="text-[10px] text-[#8a8379]">− Dead Money</div>
                <div className="mt-0.5 font-semibold text-[#b84a27]">
                  −${y26.deadMoneyTotal.toFixed(2)}M
                </div>
              </div>
              <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-2.5">
                <div className="text-[10px] text-[#8a8379]">− Net Rookies</div>
                <div className="mt-0.5 font-semibold text-[#1c1917]">
                  −${y26.netRookiePoolImpact.toFixed(2)}M
                </div>
              </div>
              <div className="border-2 border-[#1c1917] bg-[#fcfaf6] p-2.5">
                <div className="text-[10px] font-semibold text-[#1c1917]">
                  = Spendable Now
                </div>
                <div
                  className={`mt-0.5 font-bold ${
                    y26.effectiveCapSpace < 0
                      ? 'text-[#b84a27]'
                      : 'text-[#2d5a43]'
                  }`}
                >
                  {y26.effectiveCapSpace >= 0 ? '+$' : '−$'}
                  {Math.abs(y26.effectiveCapSpace).toFixed(2)}M
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progressive Disclosure: 2027-2028 Second-Contract Wall */}
        {capHealth.secondContractWall.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#dfd9cc] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-[#57534e]">
              <strong className="text-[#1c1917]">
                Why not spend all our future space today?
              </strong>{' '}
              {capHealth.secondContractWall.length} young core rookie-deal
              starters will need extensions in 2027–2028.
            </div>
            <button
              type="button"
              onClick={() => setShowSecondContractWall((prev) => !prev)}
              className="font-semibold text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4 cursor-pointer"
            >
              {showSecondContractWall
                ? 'Hide Young Core Extension Wall ▲'
                : `View ${capHealth.secondContractWall.length} Young Stars Due Soon ▼`}
            </button>
          </div>
        )}

        {showSecondContractWall && capHealth.secondContractWall.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {capHealth.secondContractWall.map((w) => (
              <button
                key={w.player.id}
                type="button"
                onClick={() => selectPlayer(w.player.id, 'extend')}
                className="flex items-center justify-between border border-[#dfd9cc] bg-[#f6f3ec] p-3 text-left hover:border-[#1c1917] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    name={w.player.name}
                    headshotUrl={w.player.headshotUrl}
                    teamId={derivedState.teamId}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[#1c1917]">
                      {w.player.name}
                    </div>
                    <div className="text-[10px] text-[#57534e]">
                      {w.player.position} · Age {w.player.ageIn2026} · Due{' '}
                      {w.decisionYear}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono-ledger">
                  <div className="text-xs font-semibold text-[#b84a27]">
                    ~${w.projectedMarketApy.toFixed(1)}M/yr
                  </div>
                  <div className="text-[10px] text-[#8a8379]">Proj. Deal</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* "Clear Cap Space Fast" Two-Column Action Board */}
      <section className="space-y-4">
        <div>
          <h2 className="font-editorial text-2xl text-[#1c1917]">
            Clear Cap Room Today
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT COLUMN: Simple Restructures (Player Stays) */}
          <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dfd9cc] pb-3.5">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2d5a43]">
                    <Wand2 className="h-3.5 w-3.5" />
                    Player Stays
                  </span>
                  <h3 className="mt-1 font-editorial text-xl text-[#1c1917]">
                    Simple Contract Restructures
                  </h3>
                  <p className="mt-1 text-xs text-[#57534e]">
                    Convert 2026 salary into signing bonus spread across future years.
                  </p>
                </div>

                {capHealth.topRestructureLevers.length > 0 && (
                  <button
                    type="button"
                    onClick={applyMaxTopRestructures}
                    className="shrink-0 bg-[#2d5a43] px-3.5 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#234735] transition-colors cursor-pointer"
                  >
                    1-Click Restructure Top{' '}
                    {capHealth.topRestructureLevers.length} (+$
                    {capHealth.maxTop3RestructurePower.toFixed(1)}M)
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2.5">
                {restructureCards.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#8a8379]">
                    All eligible base-salary restructures have already been
                    applied!
                  </p>
                ) : (
                  restructureCards.map(
                    ({
                      player,
                      sim,
                      capHit26,
                      revisedCapHit26,
                      alreadyDone,
                    }) => (
                      <div
                        key={player.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-[#dfd9cc] bg-[#f6f3ec] p-3.5 hover:border-[#1c1917] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => selectPlayer(player.id, 'restructure')}
                          className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
                        >
                          <PlayerAvatar
                            name={player.name}
                            headshotUrl={player.headshotUrl}
                            teamId={derivedState.teamId}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4">
                                {player.name}
                              </span>
                              <span className="border border-[#dfd9cc] bg-[#fcfaf6] px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                                {player.position} · Age {player.ageIn2026}
                              </span>
                            </div>
                            <div className="mt-0.5 font-mono-ledger text-[11px] text-[#57534e]">
                              2026 Cap Hit: ${capHit26.toFixed(1)}M →{' '}
                              <strong className="text-[#2d5a43]">
                                ${revisedCapHit26.toFixed(1)}M
                              </strong>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 ml-auto">
                          {alreadyDone ? (
                            <span className="inline-flex items-center gap-1 border border-[#2d5a43]/40 bg-[#2d5a43]/10 px-2.5 py-1 text-xs font-semibold text-[#2d5a43]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Restructured
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                addRestructureTransaction(player, 1.0, 2, 2026)
                              }
                              className="border border-[#2d5a43] bg-[#2d5a43]/10 px-3 py-1.5 font-mono-ledger text-xs font-semibold text-[#2d5a43] hover:bg-[#2d5a43] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                            >
                              Restructure (+$
                              {sim.currentYearCapSavings.toFixed(1)}M)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              selectPlayer(player.id, 'restructure')
                            }
                            className="border border-[#dfd9cc] bg-[#fcfaf6] px-2.5 py-1.5 text-[11px] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917] cursor-pointer"
                          >
                            Options
                          </button>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Veteran Cuts / Releases (Player Leaves) */}
          <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-5 flex flex-col justify-between">
            <div>
              <div className="border-b border-[#dfd9cc] pb-3.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b84a27]">
                  <Scissors className="h-3.5 w-3.5" />
                  Player Leaves Roster
                </span>
                <h3 className="mt-1 font-editorial text-xl text-[#1c1917]">
                  Top Veteran Release / Cut Candidates
                </h3>
                <p className="mt-1 text-xs text-[#57534e]">
                  Release non-guaranteed salary to clear immediate 2026 cap space.
                </p>
              </div>

              <div className="mt-4 space-y-2.5">
                {cutCards.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#8a8379]">
                    No remaining veteran contracts with +$2.0M net 2026 release
                    savings.
                  </p>
                ) : (
                  cutCards.map(({ player, preJune, postJune, capHit26 }) => {
                    const usePostJune =
                      postJune.currentYearCapSavings >
                      preJune.currentYearCapSavings + 1.5;
                    const primarySavings = usePostJune
                      ? postJune.currentYearCapSavings
                      : preJune.currentYearCapSavings;
                    const primaryDead = usePostJune
                      ? postJune.currentYearDeadCap
                      : preJune.currentYearDeadCap;

                    return (
                      <div
                        key={player.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-[#dfd9cc] bg-[#f6f3ec] p-3.5 hover:border-[#1c1917] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => selectPlayer(player.id, 'cut')}
                          className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
                        >
                          <PlayerAvatar
                            name={player.name}
                            headshotUrl={player.headshotUrl}
                            teamId={derivedState.teamId}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4">
                                {player.name}
                              </span>
                              <span className="border border-[#dfd9cc] bg-[#fcfaf6] px-1.5 py-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                                {player.position} · Age {player.ageIn2026}
                              </span>
                            </div>
                            <div className="mt-0.5 font-mono-ledger text-[11px] text-[#57534e]">
                              Hit ${capHit26.toFixed(1)}M · Leaves{' '}
                              <span className="text-[#b84a27]">
                                ${primaryDead.toFixed(1)}M dead
                              </span>
                              {usePostJune ? ' (Post-6/1)' : ''}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() =>
                              addCutTransaction(
                                player,
                                usePostJune
                                  ? 'POST_JUNE_1_CUT'
                                  : 'PRE_JUNE_1_CUT',
                                2026
                              )
                            }
                            className="border border-[#b84a27] bg-[#b84a27]/10 px-3 py-1.5 font-mono-ledger text-xs font-semibold text-[#b84a27] hover:bg-[#b84a27] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                          >
                            {usePostJune ? 'Post-6/1 Cut' : 'Cut Now'} (+$
                            {primarySavings.toFixed(1)}M)
                          </button>
                          <button
                            type="button"
                            onClick={() => selectPlayer(player.id, 'cut')}
                            className="border border-[#dfd9cc] bg-[#fcfaf6] px-2.5 py-1.5 text-[11px] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917] cursor-pointer"
                          >
                            Edit Contract
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
