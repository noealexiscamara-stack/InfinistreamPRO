import { parseHlsMasterPlaylist } from '../masterPlaylist';

const MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240
240p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/index.m3u8
`;

describe('parseHlsMasterPlaylist', () => {
  it('extracts variants sorted by ascending bitrate with resolved URLs', () => {
    const variants = parseHlsMasterPlaylist(MASTER, 'https://example.com/live/channel/master.m3u8');
    expect(variants).toHaveLength(3);
    expect(variants.map((v) => v.heightLabel)).toEqual([240, 360, 720]);
    expect(variants[0].bitrateKbps).toBe(400);
    expect(variants[0].url).toBe('https://example.com/live/channel/240p/index.m3u8');
  });

  it('returns an empty array for a plain media playlist (no adaptation possible)', () => {
    const media = '#EXTM3U\n#EXTINF:10,\nsegment1.ts\n#EXTINF:10,\nsegment2.ts\n';
    expect(parseHlsMasterPlaylist(media, 'https://example.com/live/channel.m3u8')).toEqual([]);
  });

  it('handles a variant with no RESOLUTION attribute gracefully', () => {
    const noRes = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1200000\nmid.m3u8\n';
    const variants = parseHlsMasterPlaylist(noRes, 'https://example.com/live/channel/master.m3u8');
    expect(variants).toHaveLength(1);
    expect(variants[0].bitrateKbps).toBe(1200);
  });
});
