import { create } from 'zustand';
import { fetchSubscriptionStatus, type SubscriptionViewStatus } from '@/services/subscription/subscriptionStatus';

interface SubscriptionState {
  status: SubscriptionViewStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  status: null,
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await fetchSubscriptionStatus();
      set({ status, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de récupérer votre abonnement.';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clear: () => set({ status: null, isLoading: false, error: null }),
}));
