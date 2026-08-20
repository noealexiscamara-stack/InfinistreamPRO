/**
 * A transfer smaller than this cannot measure bandwidth — TCP slow-start
 * hasn't finished, so size/duration is mostly latency. HLS manifests are
 * typically 2–3 KB and must never become throughput samples.
 */
export const MIN_THROUGHPUT_SAMPLE_BYTES = 100_000;

export interface ThroughputSampleAssessment {
  bytes: number;
  elapsedMs: number;
  throughputKbps: number;
  accepted: boolean;
  reason: 'accepted' | 'rejected_too_small' | 'rejected_invalid_timing';
}

/** Decide whether a timed download is large enough to estimate bandwidth. */
export function assessThroughputSample(bytes: number, elapsedMs: number): ThroughputSampleAssessment {
  if (elapsedMs <= 0 || bytes <= 0) {
    return {
      bytes,
      elapsedMs,
      throughputKbps: 0,
      accepted: false,
      reason: 'rejected_invalid_timing',
    };
  }

  const throughputKbps = Math.round((bytes * 8) / elapsedMs);

  if (bytes < MIN_THROUGHPUT_SAMPLE_BYTES) {
    return {
      bytes,
      elapsedMs,
      throughputKbps,
      accepted: false,
      reason: 'rejected_too_small',
    };
  }

  return {
    bytes,
    elapsedMs,
    throughputKbps,
    accepted: true,
    reason: 'accepted',
  };
}

export function logThroughputSample(assessment: ThroughputSampleAssessment, source: string): void {
  const tag = assessment.accepted ? 'ACCEPTED' : 'REJECTED';
  console.log(
    `[Throughput] ${tag} source=${source} bytes=${assessment.bytes} elapsedMs=${assessment.elapsedMs} kbps=${assessment.throughputKbps} reason=${assessment.reason}`
  );
}
