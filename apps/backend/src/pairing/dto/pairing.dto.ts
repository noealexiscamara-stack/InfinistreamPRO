import { IsIn, IsString, Length, MaxLength } from 'class-validator';
import type { DevicePlatform } from '@infiny-stream/types';

const PLATFORMS: DevicePlatform[] = ['android', 'android_tv', 'ios', 'web'];

export class StartPairingDto {
  /** Shown to the user on the approval screen, so they know what they're authorising. */
  @IsString()
  @MaxLength(60)
  deviceName!: string;

  @IsIn(PLATFORMS)
  platform!: DevicePlatform;
}

export class PollPairingDto {
  @IsString()
  @Length(4, 16)
  code!: string;

  @IsString()
  @Length(32, 128)
  deviceSecret!: string;
}

export class CodeParamDto {
  @IsString()
  @Length(4, 16)
  code!: string;
}
