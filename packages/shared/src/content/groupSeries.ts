import { channelNameKey } from '../channels/qualityMarkers';
import { parseEpisodeMarker, splitEpisodeName, type ClassifiableEntry } from './classify';
import { stableHash } from '../utils/id';

export interface GroupSeriesInput extends ClassifiableEntry {
  sourceId: string;
  sortIndex: number;
  logoUrl?: string;
}

export interface GroupedSeriesEpisode {
  id: string;
  sourceId: string;
  season: number;
  episode: number;
  title?: string;
  streamUrl: string;
  logoUrl?: string;
  sortIndex: number;
}

export interface SeriesGroupItem {
  id: string;
  sourceId: string;
  name: string;
  logoUrl?: string;
  groupTitle?: string;
  episodes: GroupedSeriesEpisode[];
  seasons: number[];
  sortIndex: number;
}

export interface GroupSeriesResult {
  series: SeriesGroupItem[];
  unparsed: GroupSeriesInput[];
}

export function groupEpisodesIntoSeries(entries: GroupSeriesInput[]): GroupSeriesResult {
  const bySeries = new Map<
    string,
    { title: string; entries: Array<{ entry: GroupSeriesInput; season: number; episode: number }> }
  >();
  const unparsed: GroupSeriesInput[] = [];

  for (const entry of entries) {
    const marker = parseEpisodeMarker(entry.name);
    if (!marker) {
      unparsed.push(entry);
      continue;
    }

    const { seriesTitle: title } = splitEpisodeName(entry.name);
    const key = `${entry.sourceId}::${channelNameKey(title)}`;
    const bucket = bySeries.get(key);
    if (bucket) bucket.entries.push({ entry, season: marker.season, episode: marker.episode });
    else bySeries.set(key, { title, entries: [{ entry, season: marker.season, episode: marker.episode }] });
  }

  const series: SeriesGroupItem[] = [];

  for (const [key, bucket] of bySeries) {
    const seenUrls = new Set<string>();
    const episodes: GroupedSeriesEpisode[] = [];

    for (const { entry, season, episode } of bucket.entries) {
      if (seenUrls.has(entry.streamUrl)) continue;
      seenUrls.add(entry.streamUrl);

      episodes.push({
        id: `ep_${stableHash(`${entry.sourceId}::${entry.streamUrl}`)}`,
        sourceId: entry.sourceId,
        season,
        episode,
        title: splitEpisodeName(entry.name).episodeTitle,
        streamUrl: entry.streamUrl,
        logoUrl: entry.logoUrl,
        sortIndex: entry.sortIndex,
      });
    }

    if (episodes.length === 0) continue;

    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode || a.sortIndex - b.sortIndex);

    const first = bucket.entries.reduce(
      (min, e) => (e.entry.sortIndex < min.entry.sortIndex ? e : min),
      bucket.entries[0]
    ).entry;

    series.push({
      id: `ser_${stableHash(key)}`,
      sourceId: first.sourceId,
      name: bucket.title,
      logoUrl: episodes.find((e) => e.logoUrl)?.logoUrl,
      groupTitle: first.groupTitle,
      episodes,
      seasons: [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b),
      sortIndex: first.sortIndex,
    });
  }

  series.sort((a, b) => a.sortIndex - b.sortIndex);
  return { series, unparsed };
}
