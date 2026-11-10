'use client';

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import {
  JARGON_TRANSLATIONS,
  JargonTermKey,
  JargonTranslation,
} from '@/engine/jargonTooltips';

interface JargonTipProps {
  term: JargonTermKey;
  children?: React.ReactNode;
  showPlainSub?: boolean;
}

/**
 * Inline, non-intimidating plain-English cap tooltip.
 * Shows official term + plain-English translation + metaphor on hover/focus.
 */
export function JargonTip({
  term,
  children,
  showPlainSub = false,
}: JargonTipProps) {
  const entry = JARGON_TRANSLATIONS[term];
  if (!entry) return <>{children}</>;

  return (
    <span className="group/jargon relative inline-flex items-baseline gap-1 cursor-help border-b border-dotted border-[#8a8379]">
      <span>{children ?? entry.officialTerm}</span>
      {showPlainSub && (
        <span className="text-[10px] font-normal text-[#8a8379]">
          ({entry.plainLabel})
        </span>
      )}
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover/jargon:visible group-hover/jargon:opacity-100 group-focus-within/jargon:visible group-focus-within/jargon:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 border border-[#1c1917] bg-[#1c1917] p-2.5 text-left text-[11px] font-normal normal-case tracking-normal text-[#f6f3ec] shadow-xl"
      >
        <span className="block font-semibold text-[#f6f3ec]">
          {entry.plainLabel}
        </span>
        <span className="mt-0.5 block text-[10px] text-[#c7bfb0]">
          {entry.officialTerm} · Metaphor: {entry.metaphor}
        </span>
        <span className="mt-1 block leading-snug text-[#f6f3ec]/90">
          {entry.tooltip}
        </span>
      </span>
    </span>
  );
}

/**
 * Header button + modal showing all 27 Plain-English Jargon Translations from our research.
 */
export function JargonDecoderButton() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const allEntries: JargonTranslation[] = Object.values(JARGON_TRANSLATIONS);
  const filtered = allEntries.filter(
    (e) =>
      filter.trim() === '' ||
      e.officialTerm.toLowerCase().includes(filter.toLowerCase()) ||
      e.plainLabel.toLowerCase().includes(filter.toLowerCase()) ||
      e.tooltip.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Plain-English NFL Cap Decoder (27 Terms Explained)"
        className="hidden xl:flex items-center gap-1 border border-[#c7bfb0] bg-[#fcfaf6] px-2.5 py-1 text-[11px] text-[#57534e] hover:border-[#1c1917] hover:text-[#1c1917] transition-colors cursor-pointer"
      >
        <HelpCircle className="h-3 w-3" />
        <span>Plain-English Cap Guide</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1917]/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-hidden border border-[#1c1917] bg-[#f6f3ec] text-[#1c1917] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dfd9cc] px-6 py-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8379]">
                  No-Jargon Front Office Reference
                </div>
                <h2 className="font-editorial text-2xl text-[#1c1917]">
                  27 NFL Cap &amp; Contract Terms Translated to Plain English
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-[#8a8379] hover:text-[#1c1917] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-[#dfd9cc] bg-[#fcfaf6] px-6 py-3 flex items-center justify-between gap-4">
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search any cap term (e.g., Void Years, Top-51, Post-June 1, Comp Pick)..."
                className="w-full border-b border-[#c7bfb0] bg-transparent py-1 text-xs text-[#1c1917] placeholder-[#8a8379] focus:border-[#1c1917] focus:outline-none"
              />
              <span className="font-mono-ledger text-[11px] text-[#8a8379] shrink-0">
                {filtered.length} terms
              </span>
            </div>

            <div className="overflow-y-auto p-6">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b-2 border-[#1c1917] text-[10px] uppercase tracking-[0.12em] text-[#57534e]">
                  <tr>
                    <th className="py-2 pr-4">Official CBA Term</th>
                    <th className="py-2 px-4">Plain-English Label</th>
                    <th className="py-2 px-4">Mental Model</th>
                    <th className="py-2 pl-4">How It Actually Works</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfd9cc]">
                  {filtered.map((item) => (
                    <tr key={item.key} className="hover:bg-[#fcfaf6]">
                      <td className="py-2.5 pr-4 font-semibold text-[#1c1917] whitespace-nowrap">
                        {item.officialTerm}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[#2d5a43] whitespace-nowrap">
                        {item.plainLabel}
                      </td>
                      <td className="py-2.5 px-4 font-mono-ledger text-[11px] text-[#8a8379] whitespace-nowrap">
                        {item.metaphor}
                      </td>
                      <td className="py-2.5 pl-4 text-[#57534e] leading-snug">
                        {item.tooltip}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
