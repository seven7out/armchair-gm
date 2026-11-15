import {
  DerivedTeamCapState,
  Player,
  PositionGroup,
  TeamSeedData,
} from './types';
import { DEFAULT_CAP_GROWTH_RATE, roundCap } from './constants';
import { evaluatePlayerLongevity } from './agingEngine';
import {
  computeRealContractXRay,
  getContractYearCapHit,
  simulateCutOrTrade,
} from './contractEngine';
import { computeDerivedTeamCapState } from './capEngine';
import {
  evaluateRosterPlayerFate,
  evaluateTeamPositionalNeedsByYear,
} from './faPredictionEngine';

export const FANTASY_SKILL_POSITIONS: readonly PositionGroup[] = [
  'QB',
  'RB',
  'WR',
  'TE',
] as const;

export function isFantasySkillPosition(pos: PositionGroup): boolean {
  return pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'TE';
}

export type FantasySignalType =
  | 'INSULATED_ALPHA'
  | 'PAPER_TRAP'
  | 'BREAKOUT_STASH'
  | 'TAG_OR_UFA_WATCH'
  | 'SOLID_DEPTH';

export interface FantasyPlayerEvaluation {
  playerId: string;
  playerName: string;
  position: PositionGroup;
  depthChartOrder: number;
  depthChartSlot: string;
  signal: FantasySignalType;
  badgeLabel: string;
  insulationScore: number; // 0-99
  capHit2026: number;
  deadCap2026: number;
  netSavingsIfCut2026: number;
  realYearsLeft: number;
  fantasyTakeaway: string;
  rippleIfCutOrTraded: string;
}

export interface TeamFantasyEnvironment {
  teamId: string;
  teamName: string;
  olGrade: 'A' | 'B' | 'C' | 'D';
  olStartersSigned: number;
  olAvgRating: number;
  olSummary: string;
  qbStability:
    | 'Locked Franchise QB'
    | 'Bridge / Cut-Risk QB'
    | 'Unsettled / Rookie Window';
  qbName: string;
  qbSummary: string;
  vacatedTouchesSummary: string[];
}

export interface FantasyLandingSpotOpportunity {
  id: string;
  teamId: string;
  teamName: string;
  teamAbbr: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  archetype:
    | 'ROOKIE_DRAFT_SMASH'
    | 'FREE_AGENT_WAR_CHEST'
    | 'IN_HOUSE_BREAKOUT';
  archetypeBadge: string;
  opportunityScore: number; // 0-99
  headline: string;
  vacatingOrAtRiskPlayers: string[];
  capAndDraftAmmo: string;
  inHouseBeneficiary: string | null;
  olGrade: 'A' | 'B' | 'C' | 'D';
}

export interface AuditedFantasyPlayerItem {
  player: Player;
  teamId: string;
  teamAbbr: string;
  teamName: string;
  evaluation: FantasyPlayerEvaluation;
  env: TeamFantasyEnvironment;
}

export interface FantasyRosterAuditReport {
  overallInsulationScore: number;
  totalAudited: number;
  insulatedCornerstones: AuditedFantasyPlayerItem[];
  paperContractTraps: AuditedFantasyPlayerItem[];
  breakoutStashes: AuditedFantasyPlayerItem[];
  ufaTagWatch: AuditedFantasyPlayerItem[];
  solidDepth: AuditedFantasyPlayerItem[];
}

export const SAMPLE_DYNASTY_ROSTER_NAMES: string[] = [
  'Jahmyr Gibbs',
  'Amon-Ra St. Brown',
  'Sam LaPorta',
  'Jameson Williams',
  'Josh Allen',
  'Saquon Barkley',
  'Tyreek Hill',
  'Travis Kelce',
  'Alvin Kamara',
  'Trey Benson',
  'Blake Corum',
  'Jaylen Wright',
];

function getSkillStarterThresholdCount(pos: PositionGroup): number {
  if (pos === 'QB') return 1;
  if (pos === 'RB') return 1;
  if (pos === 'WR') return 3;
  if (pos === 'TE') return 1;
  return 2;
}

function isVulnerableStarter(
  starter: Player,
  teamCapSpace2026: number
): boolean {
  const stCut = simulateCutOrTrade(starter, 2026, 'PRE_JUNE_1_CUT');
  const stFate = evaluateRosterPlayerFate(starter, teamCapSpace2026);
  const stHit26 = getContractYearCapHit(starter.contractYears[2026]);
  const st2027 = starter.contractYears[2027];
  const stExpiring =
    !st2027 || st2027.isVoidYear || getContractYearCapHit(st2027) <= 0;
  return (
    stFate.fate === 'CAP_CASUALTY_RISK' ||
    (stCut.currentYearCapSavings >= 5.5 &&
      stHit26 > 0 &&
      stCut.currentYearDeadCap <= stHit26 * 0.65) ||
    (stExpiring && starter.ageIn2026 >= 27)
  );
}

export function evaluateFantasyPlayerSignal(
  player: Player,
  teamRoster: Player[],
  teamCapSpace2026: number
): FantasyPlayerEvaluation {
  const samePos = teamRoster
    .filter((p) => p.position === player.position)
    .sort((a, b) => {
      if (b.overallRating !== a.overallRating) {
        return b.overallRating - a.overallRating;
      }
      return (
        getContractYearCapHit(b.contractYears[2026]) -
        getContractYearCapHit(a.contractYears[2026])
      );
    });

  const idx = samePos.findIndex((p) => p.id === player.id);
  const depthChartOrder = idx >= 0 ? idx + 1 : samePos.length + 1;
  const depthChartSlot = `${player.position}${depthChartOrder}`;

  const capHit2026 = roundCap(getContractYearCapHit(player.contractYears[2026]));
  const cutSim2026 = simulateCutOrTrade(player, 2026, 'PRE_JUNE_1_CUT');
  const deadCap2026 = roundCap(cutSim2026.currentYearDeadCap);
  const netSavingsIfCut2026 = roundCap(cutSim2026.currentYearCapSavings);

  const xray = computeRealContractXRay(player);
  const forecast = evaluateRosterPlayerFate(player, teamCapSpace2026);
  const longevity = evaluatePlayerLongevity(player);
  const isAtOrPastCliff = longevity.yearlyAssessments[2026].isAtOrPastCliff;

  const cy2027 = player.contractYears[2027];
  const hasActive2027 =
    cy2027 !== null &&
    cy2027 !== undefined &&
    !cy2027.isVoidYear &&
    getContractYearCapHit(cy2027) > 0;

  const startersAhead = samePos.slice(0, Math.max(0, depthChartOrder - 1));
  const vulnerableStarterAhead = startersAhead.find((st) =>
    isVulnerableStarter(st, teamCapSpace2026)
  );

  const nextManUp =
    idx >= 0
      ? samePos.find((p, pIdx) => p.id !== player.id && pIdx > idx)
      : undefined;
  const starterSlots = getSkillStarterThresholdCount(player.position);

  let rippleIfCutOrTraded: string;
  if (depthChartOrder <= starterSlots) {
    if (nextManUp) {
      rippleIfCutOrTraded = `Vacates ${depthChartSlot} touches → elevates ${nextManUp.name} (${player.position}${depthChartOrder + 1}, Age ${nextManUp.ageIn2026})`;
    } else {
      rippleIfCutOrTraded = `Vacates ${depthChartSlot} role with no proven backup → creates urgent Rd 1–2 Rookie / FA ${player.position} need`;
    }
  } else {
    rippleIfCutOrTraded = `Depth piece (${depthChartSlot}) — minimal touch redistribution unless ${samePos[0]?.name ?? 'starter'} leaves`;
  }

  const deadRatio =
    capHit2026 > 0 ? Math.min(1.5, deadCap2026 / capHit2026) : 0.5;
  const rawScore =
    deadRatio * 38 +
    Math.min(3, xray.realisticYears) * 14 +
    Math.max(0, player.overallRating - 70) * 0.9 -
    (isAtOrPastCliff ? 18 : 0) -
    (netSavingsIfCut2026 >= 6 ? 22 : 0);
  const insulationScore = Math.max(12, Math.min(99, Math.round(rawScore)));

  let signal: FantasySignalType;
  let badgeLabel: string;
  let fantasyTakeaway: string;

  const isPaperTrap =
    forecast.fate === 'CAP_CASUALTY_RISK' ||
    (netSavingsIfCut2026 >= 5.5 &&
      capHit2026 > 0 &&
      deadCap2026 <= capHit2026 * 0.65 &&
      !player.isRookieContract) ||
    (isAtOrPastCliff && netSavingsIfCut2026 >= 3.5);

  if (isPaperTrap) {
    signal = 'PAPER_TRAP';
    badgeLabel = '⚠️ Paper Contract Trap';
    fantasyTakeaway = `Saves +$${netSavingsIfCut2026.toFixed(1)}M if cut in 2026 ($${deadCap2026.toFixed(1)}M dead) at Age ${player.ageIn2026} — high replacement/release risk.`;
  } else if (
    depthChartOrder > starterSlots &&
    player.ageIn2026 <= 25 &&
    player.overallRating >= 73 &&
    vulnerableStarterAhead
  ) {
    signal = 'BREAKOUT_STASH';
    badgeLabel = '🚀 Post-Cut Breakout Stash';
    fantasyTakeaway = `Cheap Year-2/3 talent ($${capHit2026.toFixed(1)}M hit) sitting behind vulnerable starter ${vulnerableStarterAhead.name} — prime Dynasty buy.`;
  } else if (
    !hasActive2027 &&
    player.overallRating >= 78 &&
    depthChartOrder <= starterSlots + 1
  ) {
    signal = 'TAG_OR_UFA_WATCH';
    badgeLabel = '⏳ 2027 UFA / Tag Watch';
    fantasyTakeaway = `Contract expires after 2026 (${forecast.stayProbability}% stay odds, ~$${forecast.projectedMarketApy.toFixed(1)}M/yr market APY) — situation change looming.`;
  } else if (
    depthChartOrder <= starterSlots &&
    player.overallRating >= 80 &&
    (netSavingsIfCut2026 <= 4.0 ||
      xray.realisticYears >= 2 ||
      Boolean(player.isRookieContract)) &&
    !isAtOrPastCliff
  ) {
    signal = 'INSULATED_ALPHA';
    badgeLabel = '🔒 Insulated Alpha';
    fantasyTakeaway = player.isRookieContract
      ? `Locked on cost-controlled rookie deal ($${capHit2026.toFixed(1)}M in '26) at Age ${player.ageIn2026} — insulated ${depthChartSlot} workload.`
      : `Protected by $${deadCap2026.toFixed(1)}M dead cap in '26 (${xray.realisticYears} real yrs left) — locked-in ${depthChartSlot} cornerstone.`;
  } else {
    signal = 'SOLID_DEPTH';
    badgeLabel = '✓ Steady Role';
    fantasyTakeaway = `${depthChartSlot} on ${xray.realisticYears}-yr active runway ($${capHit2026.toFixed(1)}M '26 cap hit) — stable depth outlook.`;
  }

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    depthChartOrder,
    depthChartSlot,
    signal,
    badgeLabel,
    insulationScore,
    capHit2026,
    deadCap2026,
    netSavingsIfCut2026,
    realYearsLeft: xray.realisticYears,
    fantasyTakeaway,
    rippleIfCutOrTraded,
  };
}

export function evaluateTeamFantasyEnvironment(
  capState: DerivedTeamCapState
): TeamFantasyEnvironment {
  const space2026 = capState.years[2026].effectiveCapSpace;

  const activeOls = capState.roster
    .filter(
      (p) =>
        p.position === 'OL' && getContractYearCapHit(p.contractYears[2026]) > 0
    )
    .sort((a, b) => b.overallRating - a.overallRating);

  const top5Ols = activeOls.slice(0, 5);
  const olStartersSigned = activeOls.filter((p) => p.overallRating >= 74).length;
  const olAvgRating =
    top5Ols.length > 0
      ? roundCap(
          top5Ols.reduce((sum, p) => sum + p.overallRating, 0) / top5Ols.length
        )
      : 70;

  let olGrade: TeamFantasyEnvironment['olGrade'] = 'D';
  if (olStartersSigned >= 4 && olAvgRating >= 81) {
    olGrade = 'A';
  } else if (olStartersSigned >= 3 && olAvgRating >= 77) {
    olGrade = 'B';
  } else if (olStartersSigned >= 2 && olAvgRating >= 73) {
    olGrade = 'C';
  }

  const olSummary = `${olStartersSigned} starter-caliber OL signed (Top-5 Avg ${olAvgRating.toFixed(0)} OVR)`;

  const qbs = capState.roster
    .filter((p) => p.position === 'QB')
    .sort((a, b) => {
      if (b.overallRating !== a.overallRating) {
        return b.overallRating - a.overallRating;
      }
      return (
        getContractYearCapHit(b.contractYears[2026]) -
        getContractYearCapHit(a.contractYears[2026])
      );
    });

  const topQb = qbs[0];
  let qbStability: TeamFantasyEnvironment['qbStability'] =
    'Unsettled / Rookie Window';
  let qbName = topQb ? topQb.name : 'No Starter Signed';
  let qbSummary = 'No high-insulation franchise QB under multi-year lock.';

  if (topQb) {
    const qbEval = evaluateFantasyPlayerSignal(topQb, capState.roster, space2026);
    if (
      topQb.overallRating >= 80 &&
      qbEval.signal !== 'PAPER_TRAP' &&
      qbEval.signal !== 'TAG_OR_UFA_WATCH'
    ) {
      qbStability = 'Locked Franchise QB';
      qbSummary = `${topQb.name} (${topQb.overallRating} OVR, ${qbEval.realYearsLeft} real yrs) stabilizes skill floor.`;
    } else if (topQb.overallRating >= 74) {
      qbStability = 'Bridge / Cut-Risk QB';
      qbSummary = `${topQb.name} (${topQb.overallRating} OVR) flagged ${qbEval.badgeLabel.replace(/^[^a-zA-Z]+/, '')} — ceiling depends on '26/'27 plan.`;
    } else {
      qbName = topQb.name;
      qbSummary = `QB room led by ${topQb.name} (${topQb.overallRating} OVR) — prime rookie/FA upgrade candidate.`;
    }
  }

  const needsRows = evaluateTeamPositionalNeedsByYear(capState);
  const vacatedTouchesSummary: string[] = [];

  for (const pos of ['RB', 'WR', 'TE', 'QB'] as const) {
    const posPlayers = capState.roster.filter((p) => p.position === pos);
    const threshold = getSkillStarterThresholdCount(pos);
    let addedForPos = false;

    for (const p of posPlayers) {
      const evalItem = evaluateFantasyPlayerSignal(p, capState.roster, space2026);
      if (
        evalItem.depthChartOrder <= threshold &&
        (evalItem.signal === 'PAPER_TRAP' || evalItem.signal === 'TAG_OR_UFA_WATCH')
      ) {
        vacatedTouchesSummary.push(
          `${evalItem.depthChartSlot} ${p.name}: ${
            evalItem.signal === 'PAPER_TRAP'
              ? `Cut risk (+$${evalItem.netSavingsIfCut2026.toFixed(1)}M)`
              : `Expiring '26 deal`
          } → ${evalItem.rippleIfCutOrTraded}`
        );
        addedForPos = true;
      }
    }

    const posNeed = needsRows.find((r) => r.position === pos);
    if (
      !addedForPos &&
      posNeed &&
      (posNeed.cellsByYear[2026].urgency === 'CRITICAL_NEED' ||
        posNeed.cellsByYear[2027].urgency === 'CRITICAL_NEED')
    ) {
      vacatedTouchesSummary.push(
        `${pos}: ${
          posNeed.cellsByYear[2026].urgency === 'CRITICAL_NEED'
            ? 'Immediate 2026 starter vacancy'
            : '2027 starter cliff looming'
        } (${posNeed.cellsByYear[2026].badgeLabel})`
      );
    }
  }

  return {
    teamId: capState.teamId,
    teamName: capState.teamName,
    olGrade,
    olStartersSigned,
    olAvgRating,
    olSummary,
    qbStability,
    qbName,
    qbSummary,
    vacatedTouchesSummary: vacatedTouchesSummary.slice(0, 5),
  };
}

export function scanLeagueFantasyLandingSpots(
  allTeams: Record<string, TeamSeedData>
): FantasyLandingSpotOpportunity[] {
  const spots: FantasyLandingSpotOpportunity[] = [];
  const olGradeBonus: Record<TeamFantasyEnvironment['olGrade'], number> = {
    A: 12,
    B: 7,
    C: 2,
    D: -4,
  };

  for (const team of Object.values(allTeams)) {
    const capState = computeDerivedTeamCapState(
      team,
      [],
      DEFAULT_CAP_GROWTH_RATE
    );
    const space26 = capState.years[2026].effectiveCapSpace;
    const needsRows = evaluateTeamPositionalNeedsByYear(capState);
    const env = evaluateTeamFantasyEnvironment(capState);

    const picks26 = team.draftPicks
      .filter((pk) => pk.year === 2026)
      .sort((a, b) => a.overallPick - b.overallPick);
    const rd1Count = picks26.filter((pk) => pk.round === 1).length;
    const rd2Count = picks26.filter((pk) => pk.round === 2).length;
    const topPick = picks26[0];
    const hasDay1Or2Ammo = rd1Count + rd2Count >= 1;

    const capStr = `${space26 >= 0 ? '+$' : '−$'}${Math.abs(space26).toFixed(0)}M '26 Cap`;
    const draftStr = topPick
      ? `Top Pick #${topPick.overallPick} (${rd1Count} Rd-1, ${rd2Count} Rd-2)`
      : 'Limited ' + `'26 Draft Capital`;

    for (const pos of ['RB', 'WR', 'TE', 'QB'] as const) {
      const posPlayers = capState.roster.filter((p) => p.position === pos);
      const evals = posPlayers
        .map((p) => evaluateFantasyPlayerSignal(p, capState.roster, space26))
        .sort((a, b) => a.depthChartOrder - b.depthChartOrder);

      const threshold = getSkillStarterThresholdCount(pos);
      const vulnerableStarters = evals.filter(
        (e) =>
          e.depthChartOrder <= threshold &&
          (e.signal === 'PAPER_TRAP' || e.signal === 'TAG_OR_UFA_WATCH')
      );

      const needRow = needsRows.find((r) => r.position === pos);
      const isCrit26 = needRow?.cellsByYear[2026].urgency === 'CRITICAL_NEED';
      const isCrit27 = needRow?.cellsByYear[2027].urgency === 'CRITICAL_NEED';

      if (!isCrit26 && !isCrit27 && vulnerableStarters.length === 0) {
        continue;
      }

      const breakoutCandidate = evals.find(
        (e) => e.signal === 'BREAKOUT_STASH'
      );
      const backupCandidate =
        breakoutCandidate ??
        evals.find((e) => e.depthChartOrder === threshold + 1);

      let archetype: FantasyLandingSpotOpportunity['archetype'];
      let archetypeBadge: string;
      let headline: string;

      if (breakoutCandidate && !isCrit26) {
        archetype = 'IN_HOUSE_BREAKOUT';
        archetypeBadge = '🚀 In-House Stash Promotion';
        headline = `${breakoutCandidate.playerName} (${breakoutCandidate.depthChartSlot}) poised to seize touches if ${vulnerableStarters[0]?.playerName ?? 'starter'} exits`;
      } else if (hasDay1Or2Ammo && (space26 < 45 || pos === 'RB' || rd1Count > 0)) {
        archetype = 'ROOKIE_DRAFT_SMASH';
        archetypeBadge = '🎯 Prime Rookie Draft Spot';
        headline = isCrit26
          ? `Open ${pos}1 runway with Round 1–2 ammo (${topPick ? `#${topPick.overallPick}` : 'Day 2'}) & ${env.olGrade}-grade OL`
          : `Imminent ${pos} reset behind ${vulnerableStarters[0]?.playerName ?? 'expiring starter'} — prime Day 1–2 rookie landing spot`;
      } else if (space26 >= 40) {
        archetype = 'FREE_AGENT_WAR_CHEST';
        archetypeBadge = '💰 Big-Money FA Destination';
        headline = `${capStr} warchest + urgent ${pos} need — top destination for marquee FA ${pos}s`;
      } else {
        archetype = 'IN_HOUSE_BREAKOUT';
        archetypeBadge = '🚀 Vacated Target Funnel';
        headline = `${vulnerableStarters.length > 0 ? vulnerableStarters[0].playerName : 'Depth cliff'} leaves high-leverage ${pos} role open in '${isCrit26 ? '26' : '27'}`;
      }

      const rawScore =
        50 +
        (isCrit26 ? 20 : isCrit27 ? 10 : 6) +
        Math.min(16, vulnerableStarters.length * 10) +
        olGradeBonus[env.olGrade] +
        (env.qbStability === 'Locked Franchise QB' ? 8 : pos === 'QB' ? 6 : 0) +
        (hasDay1Or2Ammo ? 6 : 0) +
        (space26 >= 40 ? 6 : 0);
      const opportunityScore = Math.max(40, Math.min(99, Math.round(rawScore)));

      spots.push({
        id: `${team.id}-${pos}`,
        teamId: team.id,
        teamName: `${team.city} ${team.name}`,
        teamAbbr: team.abbreviation,
        position: pos,
        archetype,
        archetypeBadge,
        opportunityScore,
        headline,
        vacatingOrAtRiskPlayers: vulnerableStarters.map(
          (v) =>
            `${v.playerName} (${
              v.signal === 'PAPER_TRAP'
                ? `Cut saves +$${v.netSavingsIfCut2026.toFixed(1)}M`
                : `'27 UFA`
            })`
        ),
        capAndDraftAmmo: `${capStr} · ${draftStr}`,
        inHouseBeneficiary: backupCandidate
          ? `${backupCandidate.playerName} (${backupCandidate.depthChartSlot})`
          : null,
        olGrade: env.olGrade,
      });
    }
  }

  return spots
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 18);
}

export function normalizeFantasyPlayerName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’.`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function auditFantasyRosterPlayers(
  playerNamesOrIds: string[],
  allTeams: Record<string, TeamSeedData>
): FantasyRosterAuditReport {
  const byNormalizedName = new Map<
    string,
    { player: Player; team: TeamSeedData }
  >();
  const byId = new Map<string, { player: Player; team: TeamSeedData }>();

  for (const team of Object.values(allTeams)) {
    for (const player of team.roster) {
      if (!isFantasySkillPosition(player.position)) continue;
      byId.set(player.id, { player, team });
      const norm = normalizeFantasyPlayerName(player.name);
      if (!byNormalizedName.has(norm)) {
        byNormalizedName.set(norm, { player, team });
      }
    }
  }

  const teamCache = new Map<
    string,
    { capState: DerivedTeamCapState; env: TeamFantasyEnvironment }
  >();
  const getTeamContext = (team: TeamSeedData) => {
    let cached = teamCache.get(team.id);
    if (!cached) {
      const capState = computeDerivedTeamCapState(
        team,
        [],
        DEFAULT_CAP_GROWTH_RATE
      );
      const env = evaluateTeamFantasyEnvironment(capState);
      cached = { capState, env };
      teamCache.set(team.id, cached);
    }
    return cached;
  };

  const seenPlayerIds = new Set<string>();
  const auditedItems: AuditedFantasyPlayerItem[] = [];

  for (const query of playerNamesOrIds) {
    const trimmed = query.trim();
    if (!trimmed) continue;

    const match =
      byId.get(trimmed) ??
      byNormalizedName.get(normalizeFantasyPlayerName(trimmed));
    if (!match || seenPlayerIds.has(match.player.id)) continue;

    seenPlayerIds.add(match.player.id);
    const { capState, env } = getTeamContext(match.team);
    const evaluation = evaluateFantasyPlayerSignal(
      match.player,
      capState.roster,
      capState.years[2026].effectiveCapSpace
    );

    auditedItems.push({
      player: match.player,
      teamId: match.team.id,
      teamAbbr: match.team.abbreviation,
      teamName: `${match.team.city} ${match.team.name}`,
      evaluation,
      env,
    });
  }

  const insulatedCornerstones = auditedItems.filter(
    (item) => item.evaluation.signal === 'INSULATED_ALPHA'
  );
  const paperContractTraps = auditedItems.filter(
    (item) => item.evaluation.signal === 'PAPER_TRAP'
  );
  const breakoutStashes = auditedItems.filter(
    (item) => item.evaluation.signal === 'BREAKOUT_STASH'
  );
  const ufaTagWatch = auditedItems.filter(
    (item) => item.evaluation.signal === 'TAG_OR_UFA_WATCH'
  );
  const solidDepth = auditedItems.filter(
    (item) => item.evaluation.signal === 'SOLID_DEPTH'
  );

  const overallInsulationScore =
    auditedItems.length > 0
      ? Math.round(
          auditedItems.reduce(
            (sum, item) => sum + item.evaluation.insulationScore,
            0
          ) / auditedItems.length
        )
      : 0;

  return {
    overallInsulationScore,
    totalAudited: auditedItems.length,
    insulatedCornerstones,
    paperContractTraps,
    breakoutStashes,
    ufaTagWatch,
    solidDepth,
  };
}
