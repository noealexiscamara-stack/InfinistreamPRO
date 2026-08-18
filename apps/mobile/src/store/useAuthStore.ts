import { create } from 'zustand';
import type { User } from '@infiny-stream/types';
import { loginRequest, registerRequest, type RegisterInput } from '@/services/auth/authApi';
import { clearSession, getAccessToken, getStoredEmail, saveSession } from '@/services/auth/tokenStorage';
import { fetchCurrentUser } from '@/services/users/usersApi';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';

interface AuthState {
  accessToken: string | null;
  email: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

async function loadAuthenticatedSession(
  accessToken: string,
  email: string | null
): Promise<{ email: string | null; user: User | null }> {
  try {
    const user = await fetchCurrentUser();
    return { email: user.email ?? email, user };
  } catch {
    return { email, user: null };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  email: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,

  hydrate: async () => {
    const [accessToken, email] = await Promise.all([getAccessToken(), getStoredEmail()]);
    const isAuthenticated = Boolean(accessToken);

    if (!isAuthenticated) {
      set({ accessToken: null, email: null, user: null, isAuthenticated: false, isHydrated: true });
      return;
    }

    const session = await loadAuthenticatedSession(accessToken!, email);
    set({
      accessToken,
      email: session.email,
      user: session.user,
      isAuthenticated: true,
      isHydrated: true,
    });

    await useSubscriptionStore.getState().refresh().catch(() => undefined);
  },

  refreshProfile: async () => {
    if (!get().isAuthenticated) return;
    const session = await loadAuthenticatedSession(get().accessToken!, get().email);
    set({ email: session.email, user: session.user });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { accessToken } = await loginRequest({ email: normalizedEmail, password });
      await saveSession(accessToken, normalizedEmail);
      const session = await loadAuthenticatedSession(accessToken, normalizedEmail);
      set({
        accessToken,
        email: session.email ?? normalizedEmail,
        user: session.user,
        isAuthenticated: true,
      });
      await useSubscriptionStore.getState().refresh();
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (input) => {
    set({ isLoading: true });
    try {
      const normalizedEmail = input.email.trim().toLowerCase();
      const { accessToken } = await registerRequest({ ...input, email: normalizedEmail });
      await saveSession(accessToken, normalizedEmail);
      const session = await loadAuthenticatedSession(accessToken, normalizedEmail);
      set({
        accessToken,
        email: session.email ?? normalizedEmail,
        user: session.user,
        isAuthenticated: true,
      });
      await useSubscriptionStore.getState().refresh();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await clearSession();
    useSubscriptionStore.getState().clear();
    set({ accessToken: null, email: null, user: null, isAuthenticated: false, isLoading: false });
  },
}));

/** Called by the API client on 401 — avoids importing router here. */
export async function handleUnauthorizedSession(): Promise<void> {
  if (!useAuthStore.getState().isAuthenticated && !useAuthStore.getState().accessToken) {
    return;
  }
  await useAuthStore.getState().logout();
}
