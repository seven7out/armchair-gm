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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isScenarioDrawerOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isScenarioDrawerOpen]);

  const handleCopyOffseasonReceipt = () => {
    const enabled = transactions.filter((t) => t.enabled);
    const lines = [
      `ARMCHAIR GM — ${derivedState.teamName.toUpperCase()} OFFSEASON LEDGER`,
      `====================================================`,
      ...LEAGUE_YEARS.map((yr) => {
        const s = derivedState.years[yr].effectiveCapSpace;
        return `${yr} Effective Cap Space: ${s >= 0 ? '+$' : '-$'}${Math.abs(s).toFixed(2)}M (Active: $${derivedState.years[yr].activeTop51Cap.toFixed(1)}M | Dead: $${derivedState.years[yr].deadMoneyTotal.toFixed(1)}M)`;
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

        {/* Comp Pick & Post-June 1 Status Bar */}
        <div className="border-b border-[#dfd9cc] bg-[#fcfaf6] px-6 py-2.5 text-[11px] font-mono-ledger flex items-center justify-between text-[#57534e]">
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
          <div className="border-t border-[#dfd9cc] px-6 py-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleCopyOffseasonReceipt}
              className="flex items-center gap-1.5 border border-[#1c1917] px-3 py-1.5 font-medium text-[#1c1917] hover:bg-[#1c1917] hover:text-[#f6f3ec] transition-colors cursor-pointer"
            >
              {copiedReceipt ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied Offseason Receipt
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Shareable Receipt
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetScenarioStack}
              className="flex items-center gap-1.5 text-[#b84a27] hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear All
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
