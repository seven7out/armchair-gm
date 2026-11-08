import {
  FRANCHISE_TAG_BY_POSITION_2026,
  getContractYearCapHit,
  roundCap,
  simulateCutOrTrade,
} from '@/engine';
import { FreeAgentTarget } from '@/engine/types';
import { SEED_TEAMS } from './teams';

/**
 * Seed Free Agent & Cap Casualty Radar Pool (`freeAgents.ts`).
 * Includes:
 * 1. Likely Unrestricted Free Agents (CFA Qualifying — costs a Comp Pick if signed).
 * 2. Projected Cap Casualties / Street FAs (Currently under contract on cap-strapped teams,
 *    projected to be cut — Comp-Pick SAFE!).
 * 3. High Tag / Re-Sign Risk stars (Warns the user that the incumbent team is likely to Tag or Extend them).
 */
export const SEED_FREE_AGENTS: FreeAgentTarget[] = [
  // --- LIKELY OPEN-MARKET UFAs (CFA Qualifying) ---
  {
    id: 'fa-trey-hendrickson',
    name: 'Trey Hendrickson',
    position: 'EDGE',
    ageIn2026: 31,
    tier: 'Elite',
    overallRating: 93,
    accruedSeasons: 9,
    previousTeam: 'CIN',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3052743.png',
    marketApy: 30.5,
    marketYears: 3,
    marketGuaranteedPct: 0.62,
    scoutingNote:
      'Relentless pass-rush win rate (22.4%); entering age-31 cliff window—Cincinnati reluctant to commit 3+ years of guarantees.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 18.5,
      scheduledCapHit: 18.6,
      netCutSavings: 16.0,
      deadCapOnCut: 2.6,
      franchiseTagCost: 26.8,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true, // Shemar Stewart / Myles Murphy drafted behind him
    },
  },
  {
    id: 'fa-jev-holland',
    name: 'Jevon Holland',
    position: 'S',
    ageIn2026: 26,
    tier: 'Elite',
    overallRating: 90,
    accruedSeasons: 5,
    previousTeam: 'MIA',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4373809.png',
    marketApy: 19.2,
    marketYears: 4,
    marketGuaranteedPct: 0.6,
    scoutingNote:
      'Rangy single-high & split-field eraser with 4 prime seasons ahead of his age-30 safety cliff.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: -11.4,
      scheduledCapHit: 4.8,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 18.6,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
  },
  {
    id: 'fa-milton-williams',
    name: 'Milton Williams',
    position: 'IDL',
    ageIn2026: 27,
    tier: 'Starter',
    overallRating: 86,
    accruedSeasons: 5,
    previousTeam: 'PHI',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4239699.png',
    marketApy: 20.5,
    marketYears: 4,
    marketGuaranteedPct: 0.58,
    scoutingNote:
      'Explosive 3-technique interior disruptor entering peak years (27–30); blocked in PHI by Jalen Carter extension.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 14.2,
      scheduledCapHit: 3.1,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 22.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },
  {
    id: 'fa-dj-reed',
    name: 'D.J. Reed',
    position: 'CB',
    ageIn2026: 29,
    tier: 'Starter',
    overallRating: 86,
    accruedSeasons: 8,
    previousTeam: 'NYJ',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3139387.png',
    marketApy: 16.5,
    marketYears: 3,
    marketGuaranteedPct: 0.52,
    scoutingNote:
      'Feisty man/zone outside corner right at the CB age-29 cliff threshold—front-load to avoid Year 3 dead cap.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 11.5,
      scheduledCapHit: 15.6,
      netCutSavings: 0,
      deadCapOnCut: 4.8,
      franchiseTagCost: 20.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },
  {
    id: 'fa-josh-sweat',
    name: 'Josh Sweat',
    position: 'EDGE',
    ageIn2026: 29,
    tier: 'Starter',
    overallRating: 86,
    accruedSeasons: 8,
    previousTeam: 'PHI',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3693166.png',
    marketApy: 19.0,
    marketYears: 3,
    marketGuaranteedPct: 0.54,
    scoutingNote:
      'Long-levered Super Bowl pass-rush star with double-digit sack ceiling.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 14.2,
      scheduledCapHit: 9.8,
      netCutSavings: 0,
      deadCapOnCut: 6.4,
      franchiseTagCost: 25.1,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },
  {
    id: 'fa-isaiah-likely',
    name: 'Isaiah Likely',
    position: 'TE',
    ageIn2026: 26,
    tier: 'Starter',
    overallRating: 86,
    accruedSeasons: 4,
    previousTeam: 'BAL',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4361050.png',
    marketApy: 15.2,
    marketYears: 4,
    marketGuaranteedPct: 0.56,
    scoutingNote:
      'Dynamic mismatch move-TE entering prime 26–30 window.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 9.8,
      scheduledCapHit: 3.4,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 14.4,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },

  // --- PROJECTED CAP CASUALTIES / STREET FAs (Comp-Pick SAFE!) ---
  {
    id: 'fa-joey-bosa-cut',
    name: 'Joey Bosa',
    position: 'EDGE',
    ageIn2026: 30,
    tier: 'Starter',
    overallRating: 85,
    accruedSeasons: 10,
    previousTeam: 'LAC (Projected Cut)',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3051389.png',
    marketApy: 13.5,
    marketYears: 2,
    marketGuaranteedPct: 0.50,
    scoutingNote:
      'Carried a $36.4M scheduled cap hit in LAC with $25.4M net release savings. Prime Street FA addition that does NOT cancel a Comp Pick.',
    predictionFeatures: {
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 38.0,
      scheduledCapHit: 36.4,
      netCutSavings: 25.36,
      deadCapOnCut: 11.1,
      franchiseTagCost: 25.1,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },
  {
    id: 'fa-javon-hargrave-cut',
    name: 'Javon Hargrave',
    position: 'IDL',
    ageIn2026: 32,
    tier: 'Starter',
    overallRating: 84,
    accruedSeasons: 10,
    previousTeam: 'SF (Projected Post-6/1 Cut)',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/2983055.png',
    marketApy: 15.0,
    marketYears: 2,
    marketGuaranteedPct: 0.48,
    scoutingNote:
      'Interior pass-rush specialist projected for Post-June 1 release ($19.9M savings for SF). Street FA status preserves your 2027 Comp Picks.',
    predictionFeatures: {
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 16.0,
      scheduledCapHit: 28.1,
      netCutSavings: 19.9,
      deadCapOnCut: 8.2,
      franchiseTagCost: 22.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
  },
  {
    id: 'fa-davante-adams-cut',
    name: 'Davante Adams',
    position: 'WR',
    ageIn2026: 32,
    tier: 'Elite',
    overallRating: 89,
    accruedSeasons: 12,
    previousTeam: 'NYJ (Projected Cut)',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/16800.png',
    marketApy: 22.0,
    marketYears: 2,
    marketGuaranteedPct: 0.55,
    scoutingNote:
      'Scheduled for an unguaranteed $35.6M base salary ($38.3M cap hit). Classic Street FA cap casualty for a win-now contender.',
    predictionFeatures: {
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 8.5,
      scheduledCapHit: 38.3,
      netCutSavings: 29.9,
      deadCapOnCut: 8.4,
      franchiseTagCost: 24.8,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },
  {
    id: 'fa-jonathan-allen-cut',
    name: 'Jonathan Allen',
    position: 'IDL',
    ageIn2026: 30,
    tier: 'Starter',
    overallRating: 83,
    accruedSeasons: 9,
    previousTeam: 'WAS (Projected Cut)',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/3054840.png',
    marketApy: 16.5,
    marketYears: 3,
    marketGuaranteedPct: 0.48,
    scoutingNote:
      'Entering final year with $16.5M unguaranteed base salary and zero guarantees left. Street FA release frees him without costing a Comp Pick.',
    predictionFeatures: {
      originType: 'UNDER_CONTRACT_VETERAN',
      incumbentTeamCapSpace: 62.0,
      scheduledCapHit: 23.0,
      netCutSavings: 16.47,
      deadCapOnCut: 6.53,
      franchiseTagCost: 22.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: true,
    },
  },

  // --- TAG / EXTENSION TRAPS (Low Probability of Reaching Open Market) ---
  {
    id: 'fa-tee-higgins',
    name: 'Tee Higgins',
    position: 'WR',
    ageIn2026: 27,
    tier: 'Elite',
    overallRating: 90,
    accruedSeasons: 6,
    previousTeam: 'CIN',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4239993.png',
    marketApy: 28.8,
    marketYears: 4,
    marketGuaranteedPct: 0.65,
    scoutingNote:
      'True boundary X receiver in his prime window (27–29), but our predictor flags high Franchise Tag / In-House Extension risk in Cincinnati.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 48.5,
      scheduledCapHit: 21.8,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 26.1,
      priorTagsCount: 1,
      hasPositionalSuccessorOrBlock: false,
    },
  },
  {
    id: 'fa-trey-smith',
    name: 'Trey Smith',
    position: 'OL',
    ageIn2026: 26,
    tier: 'Elite',
    overallRating: 91,
    accruedSeasons: 5,
    previousTeam: 'KC',
    headshotUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/4242459.png',
    marketApy: 23.5,
    marketYears: 4,
    marketGuaranteedPct: 0.64,
    scoutingNote:
      'Mauling Pro Bowl right guard; because the OL Franchise Tag ($23.4M) bundles all OL positions, KC is heavily projected to Tag & Extend him.',
    predictionFeatures: {
      originType: 'EXPIRING_CONTRACT',
      incumbentTeamCapSpace: 18.0,
      scheduledCapHit: 3.4,
      netCutSavings: 0,
      deadCapOnCut: 0,
      franchiseTagCost: 20.9,
      priorTagsCount: 0,
      hasPositionalSuccessorOrBlock: false,
    },
  },
];

/**
 * Dynamically builds a comprehensive league-wide Free Agent & Cap Casualty pool across all 32 NFL teams,
 * combining the curated top targets with real expiring starters & high-savings cap casualties from `SEED_TEAMS`.
 */
export function getLeagueWideFreeAgentPool(
  excludeTeamId?: string
): FreeAgentTarget[] {
  const seenNames = new Set(SEED_FREE_AGENTS.map((f) => f.name.toLowerCase()));
  const dynamicTargets: FreeAgentTarget[] = [];

  for (const team of Object.values(SEED_TEAMS)) {
    if (team.id === excludeTeamId) continue;

    for (const player of team.roster) {
      const lowerName = player.name.toLowerCase();
      if (seenNames.has(lowerName)) continue;

      const cy26 = player.contractYears[2026];
      const cy27 = player.contractYears[2027];
      if (!cy26 || cy26.isVoidYear) continue;

      const hit26 = getContractYearCapHit(cy26);
      const isExpiringAfter2026 = !cy27 || cy27.isVoidYear;
      const preCut = simulateCutOrTrade(player, 2026, 'PRE_JUNE_1_CUT');
      const postCut = simulateCutOrTrade(player, 2026, 'POST_JUNE_1_CUT');
      const bestCutSavings = Math.max(
        preCut.currentYearCapSavings,
        postCut.currentYearCapSavings
      );

      // Include notable expiring starters OR notable cap casualties across the 32 teams
      const isNotableExpiring = isExpiringAfter2026 && hit26 >= 4.0;
      const isNotableCapCasualty =
        !isExpiringAfter2026 &&
        bestCutSavings >= 9.0 &&
        player.ageIn2026 >= 28 &&
        player.overallRating <= 88;

      if (!isNotableExpiring && !isNotableCapCasualty) continue;

      seenNames.add(lowerName);
      const estApy = roundCap(
        Math.max(4.5, Math.min(34.0, hit26 * (isNotableExpiring ? 1.05 : 0.72)))
      );
      const estYears =
        player.ageIn2026 >= 30 ? 2 : player.ageIn2026 >= 28 ? 3 : 4;
      const tagCost =
        FRANCHISE_TAG_BY_POSITION_2026[player.position]?.franchiseTag ?? 20.9;

      dynamicTargets.push({
        id: `fa-dyn-${player.id}`,
        name: player.name,
        position: player.position,
        ageIn2026: player.ageIn2026,
        tier: player.tier,
        overallRating: player.overallRating,
        accruedSeasons: player.accruedSeasons,
        previousTeam: isNotableCapCasualty
          ? `${team.abbreviation} (Projected Cut)`
          : team.abbreviation,
        headshotUrl: player.headshotUrl,
        marketApy: estApy,
        marketYears: estYears,
        marketGuaranteedPct: isNotableCapCasualty ? 0.48 : 0.56,
        scoutingNote: isNotableCapCasualty
          ? `Carries a $${hit26.toFixed(1)}M scheduled cap hit on ${team.city} with +$${bestCutSavings.toFixed(1)}M release savings — projected Street FA (Comp-Pick Safe).`
          : `Expiring ${team.city} ${player.position} (${hit26.toFixed(1)}M cap hit in 2026) entering open-market window at Age ${player.ageIn2026}.`,
        predictionFeatures: {
          originType: isNotableCapCasualty
            ? 'UNDER_CONTRACT_VETERAN'
            : 'EXPIRING_CONTRACT',
          incumbentTeamCapSpace: team.initialRollover2026,
          scheduledCapHit: hit26,
          netCutSavings: isNotableCapCasualty ? bestCutSavings : 0,
          deadCapOnCut: preCut.currentYearDeadCap,
          franchiseTagCost: tagCost,
          priorTagsCount: player.priorTagsCount ?? 0,
          hasPositionalSuccessorOrBlock: isNotableCapCasualty,
        },
      });
    }
  }

  return [
    ...SEED_FREE_AGENTS,
    ...dynamicTargets.sort((a, b) => b.marketApy - a.marketApy).slice(0, 60),
  ];
}
