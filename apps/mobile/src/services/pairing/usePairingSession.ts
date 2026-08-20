import { useCallback, useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import {
  formatPairingCode,
  pairingPageUrl,
  startPairing,
  type StartPairingResponse,
} from '@/services/pairing/pairingApi';

export interface PairingSession {
  code: string;
  displayCode: string;
  qrUrl: string;
  expiresAt: Date;
  secondsRemaining: number;
}

function deviceLabel(): string {
  const name = Device.deviceName?.trim();
  if (name) return name.slice(0, 60);
  return 'Infiny Stream';
}

function devicePlatform(): 'android' | 'android_tv' | 'ios' | 'web' {
  if (Device.osName === 'iOS') return 'ios';
  if (Device.osName === 'Android') {
    // TV devices report a large form factor; fall back to phone when unknown.
    if (Device.deviceType === Device.DeviceType?.TV) return 'android_tv';
    return 'android';
  }
  return 'web';
}

export function usePairingSession(): {
  session: PairingSession | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => void;
} {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const secretRef = useRef<string | null>(null);
  const expiresRef = useRef<Date | null>(null);

  const applyResponse = useCallback((res: StartPairingResponse) => {
    const expiresAt = new Date(res.expiresAt);
    secretRef.current = res.deviceSecret;
    expiresRef.current = expiresAt;
    setSession({
      code: res.code,
      displayCode: formatPairingCode(res.code),
      qrUrl: pairingPageUrl(res.code),
      expiresAt,
      secondsRemaining: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    });
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await startPairing(deviceLabel(), devicePlatform());
      applyResponse(res);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de générer un code.';
      setError(message);
      setSession(null);
      secretRef.current = null;
      expiresRef.current = null;
    } finally {
      setRefreshing(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const expiresAt = expiresRef.current;
    if (!expiresAt) return;

    const secondsRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    setSession((prev) => (prev ? { ...prev, secondsRemaining } : prev));

    if (secondsRemaining <= 0) {
      void refresh();
    }
  }, [tick, refresh]);

  return { session, error, refreshing, refresh };
}
