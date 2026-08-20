import { apiPost } from '@/services/api/client';
import type { DevicePlatform } from '@infiny-stream/types';

export {
  PAIRING_WEB_ORIGIN,
  PAIRING_PATH,
  formatPairingCode,
  pairingPageUrl,
  pairingHintUrl,
} from './pairingUrls';

export interface StartPairingResponse {
  code: string;
  deviceSecret: string;
  expiresAt: string;
  pollIntervalSeconds: number;
}

export async function startPairing(deviceName: string, platform: DevicePlatform): Promise<StartPairingResponse> {
  return apiPost<StartPairingResponse>('/pairing/start', { deviceName, platform }, true);
}
