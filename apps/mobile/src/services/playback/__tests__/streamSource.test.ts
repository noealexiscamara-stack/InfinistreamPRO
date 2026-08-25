import {
  buildStreamVideoSource,
  alternateLiveStreamUrl,
  ensureVodContainerExtension,
  isLikelyHls,
  maskStreamCredentials,
} from '@/services/playback/streamSource';
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

  it('also sends VLC User-Agent on progressive VOD sources', () => {
    const source = buildStreamVideoSource('http://x/movie/u/p/42.mkv') as {
      contentType?: string;
      headers?: Record<string, string>;
    };
    expect(source.contentType).toBeUndefined();
    expect(source.headers?.['User-Agent']).toBe(IPTV_CLIENT_USER_AGENT);
  });

  it('alternates between m3u8 and ts live URLs only', () => {
    expect(alternateLiveStreamUrl('http://x/live/u/p/1.m3u8')).toBe('http://x/live/u/p/1.ts');
    expect(alternateLiveStreamUrl('http://x/live/u/p/1.ts')).toBe('http://x/live/u/p/1.m3u8');
    expect(alternateLiveStreamUrl('http://x/movie/u/p/1.mkv')).toBeNull();
    expect(alternateLiveStreamUrl('http://x/movie/u/p/1.m3u8')).toBeNull();
  });

  it('masks credentials in logged URLs', () => {
    expect(maskStreamCredentials('http://host:8080/movie/alice/secret/99.mkv')).toBe(
      'http://host:8080/movie/***/***/99.mkv'
    );
  });

  it('repairs VOD URLs that wrongly use live extensions', () => {
    expect(ensureVodContainerExtension('http://h/movie/u/p/9.m3u8', 'mkv')).toBe(
      'http://h/movie/u/p/9.mkv'
    );
    expect(ensureVodContainerExtension('http://h/movie/u/p/9', 'mp4')).toBe('http://h/movie/u/p/9.mp4');
    expect(ensureVodContainerExtension('http://h/movie/u/p/9.mkv', 'mkv')).toBe(
      'http://h/movie/u/p/9.mkv'
    );
  });
});
