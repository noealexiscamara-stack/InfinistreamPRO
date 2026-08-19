import type { ContentKind, ClassifiableEntry } from '@infiny-stream/types';

const RADIO_GROUP = /\b(radio|radios|webradio|fm\s|am\s|audio\s*only)\b/i;
const RADIO_NAME = /\b(radio|radios|webradio)\b/i;

const MOVIE_GROUP =
  /\b(films?|movies?|cin[eé]ma|vod|video\s*on\s*demand|pel[ií]culas?|cine|film\s*&|^\s*movies?\s*$|^\s*films?\s*$)/i;

const SERIES_GROUP =
  /\b(s[eé]ries?|tv\s*shows?|s[eé]ries\s*tv|episodes?|seasons?|saisons?|drama\s*series)\b/i;

/** S01E03, s1 e3, 1x03, Season 2 Episode 5 */
const EPISODE_IN_NAME =
  /\b[Ss](?:eason\s*)?(\d{1,2})\s*[Ee](?:p(?:isode)?\s*)?(\d{1,2})\b|\b(\d{1,2})x(\d{1,2})\b|\b[Ss]eason\s*(\d{1,2})\s*[Ee]p(?:isode)?\s*(\d{1,2})\b/;

function haystack(entry: ClassifiableEntry): string {
  return [entry.groupTitle, entry.category, entry.name, entry.tvgId].filter(Boolean).join(' ');
}

/**
 * Maps a playlist row to one of four local universes. Heuristic only — providers
 * rarely label VOD consistently, so we prefer false negatives (live) over
 * misclassifying a live channel as VOD.
 */
export function classifyEntry(entry: ClassifiableEntry): ContentKind {
  const blob = haystack(entry);

  if (RADIO_GROUP.test(blob) || RADIO_NAME.test(entry.name)) {
    return 'radio';
  }

  if (EPISODE_IN_NAME.test(entry.name)) {
    return 'series';
  }

  if (SERIES_GROUP.test(blob) && !MOVIE_GROUP.test(blob)) {
    return 'series';
  }

  if (MOVIE_GROUP.test(blob)) {
    return 'movie';
  }

  return 'live';
}

export function classifyEntries<T extends ClassifiableEntry>(
  entries: T[]
): Array<T & { kind: ContentKind }> {
  return entries.map((entry) => ({ ...entry, kind: classifyEntry(entry) }));
}
