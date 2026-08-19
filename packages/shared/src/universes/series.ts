import type { Channel, GroupedSeries, GroupEpisodesResult } from '@infiny-stream/types';
import { stableHash } from '../utils/id';

interface ParsedEpisode {
  seriesTitle: string;
  season: number;
  episode: number;
}

const PATTERNS: Array<{ re: RegExp; pick: (m: RegExpMatchArray) => ParsedEpisode | null }> = [
  {
    re: /^(.*?)\s*[Ss](?:eason\s*)?(\d{1,2})\s*[Ee](?:p(?:isode)?\s*)?(\d{1,2})\b(.*)$/,
    pick: (m) => ({ seriesTitle: m[1].trim(), season: Number(m[2]), episode: Number(m[3]) }),
  },
  {
    re: /^(.*?)\s*(\d{1,2})x(\d{1,2})\b(.*)$/,
    pick: (m) => ({ seriesTitle: m[1].trim(), season: Number(m[2]), episode: Number(m[3]) }),
  },
  {
    re: /^(.*?)\s*[Ss]eason\s*(\d{1,2})\s*[Ee]p(?:isode)?\s*(\d{1,2})\b(.*)$/i,
    pick: (m) => ({ seriesTitle: m[1].trim(), season: Number(m[2]), episode: Number(m[3]) }),
  },
];

function parseEpisodeName(name: string): ParsedEpisode | null {
  const trimmed = name.trim();
  for (const { re, pick } of PATTERNS) {
    const match = trimmed.match(re);
    if (match) {
      const parsed = pick(match);
      if (parsed && parsed.seriesTitle.length > 0) return parsed;
    }
  }
  return null;
}

function seriesKey(sourceId: string, title: string): string {
  return `ser_${stableHash(`${sourceId}::${title.toLowerCase()}`)}`;
}

/**
 * Builds series → seasons → episodes from flat playlist rows already tagged
 * `kind === 'series'`. Anything that looks like a series entry but does not
 * match an episode pattern lands in `unparsed` so it is never silently dropped.
 */
export function groupEpisodesIntoSeries(channels: Channel[]): GroupEpisodesResult {
  const bySeries = new Map<string, GroupedSeries>();
  const unparsed: Channel[] = [];

  for (const channel of channels) {
    const parsed = parseEpisodeName(channel.name);
    if (!parsed) {
      unparsed.push(channel);
      continue;
    }

    const key = seriesKey(channel.sourceId, parsed.seriesTitle);
    let series = bySeries.get(key);
    if (!series) {
      series = {
        id: key,
        sourceId: channel.sourceId,
        title: parsed.seriesTitle,
        logoUrl: channel.logoUrl,
        sortIndex: channel.sortIndex,
        seasons: [],
      };
      bySeries.set(key, series);
    } else {
      series.sortIndex = Math.min(series.sortIndex, channel.sortIndex);
      if (!series.logoUrl && channel.logoUrl) series.logoUrl = channel.logoUrl;
    }

    let season = series.seasons.find((s) => s.season === parsed.season);
    if (!season) {
      season = { season: parsed.season, episodes: [] };
      series.seasons.push(season);
    }
    season.episodes.push(channel);
  }

  const series = [...bySeries.values()]
    .map((s) => ({
      ...s,
      seasons: s.seasons
        .map((season) => ({
          ...season,
          episodes: [...season.episodes].sort((a, b) => {
            const ea = parseEpisodeName(a.name)?.episode ?? 0;
            const eb = parseEpisodeName(b.name)?.episode ?? 0;
            return ea - eb || a.sortIndex - b.sortIndex;
          }),
        }))
        .sort((a, b) => a.season - b.season),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  return { series, unparsed };
}

export { parseEpisodeName };
