import { runHistoricalBacktestSuite } from '../src/data/seed/historicalBacktest2026';
import { scanRosterForCapCasualties } from '../src/engine/faPredictionEngine';
import { SEED_TEAMS } from '../src/data/seed/teams';

console.log('================================================================================');
console.log('   ARMCHAIR GM — 2026 FREE AGENT & CAP CASUALTY PREDICTOR BACKTEST REPORT');
console.log('================================================================================\n');

const report = runHistoricalBacktestSuite();

console.log(`OVERALL BLIND PREDICTION ACCURACY: ${report.accuracyPct}% (${report.correctPredictions}/${report.totalCases} correct)`);
console.log(`STREET FA / CAP CASUALTY RECALL:   ${report.streetFACapCasualtyRecallPct}%`);
console.log(`TAG / RE-SIGN TRAP PRECISION:      ${report.tagOrExtendPrecisionPct}%\n`);

console.log('DETAILED PLAYER-BY-PLAYER BACKTEST (JAN PRE-OFFSEASON SNAPSHOT -> ACTUAL OUTCOME):');
console.log('--------------------------------------------------------------------------------');

for (const item of report.detailedResults) {
  const { caseItem, predicted, isMatch } = item;
  console.log(
    `${isMatch ? '[✓ HIT] ' : '[✗ MISS]'} ${caseItem.playerName.padEnd(18)} (${caseItem.position.padEnd(4)} - ${caseItem.incumbentTeam}) | Origin: ${caseItem.input.originType.padEnd(22)}`
  );
  console.log(
    `         Predicted: ${predicted.classificationBadge} (${predicted.availabilityProbability}% Mkt Prob) | ${predicted.compPickImpactLabel}`
  );
  console.log(`         Signals:   ${predicted.primaryDrivers.join(' ; ')}`);
  console.log(`         Actual:    ${caseItem.actualOutcomeSummary}\n`);
}

console.log('================================================================================');
console.log('   IN-HOUSE 2026 ROSTER CAP CASUALTY SCAN (DETROIT LIONS & NEW ORLEANS SAINTS)');
console.log('================================================================================\n');

for (const teamId of ['DET', 'NO'] as const) {
  const team = SEED_TEAMS[teamId];
  const scan = scanRosterForCapCasualties(team.roster, teamId === 'NO' ? -38.6 : -18.0, 2026);
  console.log(`${team.city} ${team.name} Top Projected Cap Casualty / Restructure Candidates:`);
  for (const s of scan.slice(0, 5)) {
    console.log(
      `   • ${s.player.name.padEnd(18)} (${s.player.position}, Age ${s.player.ageIn2026}) | 2026 Hit: $${s.scheduledCapHit.toFixed(2)}M | Post-6/1 Saves: +$${s.postJuneSavings.toFixed(2)}M | Cut Prob: ${s.prediction.availabilityProbability}% (${s.prediction.classificationBadge})`
    );
  }
  console.log('');
}
