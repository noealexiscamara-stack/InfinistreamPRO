import { buildStreamVideoSource, alternateLiveStreamUrl, isLikelyHls } from '@/services/playback/streamSource';
import { IPTV_CLIENT_USER_AGENT } from '@infiny-stream/shared';

describe('streamSource', () => {
  it('detects HLS URLs', () => {
    expect(isLikelyHls('http://x/live/1.m3u8')).toBe(true);
    expect(isLikelyHls('http://x/live/1.ts')).toBe(false);
  });

  it('attaches IPTV User-Agent headers to playback sources', () => {
    const source = buildStreamVideoSource('http://x/live/1.m3u8');
    expect(source).toMatchObject({
      uri: 'http://x/live/1.m3u8',
      contentType: 'hls',
      headers: {
        'User-Agent': IPTV_CLIENT_USER_AGENT,
        Accept: '*/*',
      },
    });
  });

  it('alternates between m3u8 and ts live URLs', () => {
    expect(alternateLiveStreamUrl('http://x/live/u/p/1.m3u8')).toBe('http://x/live/u/p/1.ts');
    expect(alternateLiveStreamUrl('http://x/live/u/p/1.ts')).toBe('http://x/live/u/p/1.m3u8');
  });
});
