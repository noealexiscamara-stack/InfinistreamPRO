import type { M3uParseOptions, ParsedM3uChannel, ParsedPlaylist } from './types';

const DEFAULT_CHUNK_SIZE = 500;

interface PendingMeta {
  tvgId?: string;
  tvgName?: string;
  logoUrl?: string;
  groupTitle?: string;
  country?: string;
}

function splitLines(content: string): string[] {
  // Handles \n, \r\n and lone \r line endings, and strips a UTF-8 BOM.
  const normalized = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return normalized.split(/\r\n|\r|\n/);
}

/**
 * Splits an #EXTINF payload (everything after "#EXTINF:") into its
 * attribute block and display title, respecting quoted attribute values
 * that may themselves contain commas.
 */
function splitAttrsAndTitle(rest: string): { attrsPart: string; title: string } {
  let inQuotes = false;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      return { attrsPart: rest.slice(0, i), title: rest.slice(i + 1).trim() };
    }
  }
  // No unquoted comma found — treat the whole remainder as the title.
  return { attrsPart: '', title: rest.trim() };
}

const ATTR_RE = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;

function parseAttrs(attrsPart: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(attrsPart)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function parseExtinfLine(line: string): { title: string; meta: PendingMeta } {
  const afterPrefix = line.slice(line.indexOf(':') + 1);
  // Duration is the leading numeric token (usually -1 for live streams); skip it.
  const durationMatch = afterPrefix.match(/^-?\d+(\.\d+)?/);
  const rest = durationMatch ? afterPrefix.slice(durationMatch[0].length) : afterPrefix;
  const { attrsPart, title } = splitAttrsAndTitle(rest);
  const attrs = parseAttrs(attrsPart);

  return {
    title: title || attrs['tvg-name'] || 'Chaîne sans nom',
    meta: {
      tvgId: attrs['tvg-id'] || undefined,
      tvgName: attrs['tvg-name'] || undefined,
      logoUrl: attrs['tvg-logo'] || attrs['tvg-logo-small'] || undefined,
      groupTitle: attrs['group-title'] || undefined,
      country: attrs['tvg-country'] || attrs['tvg-language'] || undefined,
    },
  };
}

function lastUrlSegment(url: string): string {
  try {
    const clean = url.split('?')[0].split('#')[0];
    const segments = clean.split('/').filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}

function extractHeaderEpgUrl(headerLine: string): string | undefined {
  const attrs = parseAttrs(headerLine.slice(headerLine.indexOf('#EXTM3U') + '#EXTM3U'.length));
  return attrs['x-tvg-url'] || attrs['url-tvg'] || undefined;
}

/**
 * Synchronous, single-pass generator over the raw lines of an M3U playlist.
 * Kept separate from the async/chunked API so the core parsing logic can be
 * unit tested without fake timers.
 */
export function* iterateM3uChannels(content: string): Generator<ParsedM3uChannel> {
  const lines = splitLines(content);
  let pending: { title: string; meta: PendingMeta } | null = null;
  let sortIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    if (/^#EXTM3U/i.test(line)) {
      continue;
    }

    if (/^#EXTINF:/i.test(line)) {
      pending = parseExtinfLine(line);
      continue;
    }

    if (/^#EXTGRP:/i.test(line)) {
      if (pending && !pending.meta.groupTitle) {
        pending.meta.groupTitle = line.slice(line.indexOf(':') + 1).trim();
      }
      continue;
    }

    if (line.startsWith('#')) {
      // Unrecognized directive (#EXTVLCOPT, #KODIPROP, comments, ...) — ignore.
      continue;
    }

    // Anything else is treated as a stream URL.
    const url = line;
    const meta = pending?.meta ?? {};
    const name = pending?.title ?? lastUrlSegment(url);

    yield {
      name,
      streamUrl: url,
      logoUrl: meta.logoUrl,
      groupTitle: meta.groupTitle,
      tvgId: meta.tvgId,
      tvgName: meta.tvgName,
      country: meta.country,
      category: meta.groupTitle,
      sortIndex: sortIndex++,
    };

    pending = null;
  }
}

/**
 * Parses a full M3U playlist without yielding — fine for small/medium
 * playlists or for tests. For large user playlists (thousands of
 * channels) prefer {@link parseM3u}, which chunks the work so it never
 * blocks the JS thread for long.
 */
export function parseM3uSync(content: string): ParsedPlaylist {
  const channels: ParsedM3uChannel[] = [];
  const categoryCounts = new Map<string, number>();
  const warnings: string[] = [];

  if (!/#EXTM3U/i.test(content.slice(0, 200))) {
    warnings.push("Le fichier ne commence pas par #EXTM3U — traité comme une playlist M3U tolérante.");
  }

  for (const channel of iterateM3uChannels(content)) {
    channels.push(channel);
    if (channel.category) {
      categoryCounts.set(channel.category, (categoryCounts.get(channel.category) ?? 0) + 1);
    }
  }

  const headerLine = content.slice(0, content.indexOf('\n') === -1 ? content.length : content.indexOf('\n'));
  const epgUrl = /^#EXTM3U/i.test(headerLine.trim()) ? extractHeaderEpgUrl(headerLine) : undefined;

  return {
    channels,
    categories: Array.from(categoryCounts.entries())
      .map(([name, channelCount]) => ({ name, channelCount }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    epgUrl,
    warnings,
  };
}

/**
 * Chunked, non-blocking parser suitable for large playlists (thousands of
 * channels). Yields control back to the JS event loop every `chunkSize`
 * entries via a macrotask, so the UI thread stays responsive while a large
 * playlist is being imported. Progress is reported through `onProgress`.
 */
export async function parseM3u(content: string, options: M3uParseOptions = {}): Promise<ParsedPlaylist> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const channels: ParsedM3uChannel[] = [];
  const categoryCounts = new Map<string, number>();
  const warnings: string[] = [];

  if (!/#EXTM3U/i.test(content.slice(0, 200))) {
    warnings.push("Le fichier ne commence pas par #EXTM3U — traité comme une playlist M3U tolérante.");
  }

  let sinceYield = 0;
  for (const channel of iterateM3uChannels(content)) {
    channels.push(channel);
    if (channel.category) {
      categoryCounts.set(channel.category, (categoryCounts.get(channel.category) ?? 0) + 1);
    }
    sinceYield++;
    if (sinceYield >= chunkSize) {
      sinceYield = 0;
      options.onProgress?.(channels.length);
      // Yield to the event loop so gestures/animations/UI updates can run.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  options.onProgress?.(channels.length);

  const headerLine = content.slice(0, content.indexOf('\n') === -1 ? content.length : content.indexOf('\n'));
  const epgUrl = /^#EXTM3U/i.test(headerLine.trim()) ? extractHeaderEpgUrl(headerLine) : undefined;

  return {
    channels,
    categories: Array.from(categoryCounts.entries())
      .map(([name, channelCount]) => ({ name, channelCount }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    epgUrl,
    warnings,
  };
}
