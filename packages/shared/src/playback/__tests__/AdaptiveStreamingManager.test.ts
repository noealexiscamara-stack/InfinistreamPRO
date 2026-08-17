import type { StreamVariant } from '@infiny-stream/types';
import { AdaptiveStreamingManager } from '../AdaptiveStreamingManager';

const LADDER: StreamVariant[] = [
  { id: '240p', heightLabel: 240, bitrateKbps: 400, url: 'x240' },
  { id: '360p', heightLabel: 360, bitrateKbps: 800, url: 'x360' },
  { id: '480p', heightLabel: 480, bitrateKbps: 1400, url: 'x480' },
  { id: '720p', heightLabel: 720, bitrateKbps: 2800, url: 'x720' },
  { id: '1080p', heightLabel: 1080, bitrateKbps: 5000, url: 'x1080' },
];

function feed(manager: AdaptiveStreamingManager, kbpsSeq: number[], startMs = 0, stepMs = 3000) {
  let now = startMs;
  const decisions = [] as ReturnType<AdaptiveStreamingManager['decide']>[];
  for (const kbps of kbpsSeq) {
    manager.reportSample({ timestampMs: now, throughputKbps: kbps, connectionType: 'wifi', fromStall: false });
    decisions.push(manager.decide(now));
    now += stepMs;
  }
  return { decisions, lastNow: now };
}

describe('AdaptiveStreamingManager', () => {
  it('never invents a quality: a single-variant source is always a pass-through', () => {
    const manager = new AdaptiveStreamingManager();
    manager.setVariants([{ id: 'only', heightLabel: 360, bitrateKbps: 800, url: 'solo' }]);
    const first = manager.decide(0);
    expect(first.variant.id).toBe('only');
    expect(first.reason).toBe('single_variant');

    manager.reportSample({ timestampMs: 1000, throughputKbps: 50000, connectionType: 'wifi', fromStall: false });
    const second = manager.decide(1000);
    expect(second.variant.id).toBe('only');
    expect(second.changed).toBe(false);
  });

  it('starts conservatively rather than guessing the top rendition', () => {
    const manager = new AdaptiveStreamingManager();
    manager.setVariants(LADDER);
    const decision = manager.decide(0);
    expect(decision.variant.id).toBe('360p');
  });

  it('downgrades after a sustained drop, not a single blip', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 1000 });
    manager.setVariants(LADDER, '480p');

    // A single low sample should not be enough (downgradeConsecutiveSamples = 3 for auto).
    const { decisions } = feed(manager, [200, 200], 0, 2000);
    expect(decisions[0].changed).toBe(false);
    expect(decisions[1].changed).toBe(false);

    manager.reportSample({ timestampMs: 4000, throughputKbps: 200, connectionType: 'wifi', fromStall: false });
    const third = manager.decide(4000);
    expect(third.changed).toBe(true);
    expect(third.reason).toBe('downgrade_network');
    expect(third.variant.bitrateKbps).toBeLessThan(1400);
  });

  it('does not oscillate 720p<->480p on noise around the threshold', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 1000 });
    manager.setVariants(LADDER, '480p');

    // Throughput is noisy but its *sustained average* stays comfortably
    // above the 480p safety threshold (1260 kbps) and nowhere near the
    // 720p upgrade bar (2800 * 1.5 = 4200 kbps), so it should hold steady
    // despite sample-to-sample jitter.
    const noisy = [1500, 1300, 1480, 1320, 1460, 1340, 1500, 1300, 1480, 1320];
    const { decisions } = feed(manager, noisy, 0, 2000);

    expect(decisions.every((d) => d.changed === false)).toBe(true);
    expect(decisions[decisions.length - 1].variant.id).toBe('480p');
  });

  it('only upgrades after headroom is sustained for the full observation window', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 1000 });
    manager.setVariants(LADDER, '480p');

    // Plenty of headroom for 720p (needs > 2800*1.5=4200 kbps). The
    // estimator itself only reports "stable" once it has 3 samples, so the
    // 15s upgradeStableWindowMs clock effectively starts on the 3rd sample
    // (t=6000) — the upgrade should only land once 15s have elapsed from
    // *that* point (t=21000), not from the first sample.
    const times = [0, 3000, 6000, 9000, 12000, 15000, 18000, 21000];
    let last: ReturnType<AdaptiveStreamingManager['decide']> | undefined;
    for (const t of times) {
      manager.reportSample({ timestampMs: t, throughputKbps: 5000, connectionType: 'wifi', fromStall: false });
      last = manager.decide(t);
      if (t < 21000) {
        expect(last.changed).toBe(false);
      }
    }

    expect(last!.changed).toBe(true);
    expect(last!.reason).toBe('upgrade_network');
    expect(last!.variant.id).toBe('720p');
  });

  it('a brief improvement resets the upgrade observation window (no premature upgrade)', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 1000 });
    manager.setVariants(LADDER, '480p');

    // Reach stability and start tracking 720p as an upgrade candidate.
    feed(manager, [5000, 5000, 5000], 0, 3000); // t=0,3000,6000

    // Dip back down — the resulting variance breaks stability and resets
    // upgrade candidate tracking, even though throughput recovers right after.
    manager.reportSample({ timestampMs: 9000, throughputKbps: 1300, connectionType: 'wifi', fromStall: false });
    manager.decide(9000);
    manager.reportSample({ timestampMs: 12000, throughputKbps: 5000, connectionType: 'wifi', fromStall: false });
    const afterDip = manager.decide(12000);

    // Only 3s have passed since the dip broke tracking — nowhere near the
    // 15s window required to confirm 720p again.
    expect(afterDip.variant.id).toBe('480p');
  });

  it('reacts immediately to a stall instead of waiting out the cooldown', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 20_000 });
    manager.setVariants(LADDER, '720p');
    manager.decide(0); // establishes lastSwitchAt via no prior switch — cooldown not yet relevant

    manager.reportStall(300, 500);
    const decision = manager.decide(500, true);
    expect(decision.changed).toBe(true);
    expect(decision.reason).toBe('downgrade_stall');
    expect(decision.variant.bitrateKbps).toBeLessThan(2800);
  });

  it('économie mode never exceeds its resolution cap even with excellent throughput', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 500 });
    manager.setMode('economy');
    manager.setVariants(LADDER, '360p');

    const { decisions } = feed(manager, [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000], 0, 1000);
    for (const d of decisions) {
      expect(d.variant.heightLabel).toBeLessThanOrEqual(480);
    }
  });

  it('qualité mode tolerates a deeper drop before downgrading than balanced mode', () => {
    const balanced = new AdaptiveStreamingManager({ minSwitchIntervalMs: 500 });
    balanced.setMode('balanced');
    balanced.setVariants(LADDER, '720p');

    const quality = new AdaptiveStreamingManager({ minSwitchIntervalMs: 500 });
    quality.setMode('quality');
    quality.setVariants(LADDER, '720p');

    // 2000 kbps is below balanced's threshold (2800*0.9=2520) but above
    // quality's threshold (2800*0.75=2100)... use a value between the two.
    const dropKbps = 2300;
    const balancedResult = feed(balanced, [dropKbps, dropKbps, dropKbps, dropKbps], 0, 2000);
    const qualityResult = feed(quality, [dropKbps, dropKbps, dropKbps, dropKbps], 0, 2000);

    expect(balancedResult.decisions.some((d) => d.changed)).toBe(true);
    expect(qualityResult.decisions.some((d) => d.changed)).toBe(false);
  });

  it('clamps down immediately when switching to a stricter mode, bypassing cooldown', () => {
    const manager = new AdaptiveStreamingManager({ minSwitchIntervalMs: 60_000 });
    manager.setVariants(LADDER, '1080p');
    manager.decide(0);

    manager.setMode('economy');
    const clamped = manager.decide(100);
    expect(clamped.reason).toBe('mode_cap');
    expect(clamped.variant.heightLabel).toBeLessThanOrEqual(480);
  });
});
