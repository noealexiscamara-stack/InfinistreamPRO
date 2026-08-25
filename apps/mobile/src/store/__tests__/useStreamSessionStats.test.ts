import { useStreamSessionStats } from '@/store/useStreamSessionStats';

describe('useStreamSessionStats', () => {
  beforeEach(() => {
    useStreamSessionStats.getState().reset();
  });

  it('tracks open / release / active balance', () => {
    useStreamSessionStats.getState().recordOpen('http://a/1.m3u8');
    expect(useStreamSessionStats.getState()).toMatchObject({ opened: 1, released: 0, active: 1 });

    useStreamSessionStats.getState().recordRelease('zap', 'http://a/1.m3u8');
    useStreamSessionStats.getState().recordOpen('http://a/2.m3u8');
    expect(useStreamSessionStats.getState()).toMatchObject({ opened: 2, released: 1, active: 1 });
  });

  it('flags when active would exceed one after two opens without release', () => {
    useStreamSessionStats.getState().recordOpen('http://a/1.m3u8');
    useStreamSessionStats.getState().recordOpen('http://a/2.m3u8');
    expect(useStreamSessionStats.getState().active).toBe(2);
  });
});
