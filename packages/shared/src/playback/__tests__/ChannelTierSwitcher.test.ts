import type { Channel } from '@infiny-stream/types';
import { groupChannelsByQuality } from '../../channels/groupChannels';
import { ChannelTierSwitcher, DEFAULT_TIER_SWITCH_CONFIG } from '../ChannelTierSwitcher';

let seq = 0;
function ch(name: string, extra: Partial<Channel> = {}): Channel {
  const index = seq++;
  return {
    id: `id${index}`,
    sourceId: 'src1',
    name,
    streamUrl: extra.streamUrl ?? `http://provider/${encodeURIComponent(name)}`,
    sortIndex: index,
    ...extra,
  };
}

function ladder() {
  seq = 0;
  return groupChannelsByQuality([ch('TF1 SD'), ch('TF1 HD'), ch('TF1 FHD')]).groups[0];
}

const DWELL = DEFAULT_TIER_SWITCH_CONFIG.minDwellMs;
const UPGRADE_WINDOW = DEFAULT_TIER_SWITCH_CONFIG.upgradeStableWindowMs;

describe('ChannelTierSwitcher', () => {
  it('opens on the lowest tier when nothing is known about the link', () => {
    const s = new ChannelTierSwitcher(ladder());
    expect(s.currentTier().label).toBe('SD');
  });

  it('is a pass-through for a channel with a single tier', () => {
    seq = 0;
    const single = groupChannelsByQuality([ch('M6')]).groups[0];
    const s = new ChannelTierSwitcher(single);
    const decision = s.decide(1_000_000);
    expect(decision.changed).toBe(false);
    expect(decision.reason).toBe('single_tier');
  });

  // --- downgrades: should be willing -------------------------------------

  it('drops a tier after repeated stalls', () => {
    const s = new ChannelTierSwitcher(ladder(), { maxHeightLabel: undefined });
    s.setGroup(ladder(), 20_000); // opens on HD
    expect(s.currentTier().label).toBe('HD');

    let now = DWELL + 1000;
    s.reportStall(now);
    s.reportStall(now + 500);
    const decision = s.decide(now + 1000);

    expect(decision.changed).toBe(true);
    expect(decision.reason).toBe('stall_downgrade');
    expect(decision.tier.label).toBe('SD');
  });

  it('does not drop on a single isolated stall', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.setGroup(ladder(), 20_000);
    const now = DWELL + 1000;
    s.reportStall(now);
    expect(s.decide(now + 100).changed).toBe(false);
  });

  it('drops when throughput cannot sustain the current tier', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.setGroup(ladder(), 20_000);
    expect(s.currentTier().label).toBe('HD');

    s.reportThroughput(500);
    const decision = s.decide(DWELL + 1000);
    expect(decision.changed).toBe(true);
    expect(decision.reason).toBe('throughput_downgrade');
    expect(decision.tier.label).toBe('SD');
  });

  it('corrects a bad opening guess straight away, without waiting out the dwell', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.setGroup(ladder(), 20_000); // opened optimistically on HD
    s.reportThroughput(500);
    // No switch has happened yet, so there is no oscillation to prevent —
    // making the user stall for 20s here would be the wrong trade.
    const decision = s.decide(1_000);
    expect(decision.changed).toBe(true);
    expect(decision.tier.label).toBe('SD');
  });

  it('then holds that tier for the dwell period before switching again', () => {
    seq = 0;
    const group = groupChannelsByQuality([ch('TF1 SD'), ch('TF1 HD'), ch('TF1 FHD'), ch('TF1 4K')]).groups[0];
    const s = new ChannelTierSwitcher(group);
    s.setGroup(group, 20_000);

    s.reportThroughput(500);
    const first = s.decide(1_000);
    expect(first.changed).toBe(true);

    // Still bad, but we just moved — sit tight rather than reconnecting again.
    s.reportThroughput(100);
    expect(s.decide(2_000).changed).toBe(false);
    expect(s.decide(1_000 + DWELL - 1).changed).toBe(false);
  });

  it('stops at the bottom rather than thrashing', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.reportThroughput(50);
    let now = DWELL + 1000;
    for (let i = 0; i < 5; i++) {
      s.decide(now);
      now += DWELL + 1000;
    }
    expect(s.currentTier().label).toBe('SD');
  });

  // --- upgrades: should be reluctant --------------------------------------

  it('does not climb until the link has been comfortable for a long while', () => {
    const s = new ChannelTierSwitcher(ladder());
    expect(s.currentTier().label).toBe('SD');
    s.reportThroughput(20_000);

    expect(s.decide(1_000).changed).toBe(false);
    expect(s.decide(DWELL + 1_000).changed).toBe(false);
    expect(s.decide(UPGRADE_WINDOW - 1_000).changed).toBe(false);

    const decision = s.decide(UPGRADE_WINDOW + 5_000);
    expect(decision.changed).toBe(true);
    expect(decision.reason).toBe('upgrade');
    expect(decision.tier.label).toBe('HD');
  });

  it('abandons a pending upgrade as soon as the link wobbles', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.reportThroughput(20_000);
    s.decide(1_000);
    s.decide(UPGRADE_WINDOW - 5_000);

    s.reportStall(UPGRADE_WINDOW - 4_000);
    expect(s.decide(UPGRADE_WINDOW + 5_000).changed).toBe(false);
  });

  it('demands more proof each time a tier has already failed', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.setGroup(ladder(), 20_000);
    expect(s.currentTier().label).toBe('HD');

    // Knock it off HD once.
    let now = DWELL + 1_000;
    s.reportStall(now);
    s.reportStall(now + 100);
    expect(s.decide(now + 200).tier.label).toBe('SD');

    // A link that now looks great still shouldn't get HD back on the
    // ordinary schedule — HD burned us once already.
    s.reportThroughput(20_000);
    now += 1_000;
    s.decide(now);
    const atNormalWindow = s.decide(now + UPGRADE_WINDOW + 1_000);
    expect(atNormalWindow.changed).toBe(false);

    const afterPenalty = s.decide(now + UPGRADE_WINDOW + DEFAULT_TIER_SWITCH_CONFIG.demotionPenaltyMs + 2_000);
    expect(afterPenalty.changed).toBe(true);
    expect(afterPenalty.tier.label).toBe('HD');
  });

  // --- dead streams -------------------------------------------------------

  it('fails over to another URL at the same quality before losing quality', () => {
    seq = 0;
    const group = groupChannelsByQuality([
      ch('TF1 SD'),
      ch('TF1 HD', { streamUrl: 'http://server-a/hd' }),
      ch('TF1 HD', { streamUrl: 'http://server-b/hd' }),
    ]).groups[0];

    const s = new ChannelTierSwitcher(group);
    s.setGroup(group, 20_000);
    expect(s.currentTier().label).toBe('HD');
    const firstUrl = s.currentTier().channel.streamUrl;

    const decision = s.reportTierDead(10_000);
    expect(decision.reason).toBe('failover_same_rank');
    expect(decision.tier.label).toBe('HD');
    expect(decision.tier.channel.streamUrl).not.toBe(firstUrl);
  });

  it('falls to a lower tier once every URL at this quality is dead', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.setGroup(ladder(), 20_000);
    expect(s.currentTier().label).toBe('HD');

    const decision = s.reportTierDead(10_000);
    expect(decision.reason).toBe('stall_downgrade');
    expect(decision.tier.label).toBe('SD');
  });

  it('gives up gracefully when nothing is left to try', () => {
    seq = 0;
    const single = groupChannelsByQuality([ch('M6')]).groups[0];
    const s = new ChannelTierSwitcher(single);
    expect(s.reportTierDead(1_000).changed).toBe(false);
  });

  // --- user-selected cap --------------------------------------------------

  it('applies a tightened cap immediately, without waiting for the dwell timer', () => {
    const s = new ChannelTierSwitcher(ladder());
    s.setGroup(ladder(), 20_000);
    expect(s.currentTier().label).toBe('HD');

    s.setMaxHeightLabel(480);
    const decision = s.decide(1_000);
    expect(decision.changed).toBe(true);
    expect(decision.reason).toBe('mode_cap');
    expect(decision.tier.label).toBe('SD');
  });

  it('never climbs above the cap however good the link looks', () => {
    const s = new ChannelTierSwitcher(ladder(), { maxHeightLabel: 720 });
    s.reportThroughput(50_000);
    let now = 0;
    for (let i = 0; i < 20; i++) {
      s.decide(now);
      now += UPGRADE_WINDOW;
    }
    expect(s.currentTier().nominalHeight).toBeLessThanOrEqual(720);
  });
});
