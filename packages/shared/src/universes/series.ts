import type { Channel, GroupedSeries, GroupEpisodesResult } from '@infiny-stream/types';
import { parseEpisodeMarker, splitEpisodeName } from '../content/classify';
import {
  groupEpisodesIntoSeries as groupSeriesFlat,
  type GroupSeriesInput,
} from '../content/groupSeries';

export function parseEpisodeName(name: string): { seriesTitle: string; season: number; episode: number } | null {
  const marker = parseEpisodeMarker(name);
  if (!marker) return null;
  return { seriesTitle: splitEpisodeName(name).seriesTitle, ...marker };
}

function inputKey(entry: GroupSeriesInput): string {
  return `${entry.sourceId}\0${entry.name}\0${entry.sortIndex}`;
}

/** Adapts flat series items to the nested season view the mobile app expects. */
export function groupEpisodesIntoSeries(channels: Channel[]): GroupEpisodesResult {
  const originals = new Map(channels.map((ch) => [inputKey(ch), ch]));

  const input: GroupSeriesInput[] = channels.map((ch) => ({
    name: ch.name,
    streamUrl: ch.streamUrl,
    groupTitle: ch.groupTitle,
    sourceId: ch.sourceId,
    sortIndex: ch.sortIndex,
    logoUrl: ch.logoUrl,
  }));

  const { series, unparsed } = groupSeriesFlat(input);

  const grouped: GroupedSeries[] = series.map((item) => ({
    id: item.id,
    sourceId: item.sourceId,
    title: item.name,
    logoUrl: item.logoUrl,
    sortIndex: item.sortIndex,
    seasons: item.seasons.map((seasonNum) => ({
      season: seasonNum,
      episodes: item.episodes
        .filter((ep) => ep.season === seasonNum)
        .map((ep) => {
          const original =
            channels.find((ch) => ch.streamUrl === ep.streamUrl && ch.sourceId === ep.sourceId) ??
            channels.find((ch) => ch.sourceId === ep.sourceId && ch.sortIndex === ep.sortIndex);
          if (original) return original;
          return {
            id: ep.id,
            sourceId: ep.sourceId,
            name: ep.title
              ? `${item.name} — ${ep.title}`
              : `${item.name} S${String(ep.season).padStart(2, '0')}E${String(ep.episode).padStart(2, '0')}`,
            streamUrl: ep.streamUrl,
            logoUrl: ep.logoUrl,
            groupTitle: item.groupTitle,
            sortIndex: ep.sortIndex,
            kind: 'series' as const,
          };
        }),
    })),
  }));

  return {
    series: grouped,
    unparsed: unparsed.map((row) => originals.get(inputKey(row))!).filter(Boolean),
  };
}
