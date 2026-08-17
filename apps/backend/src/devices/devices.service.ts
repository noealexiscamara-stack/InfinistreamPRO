import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import type { DevicePlatform } from '@infiny-stream/types';
import { Device } from './device.entity';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly devicesRepo: Repository<Device>,
    private readonly configService: ConfigService
  ) {}

  list(userId: string): Promise<Device[]> {
    return this.devicesRepo.find({ where: { userId, status: 'active' }, order: { lastActive: 'DESC' } });
  }

  /**
   * Registers/refreshes a device. Enforces the configurable device limit
   * (product rule #42 — default from config, admin-adjustable, never
   * hardcoded in the client). Re-registering an already-known device
   * (matched by name+platform) just bumps lastActive instead of counting
   * twice against the limit.
   */
  async registerOrTouch(userId: string, deviceName: string, platform: DevicePlatform): Promise<Device> {
    const existing = await this.devicesRepo.findOne({ where: { userId, deviceName, platform, status: 'active' } });
    if (existing) {
      existing.lastActive = new Date();
      return this.devicesRepo.save(existing);
    }

    const activeCount = await this.devicesRepo.count({ where: { userId, status: 'active' } });
    const limit = this.configService.get<number>('pricing.deviceLimit')!;
    if (activeCount >= limit) {
      throw new ForbiddenException(
        `Limite d'appareils atteinte (${limit}). Déconnectez un appareil pour en ajouter un nouveau.`
      );
    }

    const device = this.devicesRepo.create({ userId, deviceName, platform, lastActive: new Date(), status: 'active' });
    return this.devicesRepo.save(device);
  }

  async revoke(userId: string, deviceId: string): Promise<void> {
    await this.devicesRepo.update({ id: deviceId, userId }, { status: 'revoked' });
  }
}
