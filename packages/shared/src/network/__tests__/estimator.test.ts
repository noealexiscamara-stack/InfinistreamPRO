import { ThroughputEstimator } from '../estimator';
import { classifyNetworkQuality } from '../quality';

function sample(kbps: number, t: number, fromStall = false) {
  return { timestampMs: t, throughputKbps: kbps, connectionType: 'wifi' as const, fromStall };
}

describe('ThroughputEstimator', () => {
  it('converges toward a consistent throughput', () => {
    const est = new ThroughputEstimator();
    for (let i = 0; i < 10; i++) est.addSample(sample(2000, i * 1000));
    expect(est.estimatedKbps).toBeGreaterThan(1500);
    expect(est.estimatedKbps).toBeLessThanOrEqual(2000);
  });

  it('is not "stable" until enough samples are collected', () => {
    const est = new ThroughputEstimator();
    est.addSample(sample(2000, 0));
    expect(est.isStable).toBe(false);
  });

  it('flags high-variance samples as unstable', () => {
    const est = new ThroughputEstimator();
    [500, 4000, 300, 5000, 200].forEach((kbps, i) => est.addSample(sample(kbps, i * 1000)));
    expect(est.isStable).toBe(false);
  });

  it('flags consistent samples as stable', () => {
    const est = new ThroughputEstimator();
    [2000, 2050, 1980, 2010, 1995].forEach((kbps, i) => est.addSample(sample(kbps, i * 1000)));
    expect(est.isStable).toBe(true);
  });

  it('snaps the estimate down immediately on a stall, rather than waiting for the EMA', () => {
    const est = new ThroughputEstimator();
    for (let i = 0; i < 10; i++) est.addSample(sample(5000, i * 1000));
    expect(est.estimatedKbps).toBeGreaterThan(3000);

    est.addSample(sample(300, 10000, true));
    expect(est.estimatedKbps).toBeLessThanOrEqual(300);
  });
});

describe('classifyNetworkQuality', () => {
  it('maps throughput to the 4 user-facing levels', () => {
    expect(classifyNetworkQuality(0, true)).toBe('offline');
    expect(classifyNetworkQuality(300, true)).toBe('low');
    expect(classifyNetworkQuality(1000, true)).toBe('medium');
    expect(classifyNetworkQuality(2500, true)).toBe('good');
    expect(classifyNetworkQuality(6000, true)).toBe('excellent');
  });

  it('downgrades the displayed level by one notch when unstable', () => {
    expect(classifyNetworkQuality(6000, false)).toBe('good');
    expect(classifyNetworkQuality(2500, false)).toBe('medium');
  });
});
