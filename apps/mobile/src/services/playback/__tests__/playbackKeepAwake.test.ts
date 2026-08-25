import {
  activatePlaybackKeepAwake,
  deactivatePlaybackKeepAwake,
  forceDeactivatePlaybackKeepAwake,
  isPlaybackKeepAwakeActive,
  PLAYBACK_KEEP_AWAKE_TAG,
} from '@/services/playback/playbackKeepAwake';

const activateMock = jest.fn(async () => undefined);
const deactivateMock = jest.fn();

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag: string) => activateMock(tag),
  deactivateKeepAwake: (tag: string) => deactivateMock(tag),
}));

describe('playbackKeepAwake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    forceDeactivatePlaybackKeepAwake();
  });

  it('activates with the playback tag once', async () => {
    await activatePlaybackKeepAwake();
    await activatePlaybackKeepAwake();
    expect(activateMock).toHaveBeenCalledTimes(1);
    expect(activateMock).toHaveBeenCalledWith(PLAYBACK_KEEP_AWAKE_TAG);
    expect(isPlaybackKeepAwakeActive()).toBe(true);
  });

  it('deactivates on pause/stop paths', async () => {
    await activatePlaybackKeepAwake();
    deactivatePlaybackKeepAwake();
    expect(deactivateMock).toHaveBeenCalledWith(PLAYBACK_KEEP_AWAKE_TAG);
    expect(isPlaybackKeepAwakeActive()).toBe(false);
  });

  it('forceDeactivate is safe when never activated (crash cleanup)', () => {
    forceDeactivatePlaybackKeepAwake();
    expect(deactivateMock).toHaveBeenCalledWith(PLAYBACK_KEEP_AWAKE_TAG);
    expect(isPlaybackKeepAwakeActive()).toBe(false);
  });
});
