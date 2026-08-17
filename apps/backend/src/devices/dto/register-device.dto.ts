import { IsIn, IsString } from 'class-validator';
import type { DevicePlatform } from '@infiny-stream/types';

const PLATFORMS: DevicePlatform[] = ['android', 'android_tv', 'ios', 'web'];

export class RegisterDeviceDto {
  @IsString()
  deviceName!: string;

  @IsIn(PLATFORMS)
  platform!: DevicePlatform;
}
