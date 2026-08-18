import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LessThan, Repository } from 'typeorm';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { DevicePlatform } from '@infiny-stream/types';
import { DevicesService } from '../devices/devices.service';
import { PairingCode } from './pairing-code.entity';

/**
 * Alphabet with the look-alike characters removed (no O/0, I/1/L, U/V).
 * Someone is reading this off a television from three metres away and
 * typing it on a phone — every ambiguous glyph is a support ticket.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
const CODE_LENGTH = 6;

/** Short-lived on purpose: a 6-char code is guessable given enough time. */
const CODE_TTL_MS = 10 * 60 * 1000;

/** Bad-secret polls tolerated before the pairing is burned. */
const MAX_FAILED_ATTEMPTS = 10;

const POLL_INTERVAL_SECONDS = 3;

export interface StartPairingResult {
  code: string;
  /** Returned ONCE, to the TV only. Never displayed, never stored in clear. */
  deviceSecret: string;
  expiresAt: string;
  pollIntervalSeconds: number;
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'denied' }
  | { status: 'approved'; accessToken: string };

@Injectable()
export class PairingService {
  constructor(
    @InjectRepository(PairingCode) private readonly repo: Repository<PairingCode>,
    private readonly devicesService: DevicesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private static hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private static randomCode(): string {
    const bytes = randomBytes(CODE_LENGTH);
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    return out;
  }

  /** Normalises user input: case, spaces and dashes are all forgiven. */
  static normaliseCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Step 1 — the TV asks for a code before anyone has logged in.
   * Deliberately unauthenticated: that is the entire point of the flow.
   */
  async start(deviceName: string, platform: DevicePlatform): Promise<StartPairingResult> {
    await this.purgeExpired();

    const deviceSecret = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    // Collisions are rare but must not surface as a 500 to the TV.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = PairingService.randomCode();
      const clash = await this.repo.findOne({ where: { code, status: 'pending' } });
      if (clash) continue;

      await this.repo.save(
        this.repo.create({
          code,
          deviceSecretHash: PairingService.hashSecret(deviceSecret),
          status: 'pending',
          deviceName,
          platform,
          userId: null,
          deviceId: null,
          failedAttempts: 0,
          expiresAt,
          approvedAt: null,
          consumedAt: null,
        })
      );

      return {
        code,
        deviceSecret,
        expiresAt: expiresAt.toISOString(),
        pollIntervalSeconds: POLL_INTERVAL_SECONDS,
      };
    }

    throw new ForbiddenException('Impossible de générer un code pour le moment. Réessayez.');
  }

  /**
   * Step 2 — the TV polls. Authorised by the long device secret, never by
   * the short code alone, so guessing a displayed code yields nothing.
   */
  async poll(rawCode: string, deviceSecret: string): Promise<PollResult> {
    const code = PairingService.normaliseCode(rawCode);
    const pairing = await this.repo.findOne({ where: { code } });

    if (!pairing) throw new NotFoundException('Code inconnu ou expiré.');
    if (pairing.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Ce code a expiré. Relancez l’appairage depuis le téléviseur.');
    }
    if (pairing.consumedAt) {
      // Single use. A replayed poll must never re-issue a token.
      throw new GoneException('Ce code a déjà été utilisé.');
    }
    if (pairing.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw new ForbiddenException('Trop de tentatives. Relancez l’appairage depuis le téléviseur.');
    }

    if (!PairingService.secretMatches(deviceSecret, pairing.deviceSecretHash)) {
      pairing.failedAttempts += 1;
      await this.repo.save(pairing);
      throw new UnauthorizedException('Secret d’appareil invalide.');
    }

    if (pairing.status === 'denied') return { status: 'denied' };
    if (pairing.status !== 'approved' || !pairing.userId) return { status: 'pending' };

    // Approved: hand over the token exactly once.
    pairing.status = 'consumed';
    pairing.consumedAt = new Date();
    await this.repo.save(pairing);

    return {
      status: 'approved',
      accessToken: this.jwtService.sign({ sub: pairing.userId }),
    };
  }

  private static secretMatches(provided: string, expectedHash: string): boolean {
    const providedHash = PairingService.hashSecret(provided ?? '');
    const a = Buffer.from(providedHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Step 3 — the signed-in user looks the code up on the web dashboard.
   * Returns only what they need to make an informed decision. Never leaks
   * the device secret, and never reveals whether a code that simply does
   * not exist was close to a real one.
   */
  async describe(rawCode: string) {
    const code = PairingService.normaliseCode(rawCode);
    const pairing = await this.repo.findOne({ where: { code } });

    if (!pairing || pairing.expiresAt.getTime() < Date.now() || pairing.consumedAt) {
      throw new NotFoundException('Code inconnu ou expiré.');
    }

    return {
      code: pairing.code,
      deviceName: pairing.deviceName,
      platform: pairing.platform,
      requestedAt: pairing.createdAt.toISOString(),
      expiresAt: pairing.expiresAt.toISOString(),
      status: pairing.status,
    };
  }

  /**
   * Step 4 — the user approves. This is the moment the TV becomes bound to
   * their account, so it also books a device slot against their limit; if
   * they are already at the limit the pairing fails here rather than
   * leaving the TV stuck polling forever.
   */
  async approve(userId: string, rawCode: string) {
    const code = PairingService.normaliseCode(rawCode);
    const pairing = await this.repo.findOne({ where: { code } });

    if (!pairing || pairing.consumedAt) throw new NotFoundException('Code inconnu ou expiré.');
    if (pairing.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Ce code a expiré. Relancez l’appairage depuis le téléviseur.');
    }
    if (pairing.status === 'approved') {
      // Idempotent: a double-click on "Autoriser" must not error.
      return { status: 'approved' as const, deviceName: pairing.deviceName };
    }
    if (pairing.status === 'denied') {
      throw new GoneException('Cette demande a été refusée.');
    }

    const device = await this.devicesService.registerOrTouch(userId, pairing.deviceName, pairing.platform);

    pairing.status = 'approved';
    pairing.userId = userId;
    pairing.deviceId = device.id;
    pairing.approvedAt = new Date();
    await this.repo.save(pairing);

    return { status: 'approved' as const, deviceName: pairing.deviceName };
  }

  /** The user can also refuse — a code they did not expect to see. */
  async deny(userId: string, rawCode: string) {
    const code = PairingService.normaliseCode(rawCode);
    const pairing = await this.repo.findOne({ where: { code } });
    if (!pairing || pairing.consumedAt) throw new NotFoundException('Code inconnu ou expiré.');

    pairing.status = 'denied';
    pairing.userId = userId;
    await this.repo.save(pairing);
    return { status: 'denied' as const };
  }

  /** Housekeeping so the table doesn't grow without bound. */
  private async purgeExpired(): Promise<void> {
    await this.repo.delete({ expiresAt: LessThan(new Date(Date.now() - CODE_TTL_MS)) });
  }
}
