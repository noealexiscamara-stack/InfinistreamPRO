/**
 * Series detail UI phases — loading must never collapse into "missing"
 * while a request is still in flight.
 */
export type SeriesDetailPhase = 'loading' | 'seasons' | 'episodes' | 'missing';

export function seriesPhaseAfterLoad(result: {
  cancelled?: boolean;
  found: boolean;
  seasonCount: number;
}): SeriesDetailPhase {
  if (result.cancelled) return 'loading';
  if (!result.found) return 'missing';
  if (result.seasonCount <= 0) return 'missing';
  return 'seasons';
}

/** While fetching, UI must stay on loading — never flash missing. */
export function seriesPhaseOnFetchStart(): SeriesDetailPhase {
  return 'loading';
}
