'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import {
  computeRealContractXRay,
  evaluateRosterPlayerFate,
  getContractYearCapHit,
  LEAGUE_YEARS,
  Player,
  POSITIONAL_MARKET_COMPS,
  projectPlayerCareerHorizon,
  simulateCutOrTrade,
} from '@/engine';
import { SEED_TEAMS } from '@/data/seed/teams';
import { useGMStore } from '@/store/useGMStore';
import { JargonTip } from './JargonTooltip';
import { PlayerAvatar } from './PlayerAvatar';

interface LeaguePlayerEntry {
  player: Player;
  teamId: string;
  teamCity: string;
  teamName: string;
  teamAbbr: string;
  teamLogoUrl?: string;
  capHit2026: number;
}

export function GlobalPlayerSearch({
  placeholder = 'Lookup any NFL player (contract, age, yrs left)...',
  className = 'w-64 xl:w-80',
}: {
  placeholder?: string;
  className?: string;
}) {
  const { selectedTeamId, derivedState, openPlayerDossier } = useGMStore();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build league-wide player index using live derivedState for the selected team
  // and SEED_TEAMS for the other 31 NFL franchises
  const allLeaguePlayers = useMemo(() => {
    const list: LeaguePlayerEntry[] = [];

    for (const team of Object.values(SEED_TEAMS)) {
      const roster =
        team.id === selectedTeamId ? derivedState.roster : team.roster;
      for (const player of roster) {
        list.push({
          player,
          teamId: team.id,
          teamCity: team.city,
          teamName: team.name,
          teamAbbr: team.abbreviation,
          teamLogoUrl: team.logoUrl,
          capHit2026: getContractYearCapHit(player.contractYears[2026]),
        });
      }
    }
    return list;
  }, [selectedTeamId, derivedState.roster]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    return allLeaguePlayers
      .filter(
        (entry) =>
          entry.player.name.toLowerCase().includes(q) ||
          entry.teamAbbr.toLowerCase() === q ||
          entry.teamName.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Prioritize active team matches first, then highest 2026 cap hit / OVR
        const aIsSelected = a.teamId === selectedTeamId ? 1 : 0;
        const bIsSelected = b.teamId === selectedTeamId ? 1 : 0;
        if (aIsSelected !== bIsSelected) return bIsSelected - aIsSelected;
        return b.capHit2026 - a.capHit2026;
      })
      .slice(0, 10);
  }, [allLeaguePlayers, query, selectedTeamId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8379]" />
        <input
          type="search"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          aria-label="Search any NFL player for contract and career longevity stats"
          className="w-full border border-[#1c1917] bg-[#fcfaf6] py-1.5 pl-8 pr-3 text-xs text-[#1c1917] placeholder:text-[#8a8379] focus:bg-[#ffffff] focus:outline-none"
        />
      </div>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto border-2 border-[#1c1917] bg-[#fcfaf6] shadow-xl">
          <div className="border-b border-[#dfd9cc] bg-[#ede8dd] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#57534e]">
            All-32 NFL Player Dossier Lookup ({matches.length} results)
          </div>

          {matches.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8a8379]">
              No NFL players found matching &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-[#dfd9cc]">
              {matches.map((entry) => {
                const career = projectPlayerCareerHorizon(entry.player);
                return (
                  <button
                    key={`${entry.teamId}-${entry.player.id}`}
                    type="button"
                    onClick={() => {
                      openPlayerDossier(entry.player, entry.teamId);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#ede8dd] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        name={entry.player.name}
                        headshotUrl={entry.player.headshotUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-[#1c1917]">
                            {entry.player.name}
                          </span>
                          <span className="border border-[#dfd9cc] bg-[#f6f3ec] px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-[#1c1917]">
                            {entry.teamAbbr} · {entry.player.position}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono-ledger text-[10px] text-[#57534e]">
                          Age {entry.player.ageIn2026} · OVR{' '}
                          {entry.player.overallRating} · ~
                          {career.expectedRemainingStarterYears} starter yr
                          {career.expectedRemainingStarterYears === 1
                            ? ''
                            : 's'}{' '}
                          left
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono-ledger">
                      <div className="text-xs font-semibold text-[#1c1917]">
                        ${entry.capHit2026.toFixed(1)}M
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.08em] text-[#2d5a43]">
                        View Dossier →
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlayerDossierModal() {
  const {
    dossierPlayer,
    selectedTeamId,
    derivedState,
    closePlayerDossier,
    selectTeam,
    selectPlayer,
    setActiveTab,
  } = useGMStore();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (dossierPlayer) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [dossierPlayer]);

  if (!dossierPlayer) return null;

  const { player, teamId } = dossierPlayer;
  const teamData = SEED_TEAMS[teamId] ?? SEED_TEAMS[selectedTeamId];
  const isOnActiveTeam = teamId === selectedTeamId;

  const career = projectPlayerCareerHorizon(player);
  const xray = computeRealContractXRay(player);
  const fate = evaluateRosterPlayerFate(
    player,
    derivedState.years[2026].effectiveCapSpace
  );
  const marketComps = POSITIONAL_MARKET_COMPS[player.position] ?? [];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={closePlayerDossier}
      onClick={(e) => {
        if (e.target === dialogRef.current) closePlayerDossier();
      }}
      className="m-auto w-full max-w-4xl border-2 border-[#1c1917] bg-[#f6f3ec] p-0 text-[#1c1917] shadow-2xl backdrop:bg-[#1c1917]/60"
    >
      <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-7">
        {/* 1. Dossier Header: Identity, Team, Rating, Age & Market Valuation */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#1c1917] pb-5">
          <div className="flex items-start gap-4">
            <PlayerAvatar
              name={player.name}
              headshotUrl={player.headshotUrl}
              size="lg"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {teamData?.logoUrl && (
                  <img
                    src={teamData.logoUrl}
                    alt=""
                    className="h-5 w-5 object-contain"
                  />
                )}
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8379]">
                  {teamData?.city} {teamData?.name} · Scouting &amp; Career
                  Longevity Dossier
                </span>
              </div>

              <h2
                id={titleId}
                className="mt-1 font-editorial text-3xl text-[#1c1917]"
              >
                {player.name}
              </h2>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono-ledger text-xs">
                <span className="border border-[#1c1917] bg-[#1c1917] px-2 py-0.5 font-semibold text-[#f6f3ec]">
                  {player.position} · {player.tier} Tier
                </span>
                <span className="border border-[#dfd9cc] bg-[#fcfaf6] px-2 py-0.5 text-[#1c1917]">
                  Overall Rating: <strong>{player.overallRating} OVR</strong>
                </span>
                <span className="border border-[#dfd9cc] bg-[#fcfaf6] px-2 py-0.5 text-[#1c1917]">
                  Age <strong>{player.ageIn2026}</strong> ({player.accruedSeasons}{' '}
                  Accrued Seasons)
                </span>
                <span className="border border-[#2d5a43]/40 bg-[#2d5a43]/10 px-2 py-0.5 font-semibold text-[#2d5a43]">
                  Est. Market Value: ~${fate.projectedMarketApy.toFixed(1)}M/yr
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closePlayerDossier}
            aria-label="Close Player Dossier"
            className="border border-[#1c1917] bg-[#fcfaf6] p-2 text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2. Career Longevity & "How Much Longer Is He Expected to Play?" */}
        <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfd9cc] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#2d5a43]" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1c1917]">
                Career Longevity Forecast · How Much Longer Will {player.name}{' '}
                Play?
              </span>
            </div>
            <span className="border border-[#2d5a43]/40 bg-[#2d5a43]/10 px-2.5 py-0.5 font-mono-ledger text-xs font-semibold text-[#2d5a43]">
              {career.careerHeadline}
            </span>
          </div>

          {/* 4 Longevity Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8379]">
                Current Age &amp; Exp
              </div>
              <div className="mt-1 font-mono-ledger text-xl font-semibold text-[#1c1917]">
                Age {career.currentAge}
              </div>
              <div className="text-[11px] text-[#57534e]">
                {career.accruedSeasons} NFL Season
                {career.accruedSeasons === 1 ? '' : 's'}
                {player.isRookieContract ? ' (Rookie Deal)' : ''}
              </div>
            </div>

            <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8379]">
                {player.position} Prime &amp; Cliff
              </div>
              <div className="mt-1 font-mono-ledger text-xl font-semibold text-[#1c1917]">
                Ages {career.positionPeakWindow}
              </div>
              <div className="text-[11px] text-[#b84a27]">
                Positional Cliff: Age {career.positionCliffAge}
              </div>
            </div>

            <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8379]">
                Starter Seasons Left
              </div>
              <div className="mt-1 font-mono-ledger text-xl font-semibold text-[#2d5a43]">
                ~{career.expectedRemainingStarterYears} Seasons
              </div>
              <div className="text-[11px] text-[#57534e]">
                Starter level thru ~{career.projectedFinalStarterSeason}
              </div>
            </div>

            <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8379]">
                Est. Retirement Window
              </div>
              <div className="mt-1 font-mono-ledger text-xl font-semibold text-[#1c1917]">
                ~Age {career.projectedRetirementAge}
              </div>
              <div className="text-[11px] text-[#57534e]">
                ~{career.expectedTotalCareerYearsLeft} total yrs left (
                {career.projectedRetirementSeason})
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#44403c]">
            {career.careerSummaryVerdict}
          </p>

          {/* 6-Year Career & Contract Trajectory Timeline (2026–2031) */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
              6-Year Career &amp; Contract Horizon (2026–2031)
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              {career.timeline.map((node) => {
                const phaseBg =
                  node.phase === 'ASCENT' || node.phase === 'PEAK_PRIME'
                    ? 'border-[#2d5a43]/40 bg-[#2d5a43]/10 text-[#2d5a43]'
                    : node.phase === 'CLIFF_WARNING'
                    ? 'border-[#b57c1e]/40 bg-[#b57c1e]/10 text-[#b57c1e]'
                    : 'border-[#b84a27]/40 bg-[#b84a27]/10 text-[#b84a27]';

                return (
                  <div
                    key={node.year}
                    className="border border-[#dfd9cc] bg-[#f6f3ec] p-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-baseline justify-between font-mono-ledger">
                        <span className="text-xs font-bold text-[#1c1917]">
                          {node.year}
                        </span>
                        <span className="text-[10px] text-[#57534e]">
                          Age {node.age}
                        </span>
                      </div>
                      <div
                        className={`mt-1.5 inline-block border px-1.5 py-0.5 text-[10px] font-semibold ${phaseBg}`}
                      >
                        {node.phaseLabel}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-[#dfd9cc] font-mono-ledger text-[10px] text-[#1c1917]">
                      {node.contractStatusLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. Current Contract Breakdown & "Real Contract" X-Ray */}
        <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfd9cc] pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#1c1917]" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1c1917]">
                Current Contract &amp; &ldquo;Real Contract&rdquo; X-Ray
              </span>
            </div>
            <span className="font-mono-ledger text-xs font-semibold text-[#1c1917]">
              {fate.badgeLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                Agent Headline Remaining Deal
              </div>
              <div className="mt-1 font-mono-ledger text-xl font-semibold text-[#1c1917]">
                {xray.headlineYears} Yr{xray.headlineYears !== 1 ? 's' : ''} · $
                {xray.headlineTotalCap.toFixed(2)}M Total ($
                {xray.headlineApy.toFixed(2)}M/yr)
              </div>
              <p className="mt-1 text-xs text-[#57534e]">{fate.rationale}</p>
            </div>

            <div className="border border-[#dfd9cc] bg-[#f6f3ec] p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                <span>The Real Contract X-Ray (Practical Structure)</span>
                {xray.hasFakeBackEnd && (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#b57c1e]" />
                )}
              </div>
              <div
                className={`mt-1 font-mono-ledger text-lg font-semibold ${
                  xray.hasFakeBackEnd ? 'text-[#b57c1e]' : 'text-[#2d5a43]'
                }`}
              >
                {xray.verdictLabel}
              </div>
              <p className="mt-1 text-xs text-[#57534e]">
                {xray.firstCleanExitYear
                  ? `First clean team exit is ${xray.firstCleanExitYear}, where releasing ${player.name} saves +$${xray.exitNetCapSavings.toFixed(1)}M over $${xray.exitDeadCap.toFixed(1)}M dead money.`
                  : `Fully protected through the remaining contract horizon with no fake back-end salary spikes.`}
              </p>
            </div>
          </div>

          {/* Year-by-Year 2026-2029 Contract Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left font-mono-ledger text-xs">
              <thead>
                <tr className="border-b-2 border-[#1c1917] text-[10px] uppercase tracking-[0.12em] text-[#57534e]">
                  <th className="py-2 pr-3">Season</th>
                  <th className="py-2 px-3">Age</th>
                  <th className="py-2 px-3">Base Salary</th>
                  <th className="py-2 px-3">Prorated Bonus</th>
                  <th className="py-2 px-3">Guaranteed</th>
                  <th className="py-2 px-3">Total Cap Hit</th>
                  <th className="py-2 px-3">Dead Cap (If Cut)</th>
                  <th className="py-2 pl-3">Net Cut Savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfd9cc]">
                {LEAGUE_YEARS.map((yr) => {
                  const cy = player.contractYears[yr];
                  const age = player.ageIn2026 + (yr - 2026);
                  if (!cy) {
                    return (
                      <tr key={yr} className="text-[#8a8379]">
                        <td className="py-2.5 pr-3 font-semibold">{yr}</td>
                        <td className="py-2.5 px-3">{age}</td>
                        <td colSpan={6} className="py-2.5 px-3 italic">
                          Off Contract — Unprotected Free Agent Season
                        </td>
                      </tr>
                    );
                  }
                  if (cy.isVoidYear) {
                    return (
                      <tr key={yr} className="bg-[#ede8dd]/50 text-[#b84a27]">
                        <td className="py-2.5 pr-3 font-semibold">
                          {yr} (Void)
                        </td>
                        <td className="py-2.5 px-3">{age}</td>
                        <td className="py-2.5 px-3">$0.00M</td>
                        <td className="py-2.5 px-3">
                          ${cy.proratedBonus.toFixed(2)}M
                        </td>
                        <td className="py-2.5 px-3">$0.00M</td>
                        <td className="py-2.5 px-3 font-semibold">
                          ${cy.proratedBonus.toFixed(2)}M (Ghost Bill)
                        </td>
                        <td className="py-2.5 px-3">
                          ${cy.proratedBonus.toFixed(2)}M
                        </td>
                        <td className="py-2.5 pl-3">$0.00M</td>
                      </tr>
                    );
                  }

                  const hit = getContractYearCapHit(cy);
                  const cutSim = simulateCutOrTrade(
                    player,
                    yr,
                    'PRE_JUNE_1_CUT'
                  );

                  return (
                    <tr key={yr} className="text-[#1c1917]">
                      <td className="py-2.5 pr-3 font-semibold">{yr}</td>
                      <td className="py-2.5 px-3">{age}</td>
                      <td className="py-2.5 px-3">
                        ${cy.baseSalary.toFixed(2)}M
                      </td>
                      <td className="py-2.5 px-3">
                        ${cy.proratedBonus.toFixed(2)}M
                      </td>
                      <td className="py-2.5 px-3">
                        ${cy.guaranteedSalary.toFixed(2)}M
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        ${hit.toFixed(2)}M
                      </td>
                      <td className="py-2.5 px-3 text-[#b84a27]">
                        ${cutSim.currentYearDeadCap.toFixed(2)}M
                      </td>
                      <td
                        className={`py-2.5 pl-3 font-semibold ${
                          cutSim.currentYearCapSavings > 0
                            ? 'text-[#2d5a43]'
                            : 'text-[#b84a27]'
                        }`}
                      >
                        {cutSim.currentYearCapSavings >= 0 ? '+$' : '−$'}
                        {Math.abs(cutSim.currentYearCapSavings).toFixed(2)}M
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Positional Market Valuation Benchmarks */}
        {marketComps.length > 0 && (
          <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
              {player.position} NFL Market Valuation Comps (2026 Cap-Adjusted)
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3 font-mono-ledger text-xs">
              {marketComps.map((comp) => (
                <div
                  key={comp.playerName}
                  className="border border-[#dfd9cc] bg-[#f6f3ec] p-2.5"
                >
                  <div className="text-[10px] text-[#8a8379]">
                    {comp.tierLabel}
                  </div>
                  <div className="font-semibold text-[#1c1917]">
                    {comp.playerName}
                  </div>
                  <div className="mt-0.5 text-[#2d5a43] font-semibold">
                    ${comp.equivalent2026Apy.toFixed(1)}M/yr ({comp.years} yrs ·{' '}
                    {Math.round(comp.guaranteedPct * 100)}% gtd)
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#1c1917] pt-4">
          <div className="text-xs text-[#57534e]">
            Want to simulate a move for <strong>{player.name}</strong>?
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isOnActiveTeam ? (
              <button
                type="button"
                onClick={() => {
                  closePlayerDossier();
                  selectPlayer(player.id, fate.recommendedActionTab, 2026);
                }}
                className="bg-[#1c1917] px-4 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
              >
                Open 4-Door GM Drawer (Cut / Trade / Restructure / Extend) →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectTeam(teamId);
                    closePlayerDossier();
                    selectPlayer(player.id, fate.recommendedActionTab, 2026);
                  }}
                  className="border border-[#1c1917] bg-[#fcfaf6] px-4 py-2 text-xs font-semibold text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
                >
                  Switch to {teamData?.name} &amp; Manage Contract →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closePlayerDossier();
                    setActiveTab('draft');
                  }}
                  className="bg-[#1c1917] px-4 py-2 text-xs font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                >
                  Open Trade Wizard to Acquire {player.name} →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
