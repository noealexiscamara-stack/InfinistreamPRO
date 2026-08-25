import { create } from 'zustand';
import {
  clearParentalPin,
  hasParentalPin,
  lockoutRemainingMs,
  readLockout,
  setParentalPin,
  verifyParentalPin,
  type VerifyPinResult,
} from '@/services/parental/parentalPin';

interface ParentalState {
  /** True once SecureStore has a hashed PIN record. */
  pinConfigured: boolean;
  /** Session unlock — resets when the app process dies. Default: false (adult hidden). */
  unlocked: boolean;
  lockoutUntil: number;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  createPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<VerifyPinResult>;
  lock: () => void;
  removePin: () => Promise<void>;
  /** Adult rows may be shown only when a PIN exists AND the session is unlocked. */
  includeAdult: () => boolean;
}

export const useParentalStore = create<ParentalState>((set, get) => ({
  pinConfigured: false,
  unlocked: false,
  lockoutUntil: 0,
  hydrated: false,

  hydrate: async () => {
    const configured = await hasParentalPin();
    const lockout = await readLockout();
    const remaining = lockoutRemainingMs(lockout);
    if (remaining > 0) {
      console.log(
        `[Parental] lockout still active on boot remainingMs=${remaining} failedInSeries=${lockout.failedInSeries} lockoutSeries=${lockout.lockoutSeries}`
      );
    } else if (lockout.failedInSeries > 0) {
      console.log(`[Parental] restoring failed attempt counter=${lockout.failedInSeries}`);
    }
    set({
      pinConfigured: configured,
      unlocked: false,
      lockoutUntil: lockout.lockedUntil,
      hydrated: true,
    });
  },

  createPin: async (pin) => {
    await setParentalPin(pin);
    set({ pinConfigured: true, unlocked: false, lockoutUntil: 0 });
  },

  unlock: async (pin) => {
    const result = await verifyParentalPin(pin);
    if (result.ok) {
      set({ unlocked: true, lockoutUntil: 0 });
      return result;
    }
    if (result.reason === 'locked' && result.lockedMs != null) {
      set({ unlocked: false, lockoutUntil: Date.now() + result.lockedMs });
    } else {
      const lockout = await readLockout();
      set({ unlocked: false, lockoutUntil: lockout.lockedUntil });
    }
    return result;
  },

  lock: () => set({ unlocked: false }),

  removePin: async () => {
    await clearParentalPin();
    set({ pinConfigured: false, unlocked: false, lockoutUntil: 0 });
  },

  includeAdult: () => {
    const { pinConfigured, unlocked } = get();
    return pinConfigured && unlocked;
  },
}));

export function parentalLockoutLabel(lockoutUntil: number, now = Date.now()): string | null {
  const ms = Math.max(0, lockoutUntil - now);
  if (ms <= 0) return null;
  const sec = Math.ceil(ms / 1000);
  return `Réessayez dans ${sec} s`;
}

export { lockoutRemainingMs };
