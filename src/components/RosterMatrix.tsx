'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, RotateCcw, Search, Sparkles } from 'lucide-react';
import {
  computeRealContractXRay,
  evaluatePlayerLongevity,
  evaluateRosterPlayerFate,
  evaluateTeamCapHealth,
  getContractYearCapHit,
  LEAGUE_YEARS,
  Player,
  PlayerFateForecast,
  POSITION_GROUPS,
  POSITIONAL_AGING_CURVES,
  PositionGroup,
  simulateCutOrTrade,
  simulateRestructure,
} from '@/engine';
import { useGMStore } from '@/store/useGMStore';
import { JargonTip } from './JargonTooltip';
import { PlayerAvatar } from './PlayerAvatar';

type MatrixViewMode = 'POSITION' | 'TOP_CAP_LEVERS';
type SortCriterion = 'CAP_HIT' | 'RESTRUCTURE_SAVINGS' | 'CUT_SAVINGS';

export function RosterMatrix() {
  const {
    baseTeam,
    derivedState,
    transactions,
    positionFilter,
    searchQuery,
    selectedPlayerId,
    setPositionFilter,
    setSearchQuery,
    selectPlayer,
    openFreeAgencyModal,
    addCutTransaction,
    addRestructureTransaction,
    addQuickTradeTransaction,
    removeTransaction,
  } = useGMStore();

  const [viewMode, setViewMode] = useState<MatrixViewMode>('POSITION');
  const [sortCriterion, setSortCriterion] = useState<SortCriterion>('CAP_HIT');
  const [openActionMenuPlayerId, setOpenActionMenuPlayerId] = useState<
    string | null
  >(null);

  const activePlayerTxMap = useMemo(() => {
    const map = new Map<string, { txId: string; label: string }>();
    for (const tx of transactions) {
      if (!tx.enabled) continue;
      if (tx.type === 'EXTENSION') {
        map.set(tx.playerId, {
          txId: tx.id,
          label: `Extended (${tx.newYearsAdded}yr, $${tx.apy}M/yr)`,
        });
      } else if (tx.type === 'RESTRUCTURE') {
        map.set(tx.playerId, {
          txId: tx.id,
          label: `Restructured (${tx.actionYear})`,
        });
      } else if (tx.type === 'FRANCHISE_TAG') {
        map.set(tx.playerId, {
          txId: tx.id,
          label: `Tagged ($${tx.tagSalary.toFixed(1)}M)`,
        });
      } else if (tx.type === 'FIFTH_YEAR_OPTION') {
        map.set(tx.playerId, {
          txId: tx.id,
          label: `5th-Yr Opt ($${tx.optionAmount.toFixed(1)}M)`,
        });
      } else if (tx.type === 'TRADE') {
        for (const inc of tx.incomingPlayers) {
          map.set(inc.id, {
            txId: tx.id,
            label: `Acquired (${tx.partnerTeamName})`,
          });
        }
      } else if (tx.type === 'SIGN_FA') {
        map.set(`fa-${tx.id}-${tx.freeAgent.id}`, {
          txId: tx.id,
          label: 'New FA Signing',
        });
        map.set(`fa-signed-${tx.freeAgent.id}`, {
          txId: tx.id,
          label: 'New FA Signing',
        });
      }
    }
    return map;
  }, [transactions]);

  const formatCapDelta = (savings: number) =>
    savings >= 0 ? `+$${savings.toFixed(1)}M` : `−$${Math.abs(savings).toFixed(1)}M`;

  const capHealth = useMemo(
    () => evaluateTeamCapHealth(derivedState),
    [derivedState]
  );

  const space2026 = derivedState.years[2026].effectiveCapSpace;

  const forecastsByPlayerId = useMemo(() => {
    const map: Record<string, PlayerFateForecast> = {};
    for (const p of derivedState.roster) {
      map[p.id] = evaluateRosterPlayerFate(p, space2026);
    }
    return map;
  }, [derivedState.roster, space2026]);

  const filteredPlayers = useMemo(() => {
    return derivedState.roster.filter((p) => {
      if (positionFilter !== 'ALL' && p.position !== positionFilter) return false;
      if (
        searchQuery.trim() !== '' &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.position.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [derivedState.roster, positionFilter, searchQuery]);

  const sortedFlatPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      const fa = forecastsByPlayerId[a.id];
      const fb = forecastsByPlayerId[b.id];
      if (sortCriterion === 'RESTRUCTURE_SAVINGS') {
        return (
          (fb?.maxRestructureSavings2026 ?? 0) -
          (fa?.maxRestructureSavings2026 ?? 0)
        );
      }
      if (sortCriterion === 'CUT_SAVINGS') {
        return (fb?.bestCutSavings2026 ?? 0) - (fa?.bestCutSavings2026 ?? 0);
      }
      return (
        getContractYearCapHit(b.contractYears[2026]) -
        getContractYearCapHit(a.contractYears[2026])
      );
    });
  }, [filteredPlayers, forecastsByPlayerId, sortCriterion]);

  const groupedPlayers = useMemo(() => {
    const groups: { position: PositionGroup; players: Player[] }[] = [];
    for (const pos of POSITION_GROUPS) {
      const matching = filteredPlayers
        .filter((p) => p.position === pos)
        .sort(
          (a, b) =>
            getContractYearCapHit(b.contractYears[2026]) -
            getContractYearCapHit(a.contractYears[2026])
        );
      if (matching.length > 0) {
        groups.push({ position: pos, players: matching });
      }
    }
    return groups;
  }, [filteredPlayers]);

  const renderPlayerRow = (player: Player) => {
    const longevity = evaluatePlayerLongevity(player);
    const forecast = forecastsByPlayerId[player.id];
    const xray = computeRealContractXRay(player);
    const isSelected = selectedPlayerId === player.id;
    const activePlayerTx = activePlayerTxMap.get(player.id);
    const isModifiedRow = Boolean(activePlayerTx);
    const isActionMenuOpen = openActionMenuPlayerId === player.id;
    let viableCounter = 0;

    const fateColor =
      forecast.fate === 'CAP_CASUALTY_RISK' || forecast.fate === 'WALK_CANDIDATE'
        ? 'text-[#b84a27]'
        : forecast.fate === 'PRIME_EXTENSION' ||
          forecast.fate === 'RESTRUCTURE_PILLAR'
        ? 'text-[#2d5a43]'
        : 'text-[#1c1917]';

    return (
      <tr
        key={player.id}
        onClick={() => selectPlayer(player.id, forecast.recommendedActionTab)}
        className={`board-row group cursor-pointer transition-colors ${
          isModifiedRow
            ? 'bg-[#eff6ff] hover:bg-[#dbeafe]'
            : isSelected
            ? 'bg-[#ede8dd]'
            : 'hover:bg-[#fcfaf6]'
        }`}
      >
        {/* Sticky Player Column */}
        <th
          scope="row"
          className={`sticky left-0 z-10 py-3.5 pr-4 font-normal transition-colors ${
            isModifiedRow
              ? 'border-l-4 border-l-[#2563eb] bg-[#eff6ff] group-hover:bg-[#dbeafe] pl-2.5'
              : 'bg-[#f6f3ec] group-hover:bg-[#fcfaf6]'
          }`}
        >
          <div className="flex items-center gap-3">
            <PlayerAvatar
              name={player.name}
              headshotUrl={player.headshotUrl}
              teamId={baseTeam.id}
              teamLogoUrl={baseTeam.logoUrl}
              size="sm"
            />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm text-[#111827] group-hover:underline">
                  {player.name}
                </span>
                {player.injuryStatus && (
                  <span
                    title={`Currently on ${player.injuryStatus} list`}
                    className="border border-[#dc2626] bg-[#fef2f2] px-1.5 py-0.5 font-mono-ledger text-[10px] font-bold text-[#b91c1c]"
                  >
                    {player.injuryStatus}
                  </span>
                )}
                <span className="font-mono-ledger text-[11px] font-medium uppercase text-[#475569]">
                  {player.position} · {player.tier}
                </span>
              </div>
              <div className="mt-0.5 font-mono-ledger text-xs text-[#334155]">
                Age {player.ageIn2026} · Rating {player.overallRating}/99
                {player.isRookieContract ? ' · Rookie' : ''}
              </div>
            </div>
          </div>
        </th>

        {/* Fate Forecast, Real Contract X-Ray & Quick Lever Column */}
        <td className="py-3.5 px-4 align-middle">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={`text-xs font-semibold ${fateColor}`}>
              {forecast.badgeLabel}
            </div>
            <div className="relative flex items-center gap-1.5">
              {activePlayerTx ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTransaction(activePlayerTx.txId);
                  }}
                  title={`Undo ${activePlayerTx.label}`}
                  className="inline-flex items-center gap-1 border border-[#2563eb] bg-[#2563eb] px-2 py-0.5 font-mono-ledger text-[10px] font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Undo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenActionMenuPlayerId(
                      isActionMenuOpen ? null : player.id
                    );
                  }}
                  aria-expanded={isActionMenuOpen}
                  className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono-ledger text-[10px] font-semibold transition-colors cursor-pointer ${
                    isActionMenuOpen
                      ? 'border-[#111827] bg-[#111827] text-white'
                      : 'border-[#cbd5e1] bg-white text-[#111827] hover:border-[#111827]'
                  }`}
                >
                  <span>Action</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}

              {isActionMenuOpen &&
                (() => {
                  const restr = simulateRestructure(player, 2026, 1.0, 1);
                  const preCut = simulateCutOrTrade(
                    player,
                    2026,
                    'PRE_JUNE_1_CUT'
                  );
                  const postCut = simulateCutOrTrade(
                    player,
                    2026,
                    'POST_JUNE_1_CUT'
                  );
                  const quickTrade = simulateCutOrTrade(
                    player,
                    2026,
                    'PRE_JUNE_1_TRADE'
                  );
                  const actions = [
                    {
                      label: 'Restructure (Max)',
                      detail: `→ ${formatCapDelta(restr.currentYearCapSavings)}`,
                      detailClass: 'text-[#15803d]',
                      hoverClass: 'hover:bg-[#eff6ff]',
                      disabled: restr.currentYearCapSavings <= 0.05,
                      onSelect: () => addRestructureTransaction(player, 1.0, 1, 2026),
                    },
                    {
                      label: 'Release (Pre-6/1)',
                      detail: `→ ${formatCapDelta(preCut.currentYearCapSavings)} ($${preCut.currentYearDeadCap.toFixed(1)}M dead)`,
                      detailClass: 'text-[#78350f]',
                      hoverClass: 'hover:bg-[#fef3c7]',
                      disabled: false,
                      onSelect: () => addCutTransaction(player, 'PRE_JUNE_1_CUT', 2026),
                    },
                    {
                      label: 'Release (Post-6/1)',
                      detail: `→ ${formatCapDelta(postCut.currentYearCapSavings)} ($${postCut.currentYearDeadCap.toFixed(1)}M dead)`,
                      detailClass: 'text-[#78350f]',
                      hoverClass: 'hover:bg-[#fef3c7]',
                      disabled: false,
                      onSelect: () => addCutTransaction(player, 'POST_JUNE_1_CUT', 2026),
                    },
                    {
                      label: 'Trade (Quick Sim)',
                      detail: `→ ${formatCapDelta(quickTrade.currentYearCapSavings)} ($${quickTrade.currentYearDeadCap.toFixed(1)}M dead)`,
                      detailClass: 'text-[#1e3a5f]',
                      hoverClass: 'hover:bg-[#eff6ff]',
                      disabled: false,
                      onSelect: () => addQuickTradeTransaction(player, 'PRE_JUNE_1', 2026),
                    },
                  ];

                  return (
                    <div
                      role="menu"
                      aria-label={`Quick actions for ${player.name}`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 top-full mt-1 z-30 w-72 border-2 border-[#111827] bg-white shadow-xl divide-y divide-[#e2e8f0] text-left"
                    >
                      <div className="flex items-center justify-between bg-[#f8fafc] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                        <span>1-Tap Move ({player.name})</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuPlayerId(null);
                          }}
                          className="text-[#475569] hover:text-[#111827] cursor-pointer px-1"
                          aria-label="Close action menu"
                        >
                          ✕
                        </button>
                      </div>
                      {actions.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          disabled={item.disabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            item.onSelect();
                            setOpenActionMenuPlayerId(null);
                          }}
                          className={`w-full px-3 py-2 flex items-center justify-between text-xs ${item.hoverClass} disabled:opacity-40 cursor-pointer`}
                        >
                          <span className="font-semibold text-[#111827]">
                            {item.label}
                          </span>
                          <span
                            className={`font-mono-ledger text-[11px] font-bold ${item.detailClass}`}
                          >
                            {item.detail}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionMenuPlayerId(null);
                          selectPlayer(
                            player.id,
                            forecast.recommendedActionTab
                          );
                        }}
                        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#1e3a5f] bg-[#f8fafc] hover:bg-[#e2e8f0] cursor-pointer"
                      >
                        <span>Custom 4-Door…</span>
                        <span>→</span>
                      </button>
                    </div>
                  );
                })()}
            </div>
          </div>
          {activePlayerTx && (
            <div className="mt-0.5 inline-block border border-[#93c5fd] bg-white px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-[#1d4ed8]">
              ✓ {activePlayerTx.label}
            </div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono-ledger text-[11px] text-[#57534e]">
            <span>{forecast.shortActionLabel}</span>
            <span>·</span>
            <span className="text-[#8a8379]">
              +{longevity.postContractViableYears} prime post-deal yr
              {longevity.postContractViableYears === 1 ? '' : 's'}
            </span>
          </div>
          {(xray.hasFakeBackEnd || xray.voidYearsCount > 0) && (
            <div className="mt-1 font-mono-ledger text-[10px] text-[#8a8379]">
              {xray.hasFakeBackEnd && xray.firstCleanExitYear ? (
                <span>
                  X-Ray: Real {xray.realisticYears}-yr / $
                  {xray.realisticPracticalMoney.toFixed(1)}M ({xray.firstCleanExitYear}{' '}
                  exit +${xray.exitNetCapSavings.toFixed(1)}M)
                </span>
              ) : (
                <span>
                  Ghost Bill: {xray.voidYearsCount} void yr
                  {xray.voidYearsCount > 1 ? 's' : ''} ($
                  {xray.voidGhostBillTotal.toFixed(1)}M deferred)
                </span>
              )}
            </div>
          )}
        </td>

        {/* 2026–2029 Cap Horizon Cells */}
        {LEAGUE_YEARS.map((year) => {
          const cy = player.contractYears[year];
          const ageAssessment = longevity.yearlyAssessments[year];
          const capCeiling = derivedState.years[year].adjustedCapCeiling;

          if (cy) {
            const hit = getContractYearCapHit(cy);
            const pctOfCap = (hit / capCeiling) * 100;
            const barWidthPct = Math.min(
              100,
              Math.max(4, (pctOfCap / 20) * 100)
            );

            if (cy.isVoidYear) {
              return (
                <td key={year} className="py-3.5 px-4 align-middle">
                  <div className="flex items-baseline justify-between font-mono-ledger text-xs text-[#8a8379]">
                    <span className="uppercase text-[10px] tracking-wider">
                      Ghost Yr (Void)
                    </span>
                    <span>${cy.proratedBonus.toFixed(2)}M</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full border-b border-dashed border-[#8a8379]" />
                  <div className="mt-1 font-mono-ledger text-[10px] text-[#8a8379]">
                    Age {ageAssessment.age} · Ghost Bill Accelerates
                  </div>
                </td>
              );
            }

            const barColor = ageAssessment.isAtOrPastCliff
              ? 'bg-[#b84a27]'
              : 'bg-[#1c1917]';

            return (
              <td key={year} className="py-3.5 px-4 align-middle">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono-ledger text-sm font-semibold text-[#1c1917]">
                    ${hit.toFixed(2)}M
                  </span>
                  <span className="font-mono-ledger text-[11px] text-[#8a8379]">
                    {pctOfCap.toFixed(1)}%
                  </span>
                </div>

                {/* Crisp 4px Ink Bar */}
                <div className="mt-1.5 h-1 w-full bg-[#e5dfd3] overflow-hidden">
                  <motion.div
                    className={`h-full ${barColor}`}
                    initial={false}
                    animate={{ width: `${barWidthPct}%` }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 30,
                    }}
                  />
                </div>

                <div className="mt-1 flex items-center justify-between font-mono-ledger text-[10px] text-[#8a8379]">
                  <span>
                    B ${cy.baseSalary.toFixed(1)}M · P $
                    {cy.proratedBonus.toFixed(1)}M
                  </span>
                  <span
                    className={
                      ageAssessment.isAtOrPastCliff
                        ? 'text-[#b84a27] font-medium'
                        : ''
                    }
                  >
                    Age {ageAssessment.age}
                    {ageAssessment.isAtOrPastCliff ? ' (Cliff)' : ''}
                  </span>
                </div>
              </td>
            );
          }

          // Unprotected Viable Starter Year — Direct Click Opens Extension Tab
          const isUnprotectedViableYear =
            longevity.contractExpirationYear !== null &&
            year > longevity.contractExpirationYear &&
            viableCounter < longevity.postContractViableYears;

          if (isUnprotectedViableYear) {
            viableCounter++;
            return (
              <td
                key={year}
                onClick={(e) => {
                  e.stopPropagation();
                  selectPlayer(player.id, 'extend');
                }}
                title={`Click to model a ${year} extension or Franchise Tag for ${player.name}`}
                className="py-3.5 px-4 align-middle hover:bg-[#ede8dd] transition-colors"
              >
                <div className="border-l-2 border-[#2d5a43] pl-2.5">
                  <div className="flex items-baseline justify-between text-[11px] font-medium text-[#2d5a43]">
                    <span className="underline decoration-[#2d5a43]/50 underline-offset-2">
                      Unprotected Prime →
                    </span>
                    <span className="font-mono-ledger text-[10px]">
                      Age {ageAssessment.age}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8a8379]">
                    Viable yr #{viableCounter} · Click to extend
                  </div>
                </div>
              </td>
            );
          }

          return (
            <td
              key={year}
              onClick={(e) => {
                e.stopPropagation();
                selectPlayer(player.id, 'extend');
              }}
              className="py-3.5 px-4 align-middle text-[#8a8379]/50 hover:text-[#1c1917] transition-colors"
            >
              <div className="font-mono-ledger text-[11px]">
                — Unsigned (Age {ageAssessment.age})
              </div>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      {/* Journey 05 Intro & Sub-Tab Switcher */}
      <div className="mb-6 border border-[#dfd9cc] bg-[#fcfaf6] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            {baseTeam.logoUrl && (
              <img
                src={baseTeam.logoUrl}
                alt={`${baseTeam.city} ${baseTeam.name}`}
                className="mt-1 h-11 w-11 shrink-0 object-contain"
              />
            )}
            <div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-normal text-[#1c1917]">
                {baseTeam.city} {baseTeam.name} 4-Year Contract Ledger
                (2026–2029)
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter player or position..."
                aria-label="Filter player or position"
                className="w-52 border border-[#1c1917] bg-[#f6f3ec] py-1.5 pl-8 pr-2 text-xs text-[#1c1917] placeholder-[#8a8379] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* View Mode & Position Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#dfd9cc] pb-3">
        <div className="flex flex-wrap items-baseline gap-3.5 text-xs">
          <button
            type="button"
            onClick={() => setPositionFilter('ALL')}
            className={`pb-1 transition-colors cursor-pointer ${
              positionFilter === 'ALL'
                ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                : 'text-[#8a8379] hover:text-[#1c1917]'
            }`}
          >
            All ({derivedState.roster.length})
          </button>
          {POSITION_GROUPS.map((pos) => {
            const alloc = derivedState.years[2026].topPositionAllocation.find(
              (a) => a.position === pos
            );
            const isSelected = positionFilter === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(pos)}
                className={`pb-1 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-b-2 border-[#1c1917] font-semibold text-[#1c1917]'
                    : 'text-[#57534e] hover:text-[#1c1917]'
                }`}
              >
                <span>{pos}</span>{' '}
                <span className="font-mono-ledger text-[11px] text-[#8a8379]">
                  ${alloc ? alloc.capSpend.toFixed(0) : '0'}M
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher: By Position vs Top Cap Levers */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center border border-[#c7bfb0] text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('POSITION')}
              className={`px-2.5 py-1 cursor-pointer ${
                viewMode === 'POSITION'
                  ? 'bg-[#1c1917] text-[#f6f3ec] font-medium'
                  : 'text-[#57534e]'
              }`}
            >
              By Position
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TOP_CAP_LEVERS')}
              className={`px-2.5 py-1 cursor-pointer ${
                viewMode === 'TOP_CAP_LEVERS'
                  ? 'bg-[#1c1917] text-[#f6f3ec] font-medium'
                  : 'text-[#57534e]'
              }`}
            >
              Top Cap Levers (Sorted)
            </button>
          </div>

          {viewMode === 'TOP_CAP_LEVERS' && (
            <select
              aria-label="Sort players by cap lever"
              value={sortCriterion}
              onChange={(e) => setSortCriterion(e.target.value as SortCriterion)}
              className="border-b border-[#1c1917] bg-transparent py-1 text-xs font-medium text-[#1c1917] cursor-pointer"
            >
              <option value="CAP_HIT">Sort: 2026 Cap Hit</option>
              <option value="RESTRUCTURE_SAVINGS">
                Sort: Max Restructure Savings
              </option>
              <option value="CUT_SAVINGS">Sort: Max Cut / Release Savings</option>
            </select>
          )}
        </div>
      </div>

      {/* Open Editorial Table — Horizontal Hairlines Only */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="roster-horizon-table-caption"
        className={`table-wrapper overflow-x-auto ${
          openActionMenuPlayerId ? 'pb-48' : ''
        }`}
      >
        <table className="w-full border-collapse text-left">
          <caption id="roster-horizon-table-caption" className="sr-only">
            Multi-Year NFL Roster Horizon Matrix (2026 to 2029)
          </caption>
          <thead className="sticky top-0 z-20 bg-[#f6f3ec] border-b-2 border-[#1c1917] text-[11px] uppercase tracking-[0.12em] text-[#57534e]">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 bg-[#f6f3ec] py-3 pr-4 min-w-[240px] font-semibold"
              >
                Player
              </th>
              <th
                scope="col"
                className="py-3 px-4 min-w-[215px] font-semibold"
              >
                Fate Forecast &amp; Cap Lever
              </th>
              {LEAGUE_YEARS.map((yr) => (
                <th
                  key={yr}
                  scope="col"
                  className="py-3 px-4 min-w-[205px] font-semibold"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[#1c1917]">{yr}</span>
                    <span className="font-mono-ledger text-[10px] font-normal text-[#8a8379]">
                      of ${derivedState.years[yr].adjustedCapCeiling.toFixed(0)}M
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#dfd9cc] text-xs">
            {viewMode === 'TOP_CAP_LEVERS'
              ? sortedFlatPlayers.map((player) => renderPlayerRow(player))
              : groupedPlayers.map((group) => {
                  const curve = POSITIONAL_AGING_CURVES[group.position];
                  return (
                    <React.Fragment key={group.position}>
                      {/* Editorial Section Subhead */}
                      <tr className="bg-[#ede8dd]/60">
                        <td colSpan={6} className="py-2.5 px-3">
                          <div className="flex items-baseline justify-between">
                            <div className="flex items-baseline gap-3">
                              <span className="font-editorial text-sm font-medium text-[#1c1917]">
                                {curve.label} ({group.position})
                              </span>
                              <span className="text-[11px] text-[#8a8379]">
                                Peak ages {curve.peakStartAge}–{curve.peakEndAge}{' '}
                                · Historical cliff at {curve.cliffAge}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                openFreeAgencyModal({
                                  position: group.position,
                                })
                              }
                              className="text-[11px] text-[#57534e] underline decoration-[#c7bfb0] underline-offset-4 hover:text-[#1c1917] cursor-pointer"
                            >
                              + Sign {group.position} in Free Agency
                            </button>
                          </div>
                        </td>
                      </tr>

                      {group.players.map((player) => renderPlayerRow(player))}
                    </React.Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Dead Money Footnote Ledger */}
      {derivedState.deadCapLedger.length > 0 && (
        <div className="mt-12 border-t border-[#1c1917] pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#57534e] mb-4">
            Dead Money &amp; Bonus Acceleration Footnotes
          </h3>
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {derivedState.deadCapLedger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-baseline justify-between border-b border-[#dfd9cc] py-2 text-xs"
              >
                <div>
                  <span className="font-medium text-[#1c1917]">
                    {entry.playerName}
                  </span>{' '}
                  <span className="text-[11px] text-[#8a8379]">
                    ({entry.reason})
                  </span>
                </div>
                <div className="font-mono-ledger text-xs text-[#b84a27]">
                  {entry.amountsByYear[2026] > 0 &&
                    `'26: $${entry.amountsByYear[2026].toFixed(2)}M `}
                  {entry.amountsByYear[2027] > 0 &&
                    `'27: $${entry.amountsByYear[2027].toFixed(2)}M`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
