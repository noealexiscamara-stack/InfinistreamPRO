import * as FileSystem from 'expo-file-system';
import { parseM3u } from '@infiny-stream/shared';
import { M3U_PARSE_CHUNK_SIZE } from '@infiny-stream/config';
import type { M3uFileSource, M3uUrlSource } from '@infiny-stream/types';
import { replaceSourceChannels } from '@/services/persistChannels';

export interface ImportProgress {
  phase: 'downloading' | 'parsing' | 'saving';
  parsedCount?: number;
}

export interface ImportResult {
  channelCount: number;
  categoryCount: number;
  epgUrl?: string;
  warnings: string[];
}

async function readSourceContent(
  source: M3uUrlSource | M3uFileSource,
  onProgress?: (p: ImportProgress) => void
): Promise<string> {
  if (source.type === 'm3u_url') {
    onProgress?.({ phase: 'downloading' });
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Impossible de télécharger la playlist (HTTP ${response.status})`);
    }
    return response.text();
  }

  onProgress?.({ phase: 'downloading' });
  return FileSystem.readAsStringAsync(source.fileUri);
}

/**
 * Downloads/reads, parses, and persists an M3U source. Replaces the
 * source's existing channels atomically (see replaceSourceChannels), so a
 * failed refresh never leaves the user with an empty channel list.
 */
export async function importM3uSource(
  source: M3uUrlSource | M3uFileSource,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  const content = await readSourceContent(source, onProgress);

  onProgress?.({ phase: 'parsing' });
  const parsed = await parseM3u(content, {
    chunkSize: M3U_PARSE_CHUNK_SIZE,
    onProgress: (parsedCount) => onProgress?.({ phase: 'parsing', parsedCount }),
  });

  onProgress?.({ phase: 'saving' });
  await replaceSourceChannels(source.id, parsed.channels);

  return {
    channelCount: parsed.channels.length,
    categoryCount: parsed.categories.length,
    epgUrl: parsed.epgUrl,
    warnings: parsed.warnings,
  };
}
