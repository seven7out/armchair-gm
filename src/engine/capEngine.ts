import {
  DEFAULT_CAP_GROWTH_RATE,
  getLeagueCapCeiling,
  REPLACEMENT_MIN_SALARY_BY_YEAR,
  roundCap,
} from './constants';
import {
  applyPlayerReleaseOrTrade,
  getContractYearCapHit,
  simulateRestructure,
} from './contractEngine';
import { createDraftedPlayer, generateRookieContract } from './draftEngine';
import { applyPlayerExtension, createSignedFreeAgentPlayer } from './freeAgencyEngine';
import {
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
 * Multi-Year Salary Cap, Top-51 Rule, Void Acceleration & Rollover Engine (`capEngine.ts`).
 *
 * Pure deterministic reducer:
 * Given a `TeamSeedData` base state and an ordered array of `Transaction` objects
 * (each of which may be enabled or toggled off in the Scenario Stack), computes the exact
 * 4-year `DerivedTeamCapState` for 2026, 2027, 2028, and 2029.
 */
export function computeDerivedTeamCapState(
  baseTeam: TeamSeedData,
  transactions: Transaction[],
  capGrowthRate: number = DEFAULT_CAP_GROWTH_RATE
): DerivedTeamCapState {
  // 1. Deep-clone roster, dead money ledger, and draft picks so base seed is never mutated
  let roster: Player[] = baseTeam.roster.map((p) => ({
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

  // 2. Apply all enabled transactions in chronological order
  const enabledMoves = transactions.filter((t) => t.enabled);

  for (const tx of enabledMoves) {
    switch (tx.type) {
      case 'PRE_JUNE_1_CUT':
      case 'POST_JUNE_1_CUT': {
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

          // If cut in 2026, remove from active roster; if cut in a future year (>2026), clear contract years >= actionYear
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
        break;
      }

      case 'TRADE': {
        // Process outgoing players
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

        // Process incoming players (acquiring team inherits baseSalary + roster/workout bonuses, zero prior signing bonus proration)
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

        // Remove outgoing draft picks
        draftPicks = draftPicks.filter((pk) => !tx.outgoingPickIds.includes(pk.id));

        // Add incoming draft picks
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

  // 3. Automatic Void-Year Acceleration Check:
  // When a player's active contract expires in year Y-1 and year Y is a Void Year, all remaining void-year
  // prorated bonuses from Y..2029 accelerate into year Y's Dead Money ledger.
  for (const player of roster) {
    for (const y of LEAGUE_YEARS) {
      const cy = player.contractYears[y];
      if (cy && cy.isVoidYear) {
        // Accelerate this void year and all subsequent void years into the first void year `y`
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
        // Break so we only accelerate at the FIRST void year when the contract voids
        break;
      }
    }
  }

  // 4. Compute 4-year Top-51 Cap, Dead Money, Rookie Pool Displacement, and Rollover Cascade
  const years = {} as Record<LeagueYear, YearCapBreakdown>;
  let currentRollover = baseTeam.initialRollover2026;

  for (const y of LEAGUE_YEARS) {
    const baseLeagueCap = getLeagueCapCeiling(y, capGrowthRate);
    const rolloverFromPriorYear = roundCap(currentRollover);
    const adjustedCapCeiling = roundCap(baseLeagueCap + rolloverFromPriorYear);

    // Gather all active (non-void) player cap hits in year `y`
    const activePlayerHits: { player: Player; hit: number }[] = [];
    for (const p of roster) {
      const cy = p.contractYears[y];
      if (cy && !cy.isVoidYear) {
        activePlayerHits.push({ player: p, hit: getContractYearCapHit(cy) });
      }
    }

    // Sort descending for Top-51 Rule
    activePlayerHits.sort((a, b) => b.hit - a.hit);
    const activeRosterCount = activePlayerHits.length;

    const allRosterCap = roundCap(
      activePlayerHits.reduce((acc, item) => acc + item.hit, 0)
    );

    // Top-51 Rule: take top 51 contracts; if fewer than 51 signed for future years, pad with replacement min
    // so adding a Free Agent or Draft Pick always displaces a minimum slot (true marginal cap accounting).
    const minBaseline = REPLACEMENT_MIN_SALARY_BY_YEAR[y];
    const top51List = activePlayerHits.slice(0, 51).map((x) => x.hit);
    while (top51List.length < 51) {
      top51List.push(minBaseline);
    }

    const activeTop51Cap = roundCap(top51List.reduce((acc, h) => acc + h, 0));
    const replacementLevelCutoff = roundCap(top51List[50] ?? minBaseline);

    // Sum Dead Money for year `y`
    const deadMoneyTotal = roundCap(
      deadCapLedger.reduce((acc, entry) => acc + (entry.amountsByYear[y] ?? 0), 0)
    );

    // Unsigned Draft Picks Rookie Pool Reserve & Net Displacement
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

    // Position Group Spend Allocation
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
      deadMoneyTotal,
      rookiePoolReserve,
      netRookiePoolImpact,
      totalCapCommitments,
      effectiveCapSpace,
      replacementLevelCutoff,
      activeRosterCount,
      topPositionAllocation,
    };

    // Rollover cascade: Unused positive cap space carries forward to next league year
    // (If a team is over the cap in year Y, they cannot roll over negative space, though deficit is highlighted)
    currentRollover = Math.max(0, effectiveCapSpace);
  }

  return {
    teamId: baseTeam.id,
    teamName: `${baseTeam.city} ${baseTeam.name}`,
    capGrowthRate,
    roster,
    deadCapLedger,
    draftPicks,
    years,
  };
}
