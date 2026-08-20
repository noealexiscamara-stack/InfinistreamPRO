import {
  MIN_THROUGHPUT_SAMPLE_BYTES,
  assessThroughputSample,
  classifyNetworkQuality,
} from '../../index';

describe('assessThroughputSample', () => {
  it('rejects transfers smaller than 100 KB (manifest-sized)', () => {
    // 3 KB in 300 ms → ~80 kbps if wrongly accepted (the production bug).
    const tiny = assessThroughputSample(3_000, 300);
    expect(tiny.accepted).toBe(false);
    expect(tiny.reason).toBe('rejected_too_small');
    expect(tiny.bytes).toBeLessThan(MIN_THROUGHPUT_SAMPLE_BYTES);
    expect(classifyNetworkQuality(tiny.throughputKbps, true)).not.toBe('offline');
  });

  it('rejects a sequence of tiny samples — none can flip quality to offline', () => {
    const sizes = [2_048, 3_072, 4_096, 8_192, 16_384, 50_000, 99_999];
    for (const bytes of sizes) {
      const assessment = assessThroughputSample(bytes, 250);
      expect(assessment.accepted).toBe(false);
      expect(classifyNetworkQuality(assessment.throughputKbps, false)).not.toBe('offline');
    }
  });

  it('accepts a transfer of at least 100 KB', () => {
    const ok = assessThroughputSample(100_000, 200);
    expect(ok.accepted).toBe(true);
    expect(ok.reason).toBe('accepted');
    expect(ok.throughputKbps).toBeGreaterThan(0);
  });

  it('rejects invalid timing', () => {
    expect(assessThroughputSample(200_000, 0).reason).toBe('rejected_invalid_timing');
  });
});
