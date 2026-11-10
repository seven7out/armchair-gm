'use client';

import React from 'react';
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
import { useGMStore } from '@/store/useGMStore';

export default function ArmchairGMApp() {
  const { activeTab } = useGMStore();

  return (
    <div className="min-h-screen bg-[#f6f3ec] text-[#1c1917] flex flex-col">
      {/* 1. Sticky 4-Year Cap Horizon Header */}
      <CapHorizonHeader />

      {/* 2. Main Workspace View — Organized by Customer Journey */}
      <main className="flex-1 pb-24">
        {activeTab === 'cap-checkup' && <CapCheckupJourney />}
        {activeTab === 'player-fate' && <PlayerFateJourney />}
        {activeTab === 'free-agency' && <FreeAgencySimulatorView />}
        {activeTab === 'draft' && <DraftTradeSandbox />}
        {activeTab === 'matrix' && <RosterMatrix />}
        {activeTab === 'predictor' && <PredictorBacktestLab />}
      </main>

      {/* 3. Interactive Drawers & Modals */}
      <ContractActionDrawer />
      <FreeAgencyModal />
      <ScenarioStackDrawer />
    </div>
  );
}
