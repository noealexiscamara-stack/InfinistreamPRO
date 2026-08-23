import type { ContentKind } from '@infiny-stream/types';

export interface ClassifiableEntry {
  name: string;
  streamUrl: string;
  groupTitle?: string;
}

/** Xtream Codes path segments — the only authoritative kind signal outside API tags. */
const XTREAM_PATH_KIND: Array<{ segment: string; kind: ContentKind }> = [
  { segment: 'movie', kind: 'movie' },
  { segment: 'movies', kind: 'movie' },
  { segment: 'vod', kind: 'movie' },
  { segment: 'series', kind: 'series' },
  { segment: 'live', kind: 'live' },
  { segment: 'radio', kind: 'radio' },
];

const AUDIO_EXTENSIONS = ['.mp3', '.aac', '.m4a', '.ogg', '.opus', '.wav', '.flac'];

const EPISODE_PATTERNS = [
  /\bS(\d{1,2})\s*[EX](\d{1,3})\b/i,
  /\b(\d{1,2})x(\d{1,3})\b/,
  /\bsaison\s*(\d{1,2})\s*[ée]pisode\s*(\d{1,3})\b/i,
  /\bseason\s*(\d{1,2})\s*episode\s*(\d{1,3})\b/i,
];

function pathSegments(streamUrl: string): string[] {
  try {
    return new URL(streamUrl).pathname.toLowerCase().split('/').filter(Boolean);
  } catch {
    return streamUrl.toLowerCase().split(/[/?#]/).filter(Boolean);
  }
}

function extensionOf(streamUrl: string): string {
  const segments = pathSegments(streamUrl);
  const last = segments[segments.length - 1] ?? '';
  const dot = last.lastIndexOf('.');
  return dot >= 0 ? last.slice(dot) : '';
}

/** True when the stream URL carries an Xtream-style path segment (/live/, /movie/, …). */
export function hasXtreamPathSegment(streamUrl: string): boolean {
  const segments = pathSegments(streamUrl);
  return XTREAM_PATH_KIND.some(({ segment }) => segments.includes(segment));
}

export function parseEpisodeMarker(name: string): { season: number; episode: number } | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = name.match(pattern);
    if (match) {
      const season = Number(match[1]);
      const episode = Number(match[2]);
      if (Number.isFinite(season) && Number.isFinite(episode)) return { season, episode };
    }
  }
  return null;
}

function tidyEdges(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[\s\-_.|:•]+$/g, '')
    .replace(/^[\s\-_.|:•]+/g, '')
    .trim();
}

export interface SplitEpisodeName {
  seriesTitle: string;
  episodeTitle?: string;
}

export function splitEpisodeName(name: string): SplitEpisodeName {
  for (const pattern of EPISODE_PATTERNS) {
    const match = name.match(pattern);
    if (match && match.index !== undefined) {
      const before = tidyEdges(name.slice(0, match.index));
      const after = tidyEdges(name.slice(match.index + match[0].length));
      if (before.length === 0) return { seriesTitle: after || tidyEdges(name) };
      return { seriesTitle: before, episodeTitle: after.length > 0 ? after : undefined };
    }
  }
  return { seriesTitle: tidyEdges(name) };
}

export function stripEpisodeMarker(name: string): string {
  return splitEpisodeName(name).seriesTitle;
}

/**
 * Classifies a playlist entry.
 *
 * M3U rule (Smarters-aligned): everything is live TV. `group-title` is a
 * display category only — never a content-type signal. The sole exception is
 * a reliable audio file extension (.mp3, .aac, …) → radio.
 *
 * Xtream rule: path segments (/movie/, /series/, /live/) are authoritative;
 * episode markers on /movie/ URLs still promote to series.
 */
export function classifyEntry(entry: ClassifiableEntry): ContentKind {
  const segments = pathSegments(entry.streamUrl);

  for (const { segment, kind } of XTREAM_PATH_KIND) {
    if (segments.includes(segment)) {
      if (kind === 'movie' && parseEpisodeMarker(entry.name)) return 'series';
      return kind;
    }
  }

  const ext = extensionOf(entry.streamUrl);
  if (AUDIO_EXTENSIONS.includes(ext)) return 'radio';

  return 'live';
}

export interface ClassifiedEntries<T> {
  live: T[];
  movie: T[];
  series: T[];
  radio: T[];
}

export function classifyEntries<T extends ClassifiableEntry>(entries: T[]): ClassifiedEntries<T> {
  const out: ClassifiedEntries<T> = { live: [], movie: [], series: [], radio: [] };
  for (const entry of entries) {
    out[classifyEntry(entry)].push(entry);
  }
  return out;
}

/** Tags each entry with its kind — used by the mobile importer. */
export function tagEntriesWithKind<T extends ClassifiableEntry>(
  entries: T[]
): Array<T & { kind: ContentKind }> {
  return entries.map((entry) => ({ ...entry, kind: classifyEntry(entry) }));
}
