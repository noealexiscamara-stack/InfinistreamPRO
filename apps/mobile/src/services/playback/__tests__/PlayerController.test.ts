jest.mock('@/services/network/NetworkMonitor', () => ({
  NetworkMonitor: {
    reportSample: jest.fn(),
    reportStall: jest.fn(),
  },
}));

import type { VideoPlayer } from 'expo-video';
import { QUALITY_REEVALUATION_INTERVAL_MS } from '@infiny-stream/config';
import { PlayerController } from '../PlayerController';

const HLS_MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240
240.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080.m3u8
`;

function createMockPlayer(): VideoPlayer {
  return {
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
  } as unknown as VideoPlayer;
}

describe('PlayerController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not throw when reevaluation runs without loadChannel', () => {
    const controller = new PlayerController(createMockPlayer());

    expect(() => controller.setMode('balanced')).not.toThrow();

    (controller as unknown as { startReevaluationLoop(): void }).startReevaluationLoop();
    expect(() => jest.advanceTimersByTime(QUALITY_REEVALUATION_INTERVAL_MS * 3)).not.toThrow();

    controller.dispose();
  });

  it('applies economy mode set before loadChannel when playback starts', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(HLS_MASTER),
    } as Response);

    const mockPlayer = createMockPlayer();
    const controller = new PlayerController(mockPlayer);

    controller.setMode('economy');
    expect(controller.getMode()).toBe('economy');

    await controller.loadChannel('https://example.com/live/master.m3u8');

    expect(mockPlayer.replace).toHaveBeenCalled();
    const source = (mockPlayer.replace as jest.Mock).mock.calls[0][0];
    expect(source.uri).toContain('480.m3u8');
    expect(source.uri).not.toMatch(/720|1080/);

    controller.dispose();
  });
});
