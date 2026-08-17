import { parseM3u, parseM3uSync } from '../parser';

const SAMPLE = `#EXTM3U x-tvg-url="https://example.com/epg.xml"
#EXTINF:-1 tvg-id="rtg" tvg-logo="logo.png" group-title="Guinée",RTG
https://example.com/live/rtg.m3u8
#EXTINF:-1 tvg-id="canal2" tvg-logo="c2.png" group-title="Guinée",Canal 2
https://example.com/live/canal2.m3u8
#EXTINF:-1 group-title="Sport",beIN Sports, MAX 1
https://example.com/live/bein1.m3u8
#EXTINF:-1,No Attrs Channel
https://example.com/live/noattrs.m3u8
`;

describe('parseM3uSync', () => {
  it('extracts channels with tvg attributes and group-title', () => {
    const result = parseM3uSync(SAMPLE);
    expect(result.channels).toHaveLength(4);

    const rtg = result.channels[0];
    expect(rtg.name).toBe('RTG');
    expect(rtg.tvgId).toBe('rtg');
    expect(rtg.logoUrl).toBe('logo.png');
    expect(rtg.groupTitle).toBe('Guinée');
    expect(rtg.streamUrl).toBe('https://example.com/live/rtg.m3u8');
  });

  it('keeps commas inside the display title intact', () => {
    const result = parseM3uSync(SAMPLE);
    const bein = result.channels.find((c) => c.streamUrl.includes('bein1'));
    expect(bein?.name).toBe('beIN Sports, MAX 1');
  });

  it('falls back gracefully when no attributes are present', () => {
    const result = parseM3uSync(SAMPLE);
    const noAttrs = result.channels.find((c) => c.streamUrl.includes('noattrs'));
    expect(noAttrs?.name).toBe('No Attrs Channel');
    expect(noAttrs?.groupTitle).toBeUndefined();
  });

  it('builds sorted category counts from group-title', () => {
    const result = parseM3uSync(SAMPLE);
    expect(result.categories).toEqual([
      { name: 'Guinée', channelCount: 2 },
      { name: 'Sport', channelCount: 1 },
    ]);
  });

  it('extracts the EPG url from the #EXTM3U header', () => {
    const result = parseM3uSync(SAMPLE);
    expect(result.epgUrl).toBe('https://example.com/epg.xml');
  });

  it('preserves stable, increasing sortIndex across entries', () => {
    const result = parseM3uSync(SAMPLE);
    expect(result.channels.map((c) => c.sortIndex)).toEqual([0, 1, 2, 3]);
  });

  it('warns but still parses playlists missing the #EXTM3U header', () => {
    const result = parseM3uSync('#EXTINF:-1,Solo Channel\nhttps://example.com/solo.m3u8\n');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.channels).toHaveLength(1);
  });

  it('derives a name from the URL when a bare stream line has no EXTINF', () => {
    const result = parseM3uSync('#EXTM3U\nhttps://example.com/live/orphan.m3u8\n');
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0].name).toBe('orphan.m3u8');
  });

  it('handles CRLF line endings', () => {
    const crlf = SAMPLE.replace(/\n/g, '\r\n');
    const result = parseM3uSync(crlf);
    expect(result.channels).toHaveLength(4);
  });
});

describe('parseM3u (chunked/async)', () => {
  it('produces the same result as the sync parser', async () => {
    const result = await parseM3u(SAMPLE, { chunkSize: 2 });
    const syncResult = parseM3uSync(SAMPLE);
    expect(result.channels).toEqual(syncResult.channels);
    expect(result.categories).toEqual(syncResult.categories);
  });

  it('reports progress and does not block on large playlists', async () => {
    const lines = ['#EXTM3U'];
    const total = 5000;
    for (let i = 0; i < total; i++) {
      lines.push(`#EXTINF:-1 tvg-id="ch${i}" group-title="Groupe ${i % 10}",Chaîne ${i}`);
      lines.push(`https://example.com/live/ch${i}.m3u8`);
    }
    const bigPlaylist = lines.join('\n');

    const progressCalls: number[] = [];
    const result = await parseM3u(bigPlaylist, {
      chunkSize: 500,
      onProgress: (count) => progressCalls.push(count),
    });

    expect(result.channels).toHaveLength(total);
    expect(result.categories).toHaveLength(10);
    expect(progressCalls.length).toBeGreaterThanOrEqual(Math.floor(total / 500));
    expect(progressCalls[progressCalls.length - 1]).toBe(total);
  });
});
