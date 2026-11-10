'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, CheckSquare, Copy, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { LEAGUE_YEARS } from '@/engine';
import { useGMStore } from '@/store/useGMStore';

export function ScenarioStackDrawer() {
  const {
    transactions,
    derivedState,
    isScenarioDrawerOpen,
    setScenarioDrawerOpen,
    toggleTransaction,
    removeTransaction,
    resetScenarioStack,
  } = useGMStore();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedReddit, setCopiedReddit] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isScenarioDrawerOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isScenarioDrawerOpen]);

  // Deterministic GM Offseason Grade (Cannot be gamed by kicking the can too far)
  const space26 = derivedState.years[2026].effectiveCapSpace;
  const space27 = derivedState.years[2027].effectiveCapSpace;
  const dead27 = derivedState.years[2027].deadMoneyTotal;
  const compCount = derivedState.compPickSummary.netProjectedCompPicks.length;

  let gmGrade = 'B+';
  let gmGradeRationale = 'Cap-compliant 2026–2027 books with balanced long-term risk.';
  if (space26 < 0) {
    gmGrade = 'D';
    gmGradeRationale = `Still $${Math.abs(space26).toFixed(1)}M OVER the 2026 salary cap ceiling.`;
  } else if (space27 < -10) {
    gmGrade = 'C';
    gmGradeRationale = `Compliant in 2026, but kicked too much dead money into 2027 (-$${Math.abs(space27).toFixed(1)}M).`;
  } else if (space26 >= 8 && space27 >= 15 && dead27 < 25 && compCount >= 1) {
    gmGrade = 'A';
    gmGradeRationale = `Healthy 2026–2027 cap flexibility, low 2027 dead money ($${dead27.toFixed(1)}M), and ${compCount} Comp Pick(s) preserved.`;
  } else if (space26 >= 4 && space27 >= 5) {
    gmGrade = 'A-';
    gmGradeRationale = `Clean 2-year cap horizon (+$${space26.toFixed(1)}M in '26, +$${space27.toFixed(1)}M in '27).`;
  }

  const handleCopyOffseasonReceipt = () => {
    const enabled = transactions.filter((t) => t.enabled);
    const lines = [
      `ARMCHAIR GM — ${derivedState.teamName.toUpperCase()} OFFSEASON LEDGER (GM GRADE: ${gmGrade})`,
      `====================================================`,
      ...LEAGUE_YEARS.map((yr) => {
        const s = derivedState.years[yr].effectiveCapSpace;
        return `${yr} Spendable Now: ${s >= 0 ? '+$' : '-$'}${Math.abs(s).toFixed(2)}M (Active Top-51: $${derivedState.years[yr].activeTop51Cap.toFixed(1)}M | Dead: $${derivedState.years[yr].deadMoneyTotal.toFixed(1)}M)`;
      }),
      `----------------------------------------------------`,
      `Moves Recorded (${enabled.length}):`,
      ...enabled.map((tx, i) => `${i + 1}. ${tx.label} — ${tx.sublabel}`),
      `----------------------------------------------------`,
      `2027 Projected Comp Picks: ${derivedState.compPickSummary.netProjectedCompPicks.join(', ') || 'None'}`,
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const handleCopyRedditMarkdown = () => {
    const enabled = transactions.filter((t) => t.enabled);
    const mdLines = [
      `### Realistic 2026 ${derivedState.teamName} Offseason Plan (GM Grade: **${gmGrade}**)`,
      `*${gmGradeRationale}*`,
      ``,
      `#### 4-Year Cap Horizon`,
      `| Year | Spendable Space | Top-51 Active | Dead Money | Net Rookie Pool |`,
      `| :--- | :---: | :---: | :---: | :---: |`,
      ...LEAGUE_YEARS.map((yr) => {
        const y = derivedState.years[yr];
        const s = `${y.effectiveCapSpace >= 0 ? '+$' : '-$'}${Math.abs(y.effectiveCapSpace).toFixed(2)}M`;
        return `| **${yr}** | **${s}** | $${y.activeTop51Cap.toFixed(1)}M | $${y.deadMoneyTotal.toFixed(1)}M | -$${y.netRookiePoolImpact.toFixed(2)}M |`;
      }),
      ``,
      `#### Recorded Front-Office Moves (${enabled.length})`,
      `| # | Transaction | Details & Multi-Year Impact | 2026 Cap Delta |`,
      `| :---: | :--- | :--- | :---: |`,
      ...enabled.map((tx, i) => {
        const d =
          tx.capDelta2026 === 0
            ? '—'
            : `${tx.capDelta2026 > 0 ? '+$' : '-$'}${Math.abs(tx.capDelta2026).toFixed(2)}M`;
        return `| ${i + 1} | **${tx.label}** | ${tx.sublabel} | ${d} |`;
      }),
      ``,
      `**2027 Projected Comp Picks:** ${derivedState.compPickSummary.netProjectedCompPicks.join(', ') || 'None'} (${derivedState.compPickSummary.streetFASigningsCount} Comp-Pick-Safe Street FAs signed)`,
    ];
    navigator.clipboard?.writeText(mdLines.join('\n'));
    setCopiedReddit(true);
    setTimeout(() => setCopiedReddit(false), 2500);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      onClose={() => setScenarioDrawerOpen(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) setScenarioDrawerOpen(false);
      }}
      className="ml-auto mr-0 my-0 h-dvh max-h-dvh w-full max-w-md border-l border-[#1c1917] bg-[#f6f3ec] p-0 text-[#1c1917] shadow-2xl backdrop:bg-[#1c1917]/25"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfd9cc] px-6 py-5">
          <div>
            <h2 id={titleId} className="font-editorial text-xl text-[#1c1917]">
              Front-Office Moves Notebook
            </h2>
            <p className="text-xs text-[#8a8379]">
              Toggle individual transactions on or off to compare 4-year horizons
            </p>
          </div>

          <button
            type="button"
            onClick={() => setScenarioDrawerOpen(false)}
            aria-label="Close Moves Notebook"
            className="p-1 text-[#8a8379] hover:text-[#1c1917] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live 4-Year Cap Strip */}
        <div className="grid grid-cols-4 divide-x divide-[#dfd9cc] border-b border-[#dfd9cc] bg-[#ede8dd]/50 py-3 text-center">
          {LEAGUE_YEARS.map((yr) => {
            const space = derivedState.years[yr].effectiveCapSpace;
            return (
              <div key={yr} className="px-2">
                <div className="font-mono-ledger text-[10px] text-[#8a8379]">
                  {yr}
                </div>
                <div
                  className={`font-mono-ledger text-xs font-semibold ${
                    space < 0 ? 'text-[#b84a27]' : 'text-[#2d5a43]'
                  }`}
                >
                  {space < 0 ? '−$' : '+$'}
                  {Math.abs(space).toFixed(1)}M
                </div>
              </div>
            );
          })}
        </div>

        {/* Comp Pick, Post-June 1 & GM Plan Grade Status Bar */}
        <div className="border-b border-[#dfd9cc] bg-[#fcfaf6] px-6 py-3 space-y-2 text-[11px]">
          <div className="flex items-center justify-between font-mono-ledger text-[#57534e]">
            <span>
              2027 Comp Picks:{' '}
              <strong className="text-[#2d5a43]">
                {derivedState.compPickSummary.netProjectedCompPicks.length}
              </strong>{' '}
              ({derivedState.compPickSummary.streetFASigningsCount} Street FAs signed)
            </span>
            <span>
              Post-6/1 Used: {derivedState.compPickSummary.postJune1DesignationsUsed}/2
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-[#dfd9cc] pt-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8379]">
                Offseason Plan Grade
              </span>
              <p className="text-[11px] text-[#57534e]">{gmGradeRationale}</p>
            </div>
            <span
              className={`ml-3 shrink-0 border px-2.5 py-1 font-editorial text-lg font-semibold ${
                gmGrade.startsWith('A')
                  ? 'border-[#2d5a43] text-[#2d5a43]'
                  : gmGrade.startsWith('B')
                  ? 'border-[#1c1917] text-[#1c1917]'
                  : 'border-[#b84a27] text-[#b84a27]'
              }`}
            >
              {gmGrade}
            </span>
          </div>
        </div>

        {/* Transaction Entries */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#dfd9cc] px-6">
          {transactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-editorial text-base text-[#1c1917]">
                Notebook is empty
              </p>
              <p className="mt-1 text-xs text-[#8a8379]">
                Select any player in the ledger to record a restructure, cut,
                extension, tag, or trade.
              </p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <div
                key={tx.id}
                className={`py-4 transition-opacity ${
                  tx.enabled ? 'opacity-100' : 'opacity-45'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTransaction(tx.id)}
                    className="flex items-start gap-2.5 text-left cursor-pointer"
                  >
                    {tx.enabled ? (
                      <CheckSquare className="h-4 w-4 text-[#1c1917] shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-4 w-4 text-[#8a8379] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-[#1c1917]">
                        0{index + 1}. {tx.label}
                      </div>
                      <div className="mt-0.5 font-mono-ledger text-[11px] text-[#57534e]">
                        {tx.sublabel}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {tx.capDelta2026 !== 0 && (
                      <span
                        className={`font-mono-ledger text-xs font-semibold ${
                          tx.capDelta2026 > 0
                            ? 'text-[#2d5a43]'
                            : 'text-[#b84a27]'
                        }`}
                      >
                        {tx.capDelta2026 > 0 ? '+$' : '−$'}
                        {Math.abs(tx.capDelta2026).toFixed(1)}M
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTransaction(tx.id)}
                      aria-label={`Remove ${tx.label}`}
                      className="p-1 text-[#8a8379] hover:text-[#b84a27] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {transactions.length > 0 && (
          <div className="border-t border-[#dfd9cc] px-6 py-4 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyRedditMarkdown}
                className="flex flex-1 items-center justify-center gap-1.5 bg-[#1c1917] px-3 py-2 font-medium text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
              >
                {copiedReddit ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied Reddit Table!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Reddit Markdown Plan
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyOffseasonReceipt}
                className="flex items-center justify-center gap-1.5 border border-[#1c1917] px-3 py-2 font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
              >
                {copiedReceipt ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Text Receipt
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={resetScenarioStack}
                className="flex items-center gap-1.5 text-[#b84a27] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear All Moves
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
