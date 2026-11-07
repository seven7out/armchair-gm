'use client';

import React, { useEffect, useId, useRef } from 'react';
import {
  CheckSquare,
  Layers,
  RotateCcw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isScenarioDrawerOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isScenarioDrawerOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      onClose={() => setScenarioDrawerOpen(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) setScenarioDrawerOpen(false);
      }}
      className="ml-auto mr-0 my-0 h-dvh max-h-dvh w-full max-w-md border-l border-slate-800 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 id={titleId} className="text-base font-bold text-white">
                GM Scenario Stack
              </h2>
              <p className="text-[11px] text-slate-400">
                Toggle individual moves on/off to compare 4-year cap ripples
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScenarioDrawerOpen(false)}
            aria-label="Close Scenario Stack"
            className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live 4-Year Effective Cap Summary Strip inside Drawer */}
        <div className="grid grid-cols-4 gap-1.5 border-b border-slate-800 bg-slate-900/50 p-3 text-center">
          {LEAGUE_YEARS.map((yr) => {
            const space = derivedState.years[yr].effectiveCapSpace;
            return (
              <div
                key={yr}
                className="rounded-lg border border-slate-800 bg-slate-950 p-2"
              >
                <div className="text-[10px] font-bold text-slate-400">{yr}</div>
                <div
                  className={`font-mono text-xs font-black ${
                    space < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {space < 0 ? '' : '+'}${space.toFixed(1)}M
                </div>
              </div>
            );
          })}
        </div>

        {/* Transaction Stack List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
              <p className="text-xs font-semibold text-slate-300">
                No Simulated Front-Office Moves Yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Click any player in the Roster Matrix to test a Pre/Post-June 1
                Cut, Restructure, Extension, or Trade—or sign a Free Agent.
              </p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <div
                key={tx.id}
                className={`rounded-xl border p-3.5 transition ${
                  tx.enabled
                    ? 'border-indigo-500/40 bg-slate-900/90'
                    : 'border-slate-800/70 bg-slate-950/50 opacity-55'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleTransaction(tx.id)}
                    className="flex items-start gap-2.5 text-left"
                  >
                    {tx.enabled ? (
                      <CheckSquare className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-white">
                        #{index + 1}. {tx.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {tx.sublabel}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {tx.capDelta2026 !== 0 && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          tx.capDelta2026 > 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {tx.capDelta2026 > 0 ? '+' : ''}$
                        {tx.capDelta2026.toFixed(1)}M
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTransaction(tx.id)}
                      aria-label={`Remove ${tx.label}`}
                      className="rounded p-1 text-slate-500 hover:bg-rose-950/50 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {transactions.length > 0 && (
          <div className="border-t border-slate-800 bg-slate-900/80 p-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {transactions.filter((t) => t.enabled).length} of{' '}
              {transactions.length} moves active
            </span>
            <button
              type="button"
              onClick={resetScenarioStack}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear All Moves
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
