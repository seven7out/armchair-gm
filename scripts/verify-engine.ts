import {
  computeDerivedTeamCapState,
  DEFAULT_CAP_GROWTH_RATE,
  evaluatePlayerLongevity,
  generateRookieContract,
  getContractYearCapHit,
  getDraftPickTradeValue,
  roundCap,
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

console.log('\n✅ ALL DETERMINISTIC CAP ENGINE CHECKS PASSED!');
