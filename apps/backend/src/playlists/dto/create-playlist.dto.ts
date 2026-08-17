import { IsIn, IsOptional, IsString } from 'class-validator';
import type { SourceType } from '@infiny-stream/types';

const TYPES: SourceType[] = ['m3u_url', 'm3u_file', 'xtream', 'direct_stream'];

export class CreatePlaylistDto {
  @IsString()
  name!: string;

  @IsIn(TYPES)
  type!: SourceType;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  serverUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
