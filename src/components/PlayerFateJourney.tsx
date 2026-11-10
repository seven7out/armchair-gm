'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  computeRealContractXRay,
  evaluateRosterPlayerFate,
  getContractYearCapHit,
  PlayerFateCategory,
  POSITION_GROUPS,
  PositionGroup,
} from '@/engine';
import { useGMStore } from '@/store/useGMStore';
import { PlayerAvatar } from './PlayerAvatar';
import { JargonTip } from './JargonTooltip';

type StoryFilter =
  | 'ALL'
  | 'EXTENSION_RADAR'
  | 'RESTRUCTURE_PILLARS'
  | 'CUT_OR_WALK_RISK'
  | 'FAKE_YEARS_XRAY';

const ALL_POSITIONS: (PositionGroup | 'ALL')[] = ['ALL', ...POSITION_GROUPS];

export function PlayerFateJourney() {
  const {
    baseTeam,
    derivedState,
    selectPlayer,
    setActiveTab,
  } = useGMStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [storyFilter, setStoryFilter] = useState<StoryFilter>('ALL');
  const [posFilter, setPosFilter] = useState<PositionGroup | 'ALL'>('ALL');

  const space2026 = derivedState.years[2026].effectiveCapSpace;

  const evaluatedPlayers = useMemo(() => {
    return derivedState.roster
      .map((player) => {
        const forecast = evaluateRosterPlayerFate(player, space2026);
        const xray = computeRealContractXRay(player);
        const capHit2026 = getContractYearCapHit(player.contractYears[2026]);
        return {
          player,
          forecast,
          xray,
          capHit2026,
        };
      })
      .sort((a, b) => b.capHit2026 - a.capHit2026);
  }, [derivedState.roster, space2026]);

  const filterCounts = useMemo(() => {
    let extensionCount = 0;
    let restructureCount = 0;
    let cutWalkCount = 0;
    let fakeYearsCount = 0;

    for (const item of evaluatedPlayers) {
      if (
        item.forecast.fate === 'PRIME_EXTENSION' ||
        item.forecast.fate === 'TAG_OR_TENDER'
      ) {
        extensionCount++;
      }
      if (item.forecast.fate === 'RESTRUCTURE_PILLAR') {
        restructureCount++;
      }
      if (
        item.forecast.fate === 'CAP_CASUALTY_RISK' ||
        item.forecast.fate === 'WALK_CANDIDATE'
      ) {
        cutWalkCount++;
      }
      if (item.xray.hasFakeBackEnd || item.xray.voidYearsCount > 0) {
        fakeYearsCount++;
      }
    }

    return {
      ALL: evaluatedPlayers.length,
      EXTENSION_RADAR: extensionCount,
      RESTRUCTURE_PILLARS: restructureCount,
      CUT_OR_WALK_RISK: cutWalkCount,
      FAKE_YEARS_XRAY: fakeYearsCount,
    };
  }, [evaluatedPlayers]);

  const filteredPlayers = useMemo(() => {
    return evaluatedPlayers.filter((item) => {
      if (posFilter !== 'ALL' && item.player.position !== posFilter) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !item.player.name
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }

      if (storyFilter === 'EXTENSION_RADAR') {
        return (
          item.forecast.fate === 'PRIME_EXTENSION' ||
          item.forecast.fate === 'TAG_OR_TENDER'
        );
      }
      if (storyFilter === 'RESTRUCTURE_PILLARS') {
        return item.forecast.fate === 'RESTRUCTURE_PILLAR';
      }
      if (storyFilter === 'CUT_OR_WALK_RISK') {
        return (
          item.forecast.fate === 'CAP_CASUALTY_RISK' ||
          item.forecast.fate === 'WALK_CANDIDATE'
        );
      }
      if (storyFilter === 'FAKE_YEARS_XRAY') {
        return item.xray.hasFakeBackEnd || item.xray.voidYearsCount > 0;
      }

      return true;
    });
  }, [evaluatedPlayers, posFilter, searchQuery, storyFilter]);

  const getFateBadgeStyle = (fate: PlayerFateCategory) => {
    switch (fate) {
      case 'PRIME_EXTENSION':
        return 'bg-[#2d5a43]/15 text-[#2d5a43] border-[#2d5a43]/40';
      case 'RESTRUCTURE_PILLAR':
        return 'bg-[#1c1917] text-[#f6f3ec] border-[#1c1917]';
      case 'TAG_OR_TENDER':
        return 'bg-[#b57c1e]/15 text-[#b57c1e] border-[#b57c1e]/40';
      case 'CAP_CASUALTY_RISK':
      case 'WALK_CANDIDATE':
        return 'bg-[#b84a27]/15 text-[#b84a27] border-[#b84a27]/40';
      default:
        return 'bg-[#ede8dd] text-[#57534e] border-[#c7bfb0]';
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8 space-y-6">
      {/* 1. Journey Intro Header */}
      <section className="border border-[#dfd9cc] bg-[#fcfaf6] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8379]">
              Journey 02 · Player Fate Forecast & &ldquo;Real Contract&rdquo;
              X-Ray
            </span>
            <h1 className="mt-1 font-editorial text-2xl sm:text-3xl text-[#1c1917]">
              Will Your Favorite {baseTeam.name} Player Stay, Get Extended, or
              Get Cut?
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#57534e]">
              NFL agents announce huge headline deals full of unguaranteed back-end
              years. Pick any player below to see their{' '}
              <strong className="text-[#1c1917]">2026 Fate Forecast</strong>,
              their <strong className="text-[#1c1917]">Real Contract X-Ray</strong>
              , and click any card to compare all{' '}
              <strong className="text-[#1c1917]">
                4 GM Doors (Cut, Trade, Restructure, Extend)
              </strong>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className="shrink-0 self-start lg:self-center border border-[#1c1917] bg-[#f6f3ec] px-3.5 py-2 text-xs font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
          >
            Want the raw 53-man 4-year table? Open Full Spreadsheet →
          </button>
        </div>

        {/* Search & Story Filter Bar */}
        <div className="mt-5 pt-5 border-t border-[#dfd9cc] space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8379]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${baseTeam.name} players by name...`}
                className="w-full border border-[#1c1917] bg-[#f6f3ec] py-2 pl-9 pr-3 text-xs text-[#1c1917] placeholder:text-[#8a8379] focus:outline-none"
              />
            </div>

            {/* Story Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'All Roster Contracts' },
                  { id: 'EXTENSION_RADAR', label: 'Prime Extension Radar' },
                  { id: 'RESTRUCTURE_PILLARS', label: 'Restructure Pillars' },
                  { id: 'CUT_OR_WALK_RISK', label: 'Cut / Walk Risk' },
                  { id: 'FAKE_YEARS_XRAY', label: 'Fake Back-End / Void Years' },
                ] as { id: StoryFilter; label: string }[]
              ).map((tab) => {
                const isActive = storyFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStoryFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[#1c1917] bg-[#1c1917] text-[#f6f3ec]'
                        : 'border-[#dfd9cc] bg-[#f6f3ec] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917]'
                    }`}
                  >
                    {tab.label}{' '}
                    <span className="ml-1 font-mono-ledger text-[10px] opacity-80">
                      ({filterCounts[tab.id]})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact Position Filter */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
              Position:
            </span>
            {ALL_POSITIONS.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosFilter(pos)}
                className={`px-2 py-0.5 font-mono-ledger text-[11px] transition-colors cursor-pointer ${
                  posFilter === pos
                    ? 'bg-[#1c1917] font-semibold text-[#f6f3ec]'
                    : 'text-[#57534e] hover:bg-[#ede8dd] hover:text-[#1c1917]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Clean Player Story Cards Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="border border-[#dfd9cc] bg-[#fcfaf6] p-12 text-center">
          <p className="font-editorial text-lg text-[#1c1917]">
            No players match this filter combination.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStoryFilter('ALL');
              setPosFilter('ALL');
            }}
            className="mt-3 border border-[#1c1917] bg-[#f6f3ec] px-4 py-1.5 text-xs font-semibold text-[#1c1917] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredPlayers.map(({ player, forecast, xray, capHit2026 }) => (
            <div
              key={player.id}
              className="flex flex-col justify-between border border-[#dfd9cc] bg-[#fcfaf6] p-5 hover:border-[#1c1917] transition-colors"
            >
              <div>
                {/* Top Row: Player Identity + Fate Badge */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dfd9cc] pb-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      selectPlayer(player.id, forecast.recommendedActionTab)
                    }
                    className="flex items-center gap-3 text-left cursor-pointer"
                  >
                    <PlayerAvatar
                      name={player.name}
                      headshotUrl={player.headshotUrl}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-editorial text-xl text-[#1c1917] underline decoration-[#c7bfb0] underline-offset-4">
                          {player.name}
                        </span>
                        <span className="border border-[#dfd9cc] bg-[#f6f3ec] px-1.5 py-0.5 font-mono-ledger text-[10px] font-semibold text-[#57534e]">
                          {player.position} · Age {player.ageIn2026} · OVR{' '}
                          {player.overallRating}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono-ledger text-xs text-[#57534e]">
                        2026 Cap Hit:{' '}
                        <strong className="text-[#1c1917]">
                          ${capHit2026.toFixed(2)}M
                        </strong>{' '}
                        · Est. Market Value:{' '}
                        <strong>
                          ~${forecast.projectedMarketApy.toFixed(1)}M/yr
                        </strong>
                      </div>
                    </div>
                  </button>

                  <span
                    className={`border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getFateBadgeStyle(
                      forecast.fate
                    )}`}
                  >
                    {forecast.badgeLabel}
                  </span>
                </div>

                {/* Middle Row: Plain-English Why */}
                <p className="mt-3 text-xs leading-relaxed text-[#44403c]">
                  {forecast.rationale}
                </p>

                {/* Real Contract X-Ray Comparison Box */}
                <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 border border-[#dfd9cc] bg-[#f6f3ec] p-3 text-xs">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                      Headline Remaining Deal
                    </div>
                    <div className="mt-0.5 font-mono-ledger font-semibold text-[#1c1917]">
                      {xray.headlineYears} yr
                      {xray.headlineYears !== 1 ? 's' : ''} · $
                      {xray.headlineTotalCap.toFixed(1)}M (
                      <JargonTip term="APY">
                        ${xray.headlineApy.toFixed(1)}M/yr
                      </JargonTip>
                      )
                    </div>
                  </div>

                  <div className="sm:border-l sm:border-[#dfd9cc] sm:pl-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                      <span>The Real Contract X-Ray</span>
                      {xray.hasFakeBackEnd && (
                        <AlertTriangle className="h-3 w-3 text-[#b57c1e]" />
                      )}
                    </div>
                    <div
                      className={`mt-0.5 font-mono-ledger font-semibold ${
                        xray.hasFakeBackEnd
                          ? 'text-[#b57c1e]'
                          : 'text-[#2d5a43]'
                      }`}
                    >
                      {xray.verdictLabel}
                    </div>
                    {xray.voidYearsCount > 0 && (
                      <div className="mt-0.5 font-mono-ledger text-[10px] text-[#b84a27]">
                        <JargonTip term="VOID_YEARS">
                          +{xray.voidYearsCount} Void Yr
                          {xray.voidYearsCount > 1 ? 's' : ''} ($
                          {xray.voidGhostBillTotal.toFixed(1)}M Ghost Bill)
                        </JargonTip>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Action Footer */}
              <div className="mt-4 pt-3 border-t border-[#dfd9cc] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    selectPlayer(player.id, forecast.recommendedActionTab)
                  }
                  className="bg-[#1c1917] px-3.5 py-1.5 text-xs font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
                >
                  Recommended: {forecast.shortActionLabel}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    selectPlayer(player.id, forecast.recommendedActionTab)
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1c1917] hover:underline cursor-pointer"
                >
                  <span>Compare All 4 Doors (Cut / Trade / Restructure / Extend)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
