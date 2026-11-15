import {
  auditFantasyRosterPlayers,
  computeDerivedTeamCapState,
  DEFAULT_CAP_GROWTH_RATE,
  evaluateFantasyPlayerSignal,
  evaluateFreeAgentValueBadge,
  evaluatePlayerLongevity,
  evaluateTeamCampBattles,
  evaluateTeamFantasyEnvironment,
  generateRookieContract,
  getContractYearCapHit,
  getDraftPickTradeValue,
  roundCap,
  SAMPLE_DYNASTY_ROSTER_NAMES,
  scanLeagueFantasyLandingSpots,
  simulateCutOrTrade,
  simulateRestructure,
  Transaction,
} from '../src/engine';
import { SEED_TEAMS } from '../src/data/seed/teams';
import { SEED_FREE_AGENTS } from '../src/data/seed/freeAgents';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`VERIFICATION FAILED: ${message}`);
  }
}

console.log('=== ARMCHAIR GM DETERMINISTIC CAP ENGINE VERIFICATION ===\n');

// 0. Verify all 32 NFL Franchises are present and compute clean 4-year cap horizons
const allTeamIds = Object.keys(SEED_TEAMS);
assert(allTeamIds.length === 32, `Expected 32 NFL franchises, found ${allTeamIds.length}`);
for (const tid of allTeamIds) {
  const t = SEED_TEAMS[tid];
  assert(Boolean(t.logoUrl), `Team ${tid} must have an official ESPN logoUrl`);
  assert(t.roster.length >= 20, `Team ${tid} must have active Over The Cap contracts`);
  const st = computeDerivedTeamCapState(t, [], DEFAULT_CAP_GROWTH_RATE);
  assert(!Number.isNaN(st.years[2026].effectiveCapSpace), `Team ${tid} 2026 cap space must be valid`);
}
console.log(`0. Verified all ${allTeamIds.length} NFL franchises (8 divisions) with live Over The Cap ledgers & ESPN logos.\n`);

// 1. Base Detroit Lions 4-Year Cap State
const detBase = SEED_TEAMS['DET'];
const baseState = computeDerivedTeamCapState(detBase, [], DEFAULT_CAP_GROWTH_RATE);

console.log('1. Base Detroit Lions 2026–2029 Cap State:');
for (const yr of [2026, 2027, 2028, 2029] as const) {
  const y = baseState.years[yr];
  console.log(
    `   ${yr}: Ceiling=$${y.adjustedCapCeiling.toFixed(2)}M (Rollover=$${y.rolloverFromPriorYear.toFixed(2)}M) | ActiveTop51=$${y.activeTop51Cap.toFixed(2)}M | Dead=$${y.deadMoneyTotal.toFixed(2)}M | NetRookie=$${y.netRookiePoolImpact.toFixed(2)}M => EffectiveSpace=$${y.effectiveCapSpace.toFixed(2)}M`
  );
}

// 2. Verify Live Over The Cap Roster & Dead Money Accuracy (Montgomery, Decker, Hooker, Raymond not on active roster)
const activeNames = new Set(detBase.roster.map((p) => p.name));
for (const departed of ['David Montgomery', 'Hendon Hooker', 'Kalif Raymond', 'Taylor Decker', 'Frank Ragnow', 'D.J. Reader']) {
  assert(!activeNames.has(departed), `${departed} should NOT be on Detroit's 2026 active roster`);
}
for (const deadEntry of ['David Montgomery', 'Taylor Decker', 'Frank Ragnow', 'D.J. Reader', 'Graham Glasgow', 'Alex Anzalone']) {
  assert(
    detBase.priorDeadMoney.some((d) => d.playerName.includes(deadEntry)),
    `${deadEntry} SHOULD be in Detroit's 2026 Over The Cap Dead Money ledger`
  );
}

// 2b. Verify Signed IR / PUP / NFI Reserve Players Are Included Across Teams (MIA & DET)
const miaRoster = SEED_TEAMS['MIA'].roster;
for (const starName of ['Malik Willis', 'Zach Sieler', 'Devon Achane']) {
  const found = miaRoster.find((p) => p.name === starName);
  assert(
    Boolean(found && found.contractYears[2026]),
    `${starName} SHOULD be on Miami's roster with a valid 2026 contract year`
  );
}
const willis = miaRoster.find((p) => p.name === 'Malik Willis')!;
assert(
  Boolean(willis.contractYears[2027] && willis.contractYears[2028]),
  'Malik Willis SHOULD retain his multi-year 2027-2028 Dolphins contract'
);
for (const detReserve of ['Jack Campbell', 'Kerby Joseph']) {
  assert(
    detBase.roster.some((p) => p.name === detReserve),
    `${detReserve} SHOULD be on Detroit's roster (including IR/PUP players)`
  );
}

// 3. Test Restructure Math on Jared Goff (Live Over The Cap 2026 Contract: det-4714)
const goff = detBase.roster.find((p) => p.name === 'Jared Goff')!;
const goffRestructure = simulateRestructure(goff, 2026, 1.0, 0);
console.log(
  `\n2. Jared Goff 100% Restructure Simulation:\n   Original 2026 Hit: $${getContractYearCapHit(goff.contractYears[2026]).toFixed(2)}M | Vet Min Floor: $${goffRestructure.vetMinimumFloor.toFixed(2)}M | Converted Bonus: $${goffRestructure.convertedBonusAmount.toFixed(2)}M across ${goffRestructure.prorationYearsCount} yrs (+$${goffRestructure.annualProrationAdded.toFixed(2)}M/yr) => 2026 Cap Savings: +$${goffRestructure.currentYearCapSavings.toFixed(2)}M`
);
assert(goffRestructure.vetMinimumFloor === 1.38, 'Goff 10-yr vet min should be $1.38M');

// 4. Test Pre-June 1 vs Post-June 1 Cut on Alim McNeill (Live Over The Cap Contract)
const mcneill = detBase.roster.find((p) => p.name === 'Alim McNeill')!;
const mcneillPreJune = simulateCutOrTrade(mcneill, 2026, 'PRE_JUNE_1_CUT');
const mcneillPostJune = simulateCutOrTrade(mcneill, 2026, 'POST_JUNE_1_CUT');

console.log(
  `\n3. Alim McNeill Cut Comparison (2026 Original Hit: $${mcneillPreJune.currentYearOriginalCapHit.toFixed(2)}M):`
);
console.log(
  `   Pre-June 1 Cut:  2026 Dead=$${mcneillPreJune.currentYearDeadCap.toFixed(2)}M | 2026 Savings=$${mcneillPreJune.currentYearCapSavings.toFixed(2)}M | 2027 Dead=$${mcneillPreJune.nextYearDeadCap.toFixed(2)}M`
);
console.log(
  `   Post-June 1 Cut: 2026 Dead=$${mcneillPostJune.currentYearDeadCap.toFixed(2)}M | 2026 Savings=+$${mcneillPostJune.currentYearCapSavings.toFixed(2)}M | 2027 Deferred Dead=$${mcneillPostJune.nextYearDeadCap.toFixed(2)}M`
);

// 5. Multi-Move Scenario Stack Sequence (Restructure Goff + Post-June 1 Cut McNeill + Sign Tier-1 FA Trey Hendrickson)
const hendrickson = SEED_FREE_AGENTS[0];
const scenarioMoves: Transaction[] = [
  {
    id: 'tx-1',
    type: 'RESTRUCTURE',
    timestamp: 1,
    enabled: true,
    actionYear: 2026,
    playerId: goff.id,
    playerName: goff.name,
    position: goff.position,
    convertPercentage: 1.0,
    addVoidYears: 0,
    label: 'Restructure Goff',
    sublabel: '',
    capDelta2026: goffRestructure.currentYearCapSavings,
  },
  {
    id: 'tx-2',
    type: 'POST_JUNE_1_CUT',
    timestamp: 2,
    enabled: true,
    actionYear: 2026,
    playerId: mcneill.id,
    playerName: mcneill.name,
    position: mcneill.position,
    label: 'Post-June 1 Cut McNeill',
    sublabel: '',
    capDelta2026: mcneillPostJune.currentYearCapSavings,
  },
  {
    id: 'tx-3',
    type: 'SIGN_FA',
    timestamp: 3,
    enabled: true,
    actionYear: 2026,
    freeAgent: hendrickson,
    years: 3,
    apy: 30.5,
    guaranteedPct: 0.62,
    structure: 'Backloaded',
    countsTowardCompPickFormula: true,
    label: 'Sign FA Trey Hendrickson',
    sublabel: '',
    capDelta2026: -16.0,
  },
];

const afterScenarioState = computeDerivedTeamCapState(
  detBase,
  scenarioMoves,
  DEFAULT_CAP_GROWTH_RATE
);

console.log('\n4. Detroit Lions 4-Year Cap Horizon After 3-Move Offseason Sequence:');
for (const yr of [2026, 2027, 2028, 2029] as const) {
  const before = baseState.years[yr].effectiveCapSpace;
  const after = afterScenarioState.years[yr].effectiveCapSpace;
  console.log(
    `   ${yr} Effective Cap Space: Before=$${before.toFixed(2)}M -> After=$${after.toFixed(2)}M (Delta=${after - before >= 0 ? '+' : ''}$${(after - before).toFixed(2)}M)`
  );
}

// Verify toggling off all moves restores exact initial state
const toggledOffMoves = scenarioMoves.map((m) => ({ ...m, enabled: false }));
const restoredState = computeDerivedTeamCapState(
  detBase,
  toggledOffMoves,
  DEFAULT_CAP_GROWTH_RATE
);
assert(
  restoredState.years[2026].effectiveCapSpace ===
    baseState.years[2026].effectiveCapSpace,
  'Toggling off all Scenario Stack moves must deterministically restore exact base cap space'
);

// 6. Verify Rookie Scale & Aging Longevity
const pick1 = generateRookieContract(1, 2026, 'QB');
const pick28 = generateRookieContract(28, 2026, 'EDGE');
const branch = detBase.roster.find((p) => p.name === 'Brian Branch')!;
const branchLongevity = evaluatePlayerLongevity(branch);
console.log(
  `\n5. Rookie Scale & Aging Checks:\n   Pick #1 4-Yr Deal: $${pick1.totalFourYearValue}M (2026 Net Impact: -$${pick1.year1NetCapImpactAfterDisplacement}M, Rich Hill Value: ${getDraftPickTradeValue(1, 'RichHill')} pts)\n   Pick #28 4-Yr Deal: $${pick28.totalFourYearValue}M (2026 Net Impact: -$${pick28.year1NetCapImpactAfterDisplacement}M)\n   Brian Branch (Age ${branch.ageIn2026} S): ${branchLongevity.extensionRecommendation} (+${branchLongevity.postContractViableYears} viable post-contract starter yrs before Age-${branchLongevity.cliffAge} cliff)`
);

// 7. Fantasy Football Contract Insulation, Environment, Landing Spots & Audit Checks
const gibbs = detBase.roster.find((p) => p.name === 'Jahmyr Gibbs')!;
assert(Boolean(gibbs), 'Jahmyr Gibbs must exist on Detroit Lions roster');
const gibbsEval = evaluateFantasyPlayerSignal(
  gibbs,
  detBase.roster,
  baseState.years[2026].effectiveCapSpace
);
const detEnv = evaluateTeamFantasyEnvironment(baseState);
const landingSpots = scanLeagueFantasyLandingSpots(SEED_TEAMS);
const sampleAudit = auditFantasyRosterPlayers(
  SAMPLE_DYNASTY_ROSTER_NAMES,
  SEED_TEAMS
);
assert(
  gibbsEval.insulationScore >= 50 && gibbsEval.depthChartSlot === 'RB1',
  `Expected Jahmyr Gibbs to evaluate as insulated RB1, got ${gibbsEval.depthChartSlot} (${gibbsEval.insulationScore}/99)`
);
assert(
  ['A', 'B', 'C', 'D'].includes(detEnv.olGrade),
  'Detroit Fantasy Environment must return a valid OL Grade'
);
assert(
  landingSpots.length >= 5,
  `Expected >= 5 league-wide fantasy landing spots, found ${landingSpots.length}`
);
assert(
  sampleAudit.totalAudited >= 5 && sampleAudit.overallInsulationScore > 0,
  `Expected Sample Dynasty Roster audit to match >= 5 skill players, matched ${sampleAudit.totalAudited}`
);
console.log(
  `\n6. Fantasy Football Contract Insulation & Landing Spot Checks:\n   ${gibbs.name} (${gibbsEval.depthChartSlot}): ${gibbsEval.badgeLabel} (Insulation ${gibbsEval.insulationScore}/99)\n   ${detEnv.teamName}: OL Grade ${detEnv.olGrade} | QB: ${detEnv.qbStability} (${detEnv.qbName})\n   League Landing Spots Detected: ${landingSpots.length} (Top: ${landingSpots[0].teamAbbr} ${landingSpots[0].position} — ${landingSpots[0].archetypeBadge})\n   Sample Dynasty Audit: ${sampleAudit.totalAudited} players matched, Avg Insulation ${sampleAudit.overallInsulationScore}/99 (Traps: ${sampleAudit.paperContractTraps.length}, Stashes: ${sampleAudit.breakoutStashes.length})`
);

// 8. Camp Battle Financial Decoder (#10) & Free Agent Value Badges (#12)
const detCampBattles = evaluateTeamCampBattles(baseState);
assert(
  detCampBattles.length === 3,
  `Expected 3 camp battle room insights (RB/WR/TE) for Detroit, found ${detCampBattles.length}`
);
const wrBattle = detCampBattles.find((b) => b.position === 'WR');
assert(
  Boolean(wrBattle && wrBattle.leaderDeadCap2026 >= wrBattle.challengerDeadCap2026),
  'WR camp battle must sort by financial commitment / dead cap leadership'
);

const primeYoungFa = SEED_FREE_AGENTS.find(
  (fa) => fa.ageIn2026 <= 26 && fa.overallRating >= 78
);
assert(
  Boolean(primeYoungFa) &&
    evaluateFreeAgentValueBadge(primeYoungFa!).tier === 'PRIME_BUY',
  'Young 78+ OVR free agent must evaluate as PRIME_BUY'
);

const agingExpensiveFa = {
  ...SEED_FREE_AGENTS[0],
  position: 'RB' as const,
  ageIn2026: 30,
  marketYears: 3,
  marketApy: 12.5,
};
assert(
  evaluateFreeAgentValueBadge(agingExpensiveFa).tier === 'CLIFF_TRAP',
  '30-year-old RB on a 3-yr/$12.5M deal must evaluate as CLIFF_TRAP'
);

console.log(
  `\n7. Camp Battle & FA Value Badge Checks:\n   Detroit Camp Rooms: ${detCampBattles.map((b) => `${b.position}=${b.badgeLabel} (${b.leaderName} $${b.leaderDeadCap2026}M dead)`).join(' | ')}\n   FA Value Badge Check: ${primeYoungFa!.name} -> ${evaluateFreeAgentValueBadge(primeYoungFa!).badgeLabel} | Aging RB Test -> ${evaluateFreeAgentValueBadge(agingExpensiveFa).badgeLabel}`
);

console.log('\n✅ ALL DETERMINISTIC CAP ENGINE CHECKS PASSED!');
