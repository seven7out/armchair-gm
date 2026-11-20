'use client';

import React, { useEffect } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { CapHorizonHeader } from '@/components/CapHorizonHeader';
import { CapCheckupJourney } from '@/components/CapCheckupJourney';
import { PlayerFateJourney } from '@/components/PlayerFateJourney';
import { RosterMatrix } from '@/components/RosterMatrix';
import { ContractActionDrawer } from '@/components/ContractActionDrawer';
import { DraftTradeSandbox } from '@/components/DraftTradeSandbox';
import {
  FreeAgencyModal,
  FreeAgencySimulatorView,
} from '@/components/FreeAgencyModal';
import { ScenarioStackDrawer } from '@/components/ScenarioStackDrawer';
import { PredictorBacktestLab } from '@/components/PredictorBacktestLab';
import { PlayerDossierModal } from '@/components/PlayerDossierModal';
import { ActiveTab, useGMStore } from '@/store/useGMStore';

const JOURNEY_LABELS: Record<ActiveTab, string> = {
  'player-fate': 'Roster Grid & Needs',
  'team-builder': 'Team Builder',
  'cap-checkup': 'Cap Fixes',
  'free-agency': 'Free Agents',
  draft: 'Trades & Draft',
  matrix: '4-Year Cap Ledger',
  predictor: 'FA Predictor & Backtest',
};

export default function ArmchairGMApp() {
  const {
    activeTab,
    appMode,
    navHistory,
    goBack,
    goHome,
  } = useGMStore();

  // Hydrate shared scenario URL (?team=DET&s=...) on initial load + support native Back/Forward
  useEffect(() => {
    if (window.location.search) {
      useGMStore.getState().hydrateScenarioFromUrlSearch(window.location.search);
    }
    const handlePopState = (event: PopStateEvent) => {
      const targetTab = (event.state?.tab as ActiveTab) || 'team-builder';
      useGMStore.setState({ activeTab: targetTab });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const previousTabLabel =
    navHistory.length > 0
      ? JOURNEY_LABELS[navHistory[navHistory.length - 1]]
      : 'Home Roster Grid';

  return (
    <div className="min-h-dvh bg-[#f6f3ec] text-[#1c1917] flex flex-col">
      {/* 1. Sticky 4-Year Cap Horizon Header */}
      <CapHorizonHeader />

      {/* 2. Compact Back / Home Bar when inside deep standalone sub-views */}
      {activeTab !== 'player-fate' && activeTab !== 'team-builder' && (
        <div className="border-b border-[#dfd9cc] bg-[#ede8dd]">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 border border-[#1c1917] bg-[#1c1917] px-3 py-1 font-semibold text-[#f6f3ec] hover:bg-[#332e2a] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={goHome}
                className="inline-flex items-center gap-1.5 border border-[#1c1917] bg-[#fcfaf6] px-3 py-1 font-semibold text-[#1c1917] hover:bg-[#f6f3ec] transition-colors cursor-pointer"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Return to Home Roster Grid &amp; Needs</span>
              </button>

              <span className="hidden md:inline text-[#8a8379] pl-2">
                Previous: {previousTabLabel}
              </span>
            </div>

            <div className="font-mono-ledger text-[11px] font-semibold text-[#57534e]">
              Viewing: <span className="text-[#1c1917]">{JOURNEY_LABELS[activeTab]}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace View — Organized by Customer Journey */}
      <main className="flex-1 pb-24">
        {activeTab === 'cap-checkup' && <CapCheckupJourney />}
        {(activeTab === 'player-fate' || activeTab === 'team-builder') && (
          <PlayerFateJourney
            mode={appMode === 'CONTRACT_EXPLORER' ? 'CURRENT_STATE' : 'TEAM_BUILDER'}
          />
        )}
        {activeTab === 'free-agency' && <FreeAgencySimulatorView />}
        {activeTab === 'draft' && <DraftTradeSandbox />}
        {activeTab === 'matrix' && <RosterMatrix />}
        {activeTab === 'predictor' && <PredictorBacktestLab />}
      </main>

      {/* 4. Interactive Drawers & Modals */}
      <ContractActionDrawer />
      <FreeAgencyModal />
      <ScenarioStackDrawer />
      <PlayerDossierModal />
    </div>
  );
}
