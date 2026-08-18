/**
 * Recognising the quality suffix IPTV providers bolt onto channel names.
 *
 * Providers almost never declare that "TF1 SD", "TF1 HD" and "TF1 FHD" are
 * the same channel — they ship them as three unrelated M3U entries. This
 * module turns that naming convention back into structured data so
 * `groupChannelsByQuality` can rebuild a real quality ladder from a
 * playlist that never advertised one.
 *
 * Two deliberate conservatism rules, both there to avoid merging channels
 * that are genuinely different (a false merge is much worse for the user
 * than a missed grouping — it makes a channel disappear from the list):
 *
 *  1. A bare marker is only stripped when it sits at the END of the name.
 *     "TF1 HD" -> "TF1", but "Discovery HD Showcase" is left alone, because
 *     there the "HD" is part of the channel's actual identity. Markers
 *     wrapped in brackets or parentheses are stripped anywhere, since
 *     "[HD]" is never part of a real channel name.
 *  2. Bare numbers are never treated as resolutions. "720p" is a marker;
 *     "720" is not, because "beIN Sports 1", "Canal+ Sport 360" and
 *     channel numbers in general would otherwise be mangled.
 */

/** Ordinal rung of a quality ladder. 0 means the entry carried no marker at all. */
export type QualityRank = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface QualityMarker {
  /** Canonical short label for display, e.g. 'HD'. Empty string when unmarked. */
  label: string;
  rank: QualityRank;
  /**
   * Nominal vertical resolution implied by the marker. This is a
   * convention-based reading of the provider's own label, NOT a measurement
   * of the stream — the actual stream may not match. Never present it to the
   * user as the stream's true resolution.
   */
  nominalHeight: number;
}

export const UNMARKED: QualityMarker = { label: '', rank: 0, nominalHeight: 0 };

/**
 * Multi-word markers must be tested before single-word ones, otherwise
 * "FULL HD" would be reduced to "FULL" + a stripped "HD".
 */
const MARKER_TABLE: Array<{ pattern: string; marker: QualityMarker }> = [
  // --- multi-word, highest priority ---
  { pattern: 'ULTRA\\s*HD', marker: { label: 'UHD', rank: 5, nominalHeight: 2160 } },
  { pattern: 'FULL\\s*HD', marker: { label: 'FHD', rank: 3, nominalHeight: 1080 } },

  // --- ultra high ---
  { pattern: '8K', marker: { label: '8K', rank: 6, nominalHeight: 4320 } },
  { pattern: '4320P', marker: { label: '8K', rank: 6, nominalHeight: 4320 } },
  { pattern: 'UHD', marker: { label: 'UHD', rank: 5, nominalHeight: 2160 } },
  { pattern: '4K', marker: { label: 'UHD', rank: 5, nominalHeight: 2160 } },
  { pattern: '2160P', marker: { label: 'UHD', rank: 5, nominalHeight: 2160 } },

  // --- quad HD ---
  { pattern: 'QHD', marker: { label: 'QHD', rank: 4, nominalHeight: 1440 } },
  { pattern: '1440P', marker: { label: 'QHD', rank: 4, nominalHeight: 1440 } },
  { pattern: '2K', marker: { label: 'QHD', rank: 4, nominalHeight: 1440 } },

  // --- full HD ---
  { pattern: 'FHD', marker: { label: 'FHD', rank: 3, nominalHeight: 1080 } },
  { pattern: '1080P', marker: { label: 'FHD', rank: 3, nominalHeight: 1080 } },
  { pattern: 'HQ', marker: { label: 'FHD', rank: 3, nominalHeight: 1080 } },
  { pattern: 'HIGH', marker: { label: 'FHD', rank: 3, nominalHeight: 1080 } },

  // --- HD ---
  // 'HD+' before 'HD' so the plus isn't left dangling in the cleaned name.
  { pattern: 'HD\\+', marker: { label: 'HD', rank: 2, nominalHeight: 720 } },
  { pattern: 'HD', marker: { label: 'HD', rank: 2, nominalHeight: 720 } },
  { pattern: '720P', marker: { label: 'HD', rank: 2, nominalHeight: 720 } },
  { pattern: 'MQ', marker: { label: 'HD', rank: 2, nominalHeight: 720 } },
  { pattern: 'MEDIUM', marker: { label: 'HD', rank: 2, nominalHeight: 720 } },

  // --- SD and below ---
  { pattern: 'SD', marker: { label: 'SD', rank: 1, nominalHeight: 480 } },
  { pattern: '576P', marker: { label: 'SD', rank: 1, nominalHeight: 576 } },
  { pattern: '480P', marker: { label: 'SD', rank: 1, nominalHeight: 480 } },
  { pattern: '360P', marker: { label: 'SD', rank: 1, nominalHeight: 360 } },
  { pattern: '240P', marker: { label: 'SD', rank: 1, nominalHeight: 240 } },
  { pattern: 'LQ', marker: { label: 'SD', rank: 1, nominalHeight: 360 } },
  { pattern: 'LOW', marker: { label: 'SD', rank: 1, nominalHeight: 360 } },
];

/** Separators a provider may put between the channel name and its quality suffix. */
const SEP = '[\\s\\-_.|:•]';

/** Matches a bracketed/parenthesised marker anywhere in the string. */
const bracketedRegexes = MARKER_TABLE.map(({ pattern, marker }) => ({
  marker,
  regex: new RegExp(`[\\[(\\{]\\s*${pattern}\\s*[\\])\\}]`, 'i'),
}));

/** Matches a bare marker only when it terminates the string. */
const trailingRegexes = MARKER_TABLE.map(({ pattern, marker }) => ({
  marker,
  regex: new RegExp(`(^|${SEP})${pattern}\\s*$`, 'i'),
}));

export interface StrippedName {
  /** The name with its quality marker removed, for display and grouping. */
  baseName: string;
  /** What was found. `UNMARKED` when the name carried no recognisable marker. */
  marker: QualityMarker;
}

function tidy(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    // Drop separators left dangling once the marker was cut out ("TF1 -" -> "TF1").
    .replace(/[\s\-_.|:•]+$/g, '')
    .replace(/^[\s\-_.|:•]+/g, '')
    .trim();
}

/**
 * Splits a channel name into its base name and quality marker.
 *
 * Applies repeatedly so doubled-up suffixes ("TF1 FHD 1080p") collapse
 * fully; the highest-ranked marker found wins, which is what the user would
 * read the name as meaning.
 */
export function stripQualityMarker(name: string): StrippedName {
  let working = name.trim();
  let best: QualityMarker = UNMARKED;

  // Bracketed markers first — unambiguous wherever they sit.
  let changed = true;
  while (changed) {
    changed = false;
    for (const { regex, marker } of bracketedRegexes) {
      if (regex.test(working)) {
        working = tidy(working.replace(regex, ' '));
        if (marker.rank > best.rank) best = marker;
        changed = true;
        break;
      }
    }
  }

  // Then bare trailing markers, longest/highest-priority table order first.
  changed = true;
  while (changed) {
    changed = false;
    for (const { regex, marker } of trailingRegexes) {
      const match = working.match(regex);
      if (!match) continue;
      // Guard: never consume the entire name. A channel literally called
      // "HD" keeps its name rather than becoming an empty string.
      const candidate = tidy(working.replace(regex, ''));
      if (candidate.length === 0) continue;
      working = candidate;
      if (marker.rank > best.rank) best = marker;
      changed = true;
      break;
    }
  }

  return { baseName: working.length > 0 ? working : name.trim(), marker: best };
}

/**
 * Grouping key for a base name: case- and punctuation-insensitive, so
 * "Canal+ Sport", "CANAL + SPORT" and "canal plus sport" don't fragment
 * into separate groups... within reason. Deliberately does not attempt
 * fuzzy matching — near-miss names stay separate rather than risk a wrong
 * merge.
 */
export function channelNameKey(baseName: string): string {
  return baseName
    .toLowerCase()
    .normalize('NFD')
    // strip diacritics so "Télé" and "Tele" match
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
