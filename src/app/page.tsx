'use client';

import React from 'react';
import { CapHorizonHeader } from '@/components/CapHorizonHeader';
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

      {/* 2. Main Workspace View */}
      <main className="flex-1 pb-24">
        {activeTab === 'matrix' && <RosterMatrix />}
        {activeTab === 'predictor' && <PredictorBacktestLab />}
        {activeTab === 'draft' && <DraftTradeSandbox />}
        {activeTab === 'free-agency' && <FreeAgencySimulatorView />}
      </main>

      {/* 3. Interactive Drawers & Modals */}
      <ContractActionDrawer />
      <FreeAgencyModal />
      <ScenarioStackDrawer />
    </div>
  );
}
