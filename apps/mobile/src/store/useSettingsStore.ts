import { create } from 'zustand';
import type { QualityMode } from '@infiny-stream/types';
import { storage } from '@/utils/mmkv';

const KEYS = {
  onboardingComplete: 'settings.onboardingComplete',
  qualityMode: 'settings.qualityMode',
  lowBandwidthMode: 'settings.lowBandwidthMode',
};

interface SettingsState {
  onboardingComplete: boolean;
  qualityMode: QualityMode;
  /** Product rule #26 — reduces animation/effects and biases toward stability when enabled. */
  lowBandwidthMode: boolean;
  completeOnboarding: () => void;
  setQualityMode: (mode: QualityMode) => void;
  setLowBandwidthMode: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  onboardingComplete: storage.getBoolean(KEYS.onboardingComplete) ?? false,
  qualityMode: (storage.getString(KEYS.qualityMode) as QualityMode) ?? 'auto',
  lowBandwidthMode: storage.getBoolean(KEYS.lowBandwidthMode) ?? false,

  completeOnboarding: () => {
    storage.set(KEYS.onboardingComplete, true);
    set({ onboardingComplete: true });
  },

  setQualityMode: (mode) => {
    storage.set(KEYS.qualityMode, mode);
    set({ qualityMode: mode });
  },

  setLowBandwidthMode: (enabled) => {
    storage.set(KEYS.lowBandwidthMode, enabled);
    set({ lowBandwidthMode: enabled });
  },
}));
