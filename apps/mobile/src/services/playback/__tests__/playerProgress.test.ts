import { formatPlaybackClock, shouldShowVodProgress } from '@/services/playback/playerProgress';

describe('playerProgress', () => {
  it('formats clocks for VOD scrubber', () => {
    expect(formatPlaybackClock(0)).toBe('0:00');
    expect(formatPlaybackClock(65)).toBe('1:05');
    expect(formatPlaybackClock(3723)).toBe('1:02:03');
  });

  it('shows progress only for movie and series — never live/radio', () => {
    expect(shouldShowVodProgress('movie')).toBe(true);
    expect(shouldShowVodProgress('series')).toBe(true);
    expect(shouldShowVodProgress('live')).toBe(false);
    expect(shouldShowVodProgress('radio')).toBe(false);
    expect(shouldShowVodProgress(undefined)).toBe(false);
  });
});
