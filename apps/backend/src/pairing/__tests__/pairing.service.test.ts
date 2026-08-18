import { ForbiddenException, GoneException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PairingService } from '../pairing.service';
import type { PairingCode } from '../pairing-code.entity';

/**
 * In-memory stand-in for the TypeORM repository. The pairing logic is
 * where the security lives, so it is worth testing directly rather than
 * only through an integration harness.
 */
class FakeRepo {
  rows: PairingCode[] = [];
  private seq = 0;

  create(partial: Partial<PairingCode>): PairingCode {
    return { id: `pc_${++this.seq}`, createdAt: new Date(), ...partial } as PairingCode;
  }

  async save(row: PairingCode): Promise<PairingCode> {
    const index = this.rows.findIndex((r) => r.id === row.id);
    if (index >= 0) this.rows[index] = row;
    else this.rows.push(row);
    return row;
  }

  async findOne({ where }: { where: Partial<PairingCode> }): Promise<PairingCode | null> {
    return (
      this.rows.find((r) => Object.entries(where).every(([k, v]) => (r as never as Record<string, unknown>)[k] === v)) ??
      null
    );
  }

  async delete(): Promise<void> {
    /* purge is housekeeping, not part of what these tests assert */
  }
}

const DEVICE = { name: 'Samsung Android TV', platform: 'android_tv' as const };

function makeService(overrides: { deviceLimitReached?: boolean } = {}) {
  const repo = new FakeRepo();
  const registerOrTouch = jest.fn(async () => {
    if (overrides.deviceLimitReached) {
      throw new ForbiddenException("Limite d'appareils atteinte (3).");
    }
    return { id: 'dev_1' };
  });
  const jwt = { sign: jest.fn((payload: object) => `signed:${JSON.stringify(payload)}`) };

  const service = new PairingService(
    repo as never,
    { registerOrTouch } as never,
    jwt as never,
    { get: () => undefined } as never
  );

  return { service, repo, registerOrTouch, jwt };
}

async function startAndApprove(userId = 'user_1') {
  const ctx = makeService();
  const started = await ctx.service.start(DEVICE.name, DEVICE.platform);
  await ctx.service.approve(userId, started.code);
  return { ...ctx, started };
}

describe('PairingService.start', () => {
  it('issues a short code and a long secret', async () => {
    const { service } = makeService();
    const result = await service.start(DEVICE.name, DEVICE.platform);

    expect(result.code).toHaveLength(6);
    expect(result.deviceSecret).toHaveLength(64);
    expect(result.pollIntervalSeconds).toBeGreaterThan(0);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('only uses characters that survive being read off a television', async () => {
    const { service } = makeService();
    for (let i = 0; i < 40; i++) {
      const { code } = await service.start(DEVICE.name, DEVICE.platform);
      // No O/0, I/1/L, U/V — the classic misreadings.
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTWXYZ23456789]{6}$/);
    }
  });

  it('never stores the device secret in clear', async () => {
    const { service, repo } = makeService();
    const { deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);

    const stored = repo.rows[0];
    expect(stored.deviceSecretHash).not.toBe(deviceSecret);
    expect(stored.deviceSecretHash).toBe(createHash('sha256').update(deviceSecret).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(deviceSecret);
  });
});

describe('PairingService.poll', () => {
  it('reports pending until someone approves', async () => {
    const { service } = makeService();
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);

    await expect(service.poll(code, deviceSecret)).resolves.toEqual({ status: 'pending' });
  });

  it('hands over a token once approved', async () => {
    const { service, started, jwt } = await startAndApprove('user_42');
    const result = await service.poll(started.code, started.deviceSecret);

    expect(result).toEqual({ status: 'approved', accessToken: expect.any(String) });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'user_42' });
  });

  // --- this is the part that actually matters ---------------------------

  it('refuses to hand the token to anyone who only knows the displayed code', async () => {
    const { service, started } = await startAndApprove();

    await expect(service.poll(started.code, 'a'.repeat(64))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('burns the pairing after repeated wrong secrets', async () => {
    const { service } = makeService();
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);

    for (let i = 0; i < 10; i++) {
      await expect(service.poll(code, 'b'.repeat(64))).rejects.toBeInstanceOf(UnauthorizedException);
    }
    // Even the legitimate TV is now locked out — it must restart the flow.
    await expect(service.poll(code, deviceSecret)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is strictly single use', async () => {
    const { service, started } = await startAndApprove();

    await expect(service.poll(started.code, started.deviceSecret)).resolves.toMatchObject({ status: 'approved' });
    await expect(service.poll(started.code, started.deviceSecret)).rejects.toBeInstanceOf(GoneException);
  });

  it('rejects an expired code', async () => {
    const { service, repo } = makeService();
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);
    repo.rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.poll(code, deviceSecret)).rejects.toBeInstanceOf(GoneException);
  });

  it('rejects an unknown code', async () => {
    const { service } = makeService();
    await expect(service.poll('ZZZZZZ', 'c'.repeat(64))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a refusal back to the television', async () => {
    const { service } = makeService();
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);
    await service.deny('user_1', code);

    await expect(service.poll(code, deviceSecret)).resolves.toEqual({ status: 'denied' });
  });

  it('forgives case, spaces and dashes in what the user typed', async () => {
    const { service } = makeService();
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);
    const messy = `${code.slice(0, 3).toLowerCase()}- ${code.slice(3).toLowerCase()}`;

    await expect(service.poll(messy, deviceSecret)).resolves.toEqual({ status: 'pending' });
  });
});

describe('PairingService.describe', () => {
  it('tells the user what they are authorising', async () => {
    const { service } = makeService();
    const { code } = await service.start(DEVICE.name, DEVICE.platform);

    const info = await service.describe(code);
    expect(info).toMatchObject({ deviceName: DEVICE.name, platform: DEVICE.platform, status: 'pending' });
  });

  it('never exposes the device secret to the web side', async () => {
    const { service } = makeService();
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);

    const info = await service.describe(code);
    expect(JSON.stringify(info)).not.toContain(deviceSecret);
    expect(info).not.toHaveProperty('deviceSecretHash');
  });

  it('hides an expired code', async () => {
    const { service, repo } = makeService();
    const { code } = await service.start(DEVICE.name, DEVICE.platform);
    repo.rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.describe(code)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PairingService.approve', () => {
  it('books a device slot against the user', async () => {
    const { service, registerOrTouch } = makeService();
    const { code } = await service.start(DEVICE.name, DEVICE.platform);

    await service.approve('user_7', code);
    expect(registerOrTouch).toHaveBeenCalledWith('user_7', DEVICE.name, DEVICE.platform);
  });

  it('fails at approval time when the device limit is reached, not later on the TV', async () => {
    const { service } = makeService({ deviceLimitReached: true });
    const { code, deviceSecret } = await service.start(DEVICE.name, DEVICE.platform);

    await expect(service.approve('user_1', code)).rejects.toBeInstanceOf(ForbiddenException);
    // The television must keep waiting rather than being handed a token.
    await expect(service.poll(code, deviceSecret)).resolves.toEqual({ status: 'pending' });
  });

  it('tolerates a double-click on Autoriser', async () => {
    const { service } = makeService();
    const { code } = await service.start(DEVICE.name, DEVICE.platform);

    await service.approve('user_1', code);
    await expect(service.approve('user_1', code)).resolves.toMatchObject({ status: 'approved' });
  });

  it('refuses to approve an expired code', async () => {
    const { service, repo } = makeService();
    const { code } = await service.start(DEVICE.name, DEVICE.platform);
    repo.rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.approve('user_1', code)).rejects.toBeInstanceOf(GoneException);
  });

  it('refuses to approve a code already consumed by a television', async () => {
    const { service, started } = await startAndApprove();
    await service.poll(started.code, started.deviceSecret);

    await expect(service.approve('user_1', started.code)).rejects.toBeInstanceOf(NotFoundException);
  });
});
