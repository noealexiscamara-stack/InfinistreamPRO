import { IsObject, IsOptional, IsString } from 'class-validator';

export class TrackEventDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
