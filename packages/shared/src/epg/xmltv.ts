import { XMLParser } from 'fast-xml-parser';
import type { EpgProgram } from '@infiny-stream/types';
import { stableHash } from '../utils/id';

export interface ParsedEpg {
  programs: EpgProgram[];
  warnings: string[];
}

/**
 * Parses an XMLTV timestamp: "YYYYMMDDHHMMSS[ +HHMM]". Falls back to
 * treating a missing/invalid timestamp as "unknown" (NaN) so the caller
 * can drop the entry rather than crash the whole EPG import — EPG data is
 * optional and best-effort per the product spec (a playlist without EPG
 * must work perfectly).
 */
function parseXmltvTimestamp(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?$/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second, tz] = match;
  const isoLike = `${year}-${month}-${day}T${hour}:${minute}:${second}${
    tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : 'Z'
  }`;
  const ms = Date.parse(isoLike);
  return Number.isNaN(ms) ? undefined : ms;
}

function textOf(node: unknown): string | undefined {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return textOf(node[0]);
  if (node && typeof node === 'object' && '#text' in (node as any)) return String((node as any)['#text']);
  return undefined;
}

/**
 * Parses an XMLTV document into a flat list of programs. This is
 * intentionally lenient: malformed or unrecognized entries are skipped
 * with a warning rather than aborting the whole import, since EPG is a
 * "nice to have" layer on top of channel playback, never a blocker.
 */
export function parseXmltv(xmlContent: string): ParsedEpg {
  const warnings: string[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'programme' || name === 'tv',
  });

  let doc: any;
  try {
    doc = parser.parse(xmlContent);
  } catch (err) {
    return { programs: [], warnings: [`XML illisible: ${err instanceof Error ? err.message : String(err)}`] };
  }

  const tv = doc?.tv?.[0];
  const rawProgrammes: any[] = tv?.programme ?? [];
  const programs: EpgProgram[] = [];

  for (const p of rawProgrammes) {
    const channelTvgId = p?.['@_channel'];
    const startMs = parseXmltvTimestamp(p?.['@_start']);
    const endMs = parseXmltvTimestamp(p?.['@_stop']);
    const title = textOf(p?.title);

    if (!channelTvgId || startMs === undefined || endMs === undefined || !title) {
      warnings.push('Programme EPG ignoré (attributs requis manquants)');
      continue;
    }

    programs.push({
      id: `epg_${stableHash(`${channelTvgId}:${startMs}`)}`,
      channelTvgId: String(channelTvgId),
      title,
      description: textOf(p?.desc),
      startMs,
      endMs,
    });
  }

  return { programs, warnings };
}

/** Returns the program airing at `nowMs`, and the one immediately after it, for a given tvg-id. */
export function currentAndNextProgram(
  programs: EpgProgram[],
  channelTvgId: string,
  nowMs: number
): { current?: EpgProgram; next?: EpgProgram } {
  const forChannel = programs
    .filter((p) => p.channelTvgId === channelTvgId)
    .sort((a, b) => a.startMs - b.startMs);

  const current = forChannel.find((p) => p.startMs <= nowMs && nowMs < p.endMs);
  const currentIndex = current ? forChannel.indexOf(current) : -1;
  const next = currentIndex >= 0 ? forChannel[currentIndex + 1] : forChannel.find((p) => p.startMs > nowMs);

  return { current, next };
}
