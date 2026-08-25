jest.mock('@/services/network/NetworkMonitor', () => ({
  NetworkMonitor: {
    reportSample: jest.fn(),
    reportStall: jest.fn(),
    reportTimedDownload: jest.fn(() => false),
    subscribe: jest.fn(() => () => undefined),
  },
}));

import type { VideoPlayer } from 'expo-video';
import { NetworkMonitor } from '@/services/network/NetworkMonitor';
import { PlayerController } from '../PlayerController';

const HLS_MASTER_URL = 'https://example.com/live/master.m3u8';
const DIRECT_TS_URL = 'https://example.com/live/channel.ts';

function createMockPlayer(): VideoPlayer {
  return {
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    bufferOptions: {},
  } as unknown as VideoPlayer;
}

describe('PlayerController (native ABR)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('passes the HLS master URL to the player, not a picked variant', async () => {
    const mockPlayer = createMockPlayer();
    const controller = new PlayerController(mockPlayer);

    await controller.loadChannel(HLS_MASTER_URL);

    expect(mockPlayer.replace).toHaveBeenCalledTimes(2);
    expect(mockPlayer.replace).toHaveBeenNthCalledWith(1, null);
    const source = (mockPlayer.replace as jest.Mock).mock.calls[1][0];
    expect(source.uri).toBe(HLS_MASTER_URL);
    expect(source.contentType).toBe('hls');
    expect(source.headers?.['User-Agent']).toBeDefined();
    expect(NetworkMonitor.reportTimedDownload).not.toHaveBeenCalled();
    expect(NetworkMonitor.reportSample).not.toHaveBeenCalled();

    controller.dispose();
  });

  it('passes a single-rendition URL through unchanged', async () => {
    const mockPlayer = createMockPlayer();
    const controller = new PlayerController(mockPlayer);

    await controller.loadChannel(DIRECT_TS_URL);

    const source = (mockPlayer.replace as jest.Mock).mock.calls[1][0];
    expect(source.uri).toBe(DIRECT_TS_URL);
    expect(source.contentType).toBeUndefined();
    expect(source.headers?.['User-Agent']).toBeDefined();

    controller.dispose();
  });

  it('releases the native source before loading another channel', async () => {
    const mockPlayer = createMockPlayer();
    const controller = new PlayerController(mockPlayer);

    await controller.loadChannel(HLS_MASTER_URL);
    await controller.loadChannel(DIRECT_TS_URL);

    expect(mockPlayer.replace).toHaveBeenCalledTimes(4);
    expect(mockPlayer.replace).toHaveBeenNthCalledWith(3, null);

    controller.dispose();
  });

  it('applies buffer options for the quality mode without retargeting the URL', async () => {
    const mockPlayer = createMockPlayer();
    const controller = new PlayerController(mockPlayer);

    await controller.loadChannel(HLS_MASTER_URL);
    const uriAfterLoad = (mockPlayer.replace as jest.Mock).mock.calls[1][0].uri;

    controller.setMode('economy');
    expect(mockPlayer.bufferOptions).toMatchObject({
      preferredForwardBufferDuration: 20,
      minBufferForPlayback: 6,
      prioritizeTimeOverSizeThreshold: true,
    });
    expect((mockPlayer.replace as jest.Mock).mock.calls.length).toBe(2);
    expect(uriAfterLoad).toBe(HLS_MASTER_URL);

    controller.dispose();
  });

  it('does not throw when setMode is called before loadChannel', () => {
    const controller = new PlayerController(createMockPlayer());
    expect(() => controller.setMode('balanced')).not.toThrow();
    controller.dispose();
  });
});
