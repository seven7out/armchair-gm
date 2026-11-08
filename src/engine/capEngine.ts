import {
  DEFAULT_CAP_GROWTH_RATE,
  getLeagueCapCeiling,
  REPLACEMENT_MIN_SALARY_BY_YEAR,
  roundCap,
} from './constants';
import {
  applyPlayerReleaseOrTrade,
  getContractYearCapHit,
  getContractYearCash,
  simulateRestructure,
} from './contractEngine';
import { createDraftedPlayer, generateRookieContract } from './draftEngine';
import { applyPlayerExtension, createSignedFreeAgentPlayer } from './freeAgencyEngine';
import {
  CompPickTrackerSummary,
  DeadCapEntry,
  DerivedTeamCapState,
  DraftPick,
  LEAGUE_YEARS,
  LeagueYear,
  Player,
  POSITION_GROUPS,
  PositionGroup,
  TeamSeedData,
  Transaction,
  YearCapBreakdown,
} from './types';

/**
 * Multi-Year Salary Cap, Cash Spend, Top-51 Rule, Void Acceleration,
 * Compensatory Pick Cancellation & Rollover Engine (`capEngine.ts`).
 */
export function computeDerivedTeamCapState(
  baseTeam: TeamSeedData,
  transactions: Transaction[],
  capGrowthRate: number = DEFAULT_CAP_GROWTH_RATE
): DerivedTeamCapState {
  // 1. Deep-clone roster, dead money ledger, and draft picks
  const roster: Player[] = baseTeam.roster.map((p) => ({
    ...p,
    contractYears: {
      2026: p.contractYears[2026] ? { ...p.contractYears[2026]! } : null,
      2027: p.contractYears[2027] ? { ...p.contractYears[2027]! } : null,
      2028: p.contractYears[2028] ? { ...p.contractYears[2028]! } : null,
      2029: p.contractYears[2029] ? { ...p.contractYears[2029]! } : null,
    },
  }));

  const deadCapLedger: DeadCapEntry[] = baseTeam.priorDeadMoney.map((d) => ({
    ...d,
    amountsByYear: { ...d.amountsByYear },
  }));

  let draftPicks: DraftPick[] = baseTeam.draftPicks.map((pk) => ({ ...pk }));

  // Track Comp Pick formula & Post-June 1 designation limit (max 2 per offseason)
  const cfaLosses = [...(baseTeam.departingCfaLosses ?? [
    { name: 'Carlton Davis III', position: 'CB' as PositionGroup, estApy: 18.0, projectedRound: 3 },
    { name: 'Kevin Zeitler', position: 'OL' as PositionGroup, estApy: 9.0, projectedRound: 5 },
  ])];
  const cfaQualifyingSignings: { name: string; position: PositionGroup; apy: number }[] = [];
  let streetFASigningsCount = 0;
  let postJune1DesignationsUsed = 0;

  // 2. Apply all enabled transactions in chronological order
  const enabledMoves = transactions.filter((t) => t.enabled);

  for (const tx of enabledMoves) {
    switch (tx.type) {
      case 'PRE_JUNE_1_CUT':
      case 'POST_JUNE_1_CUT': {
        if (tx.type === 'POST_JUNE_1_CUT') {
          postJune1DesignationsUsed++;
        }
        const idx = roster.findIndex((p) => p.id === tx.playerId);
        if (idx !== -1) {
          const targetPlayer = roster[idx];
          const deadEntry = applyPlayerReleaseOrTrade(
            targetPlayer,
            tx.actionYear,
            tx.type,
            tx.id
          );
          deadCapLedger.push(deadEntry);

          if (tx.actionYear === 2026) {
            roster.splice(idx, 1);
          } else {
            const updatedYears = { ...targetPlayer.contractYears };
            for (const y of LEAGUE_YEARS) {
              if (y >= tx.actionYear) {
                updatedYears[y] = null;
              }
            }
            roster[idx] = { ...targetPlayer, contractYears: updatedYears };
          }
        }
        break;
      }

      case 'RESTRUCTURE': {
        const idx = roster.findIndex((p) => p.id === tx.playerId);
        if (idx !== -1) {
          const sim = simulateRestructure(
            roster[idx],
            tx.actionYear,
            tx.convertPercentage,
            tx.addVoidYears
          );
          roster[idx] = sim.updatedPlayer;
        }
        break;
      }

      case 'EXTENSION': {
        const idx = roster.findIndex((p) => p.id === tx.playerId);
        if (idx !== -1) {
          const { updatedPlayer } = applyPlayerExtension(
            roster[idx],
            tx.actionYear,
            tx.newYearsAdded,
            tx.apy,
            tx.guaranteedPct,
            tx.structure
          );
          roster[idx] = updatedPlayer;
        }
        break;
      }

      case 'FRANCHISE_TAG': {
        const idx = roster.findIndex((p) => p.id === tx.playerId);
        if (idx !== -1) {
          const p = roster[idx];
          const updatedYears = { ...p.contractYears };
          updatedYears[tx.actionYear] = {
            year: tx.actionYear,
            baseSalary: tx.tagSalary,
            guaranteedSalary: tx.tagSalary,
            proratedBonus: updatedYears[tx.actionYear]?.proratedBonus ?? 0,
            rosterBonus: 0,
            workoutBonus: 0,
            isVoidYear: false,
            isFranchiseTag: true,
          };
          roster[idx] = {
            ...p,
            notes: `Applied ${tx.tagType === 'TRANSITION' ? 'Transition' : 'Franchise'} Tag ($${tx.tagSalary.toFixed(2)}M in ${tx.actionYear})`,
            contractYears: updatedYears,
          };
        }
        break;
      }

      case 'SIGN_FA': {
        const newPlayer = createSignedFreeAgentPlayer(
          tx.freeAgent,
          tx.actionYear,
          tx.years,
          tx.apy,
          tx.guaranteedPct,
          tx.structure
        );
        roster.push({
          ...newPlayer,
          id: `fa-${tx.id}-${tx.freeAgent.id}`,
        });

        if (tx.countsTowardCompPickFormula) {
          cfaQualifyingSignings.push({
            name: tx.freeAgent.name,
            position: tx.freeAgent.position,
            apy: tx.apy,
          });
        } else {
          streetFASigningsCount++;
        }
        break;
      }

      case 'TRADE': {
        for (const outPlayerId of tx.outgoingPlayerIds) {
          const idx = roster.findIndex((p) => p.id === outPlayerId);
          if (idx !== -1) {
            const mode =
              tx.designation === 'POST_JUNE_1' ? 'POST_JUNE_1_TRADE' : 'PRE_JUNE_1_TRADE';
            const deadEntry = applyPlayerReleaseOrTrade(
              roster[idx],
              tx.actionYear,
              mode,
              tx.id
            );
            deadCapLedger.push(deadEntry);
            roster.splice(idx, 1);
          }
        }

        for (const inc of tx.incomingPlayers) {
          const strippedYears = {
            2026: inc.contractYears[2026]
              ? { ...inc.contractYears[2026]!, proratedBonus: 0 }
              : null,
            2027: inc.contractYears[2027]
              ? { ...inc.contractYears[2027]!, proratedBonus: 0 }
              : null,
            2028: inc.contractYears[2028]
              ? { ...inc.contractYears[2028]!, proratedBonus: 0 }
              : null,
            2029: inc.contractYears[2029]
              ? { ...inc.contractYears[2029]!, proratedBonus: 0 }
              : null,
          };
          roster.push({
            ...inc,
            notes: `Acquired via Trade (${tx.partnerTeamName})`,
            contractYears: strippedYears,
          });
        }

        draftPicks = draftPicks.filter((pk) => !tx.outgoingPickIds.includes(pk.id));

        for (const incPick of tx.incomingPicks) {
          draftPicks.push({
            ...incPick,
            currentTeamId: baseTeam.id,
          });
        }
        draftPicks.sort((a, b) => a.year - b.year || a.overallPick - b.overallPick);
        break;
      }

      case 'DRAFT_SIGNING': {
        const pickIdx = draftPicks.findIndex((pk) => pk.id === tx.pickId);
        if (pickIdx !== -1) {
          const pick = draftPicks[pickIdx];
          draftPicks[pickIdx] = {
            ...pick,
            selectedPlayerName: tx.prospectName,
            selectedPosition: tx.position,
          };
          const draftedPlayer = createDraftedPlayer(pick, tx.prospectName, tx.position);
          roster.push(draftedPlayer);
        }
        break;
      }

      case 'FIFTH_YEAR_OPTION': {
        const idx = roster.findIndex((p) => p.id === tx.playerId);
        if (idx !== -1) {
          const p = roster[idx];
          const updatedYears = { ...p.contractYears };
          updatedYears[tx.actionYear] = {
            year: tx.actionYear,
            baseSalary: tx.optionAmount,
            guaranteedSalary: tx.optionAmount,
            proratedBonus: updatedYears[tx.actionYear]?.proratedBonus ?? 0,
            rosterBonus: 0,
            workoutBonus: 0,
            isVoidYear: false,
            isFifthYearOption: true,
          };
          roster[idx] = {
            ...p,
            fifthYearOptionExercised: true,
            contractYears: updatedYears,
          };
        }
        break;
      }
    }
  }

  // 3. Automatic Void-Year Acceleration Check
  for (const player of roster) {
    for (const y of LEAGUE_YEARS) {
      const cy = player.contractYears[y];
      if (cy && cy.isVoidYear) {
        let acceleratedVoidTotal = 0;
        for (const futureY of LEAGUE_YEARS) {
          if (futureY >= y && player.contractYears[futureY]?.isVoidYear) {
            acceleratedVoidTotal += player.contractYears[futureY]!.proratedBonus;
          }
        }
        if (acceleratedVoidTotal > 0) {
          const amounts: Record<LeagueYear, number> = { 2026: 0, 2027: 0, 2028: 0, 2029: 0 };
          amounts[y] = roundCap(acceleratedVoidTotal);
          deadCapLedger.push({
            id: `void-accel-${player.id}-${y}`,
            playerId: player.id,
            playerName: player.name,
            position: player.position,
            reason: `Void Year Bonus Acceleration (${y})`,
            amountsByYear: amounts,
          });
        }
        break;
      }
    }
  }

  // 4. Compute Compensatory Pick Cancellation Formula
  // Each CFA-qualifying signing cancels the closest equal-or-lower CFA loss
  const remainingLosses = [...cfaLosses].sort((a, b) => b.estApy - a.estApy);
  const sortedSignings = [...cfaQualifyingSignings].sort((a, b) => b.apy - a.apy);
  for (const signing of sortedSignings) {
    if (remainingLosses.length > 0) {
      remainingLosses.shift();
    }
  }
  const netProjectedCompPicks = remainingLosses.map(
    (loss) => `2027 Rd ${loss.projectedRound} Comp (for ${loss.name})`
  );

  const compPickSummary: CompPickTrackerSummary = {
    cfaQualifyingLosses: cfaLosses,
    cfaQualifyingSignings,
    streetFASigningsCount,
    netProjectedCompPicks,
    postJune1DesignationsUsed,
  };

  // 5. Compute 4-year Top-51 Cap, Cash Spend, Dead Money, Rookie Pool Displacement, and Rollover Cascade
  const years = {} as Record<LeagueYear, YearCapBreakdown>;
  let currentRollover = baseTeam.initialRollover2026;

  for (const y of LEAGUE_YEARS) {
    const baseLeagueCap = getLeagueCapCeiling(y, capGrowthRate);
    const rolloverFromPriorYear = roundCap(currentRollover);
    const adjustedCapCeiling = roundCap(baseLeagueCap + rolloverFromPriorYear);

    const activePlayerHits: { player: Player; hit: number; cash: number }[] = [];
    for (const p of roster) {
      const cy = p.contractYears[y];
      if (cy && !cy.isVoidYear) {
        activePlayerHits.push({
          player: p,
          hit: getContractYearCapHit(cy),
          cash: getContractYearCash(cy),
        });
      }
    }

    activePlayerHits.sort((a, b) => b.hit - a.hit);
    const activeRosterCount = activePlayerHits.length;

    const allRosterCap = roundCap(
      activePlayerHits.reduce((acc, item) => acc + item.hit, 0)
    );
    const totalCashSpend = roundCap(
      activePlayerHits.reduce((acc, item) => acc + item.cash, 0)
    );

    const minBaseline = REPLACEMENT_MIN_SALARY_BY_YEAR[y];
    const top51List = activePlayerHits.slice(0, 51).map((x) => x.hit);
    while (top51List.length < 51) {
      top51List.push(minBaseline);
    }

    const activeTop51Cap = roundCap(top51List.reduce((acc, h) => acc + h, 0));
    const replacementLevelCutoff = roundCap(top51List[50] ?? minBaseline);

    const deadMoneyTotal = roundCap(
      deadCapLedger.reduce((acc, entry) => acc + (entry.amountsByYear[y] ?? 0), 0)
    );

    const unsignedPicksForYear = draftPicks.filter(
      (pk) => pk.year === y && !pk.selectedPlayerName
    );
    let rookiePoolReserve = 0;
    let netRookiePoolImpact = 0;

    for (const pk of unsignedPicksForYear) {
      const slot = generateRookieContract(pk.overallPick, y, 'EDGE', replacementLevelCutoff);
      rookiePoolReserve += slot.year1CapHit;
      netRookiePoolImpact += slot.year1NetCapImpactAfterDisplacement;
    }
    rookiePoolReserve = roundCap(rookiePoolReserve);
    netRookiePoolImpact = roundCap(netRookiePoolImpact);

    const totalCapCommitments = roundCap(
      activeTop51Cap + deadMoneyTotal + netRookiePoolImpact
    );
    const effectiveCapSpace = roundCap(adjustedCapCeiling - totalCapCommitments);

    const posTotals: Record<PositionGroup, number> = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      OL: 0,
      EDGE: 0,
      IDL: 0,
      LB: 0,
      CB: 0,
      S: 0,
      ST: 0,
    };
    for (const item of activePlayerHits) {
      posTotals[item.player.position] = roundCap(
        posTotals[item.player.position] + item.hit
      );
    }

    const topPositionAllocation = POSITION_GROUPS.map((pos) => ({
      position: pos,
      capSpend: posTotals[pos],
      pctOfCap: roundCap((posTotals[pos] / adjustedCapCeiling) * 100),
    })).sort((a, b) => b.capSpend - a.capSpend);

    years[y] = {
      year: y,
      baseLeagueCap,
      rolloverFromPriorYear,
      adjustedCapCeiling,
      activeTop51Cap,
      allRosterCap,
      totalCashSpend,
      deadMoneyTotal,
      rookiePoolReserve,
      netRookiePoolImpact,
      totalCapCommitments,
      effectiveCapSpace,
      replacementLevelCutoff,
      activeRosterCount,
      topPositionAllocation,
    };

    currentRollover = Math.max(0, effectiveCapSpace);
  }

  return {
    teamId: baseTeam.id,
    teamName: `${baseTeam.city} ${baseTeam.name}`,
    capGrowthRate,
    roster,
    deadCapLedger,
    draftPicks,
    compPickSummary,
    years,
  };
}
