import { Body, Controller, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Intentionally anonymous/unauthenticated: analytics must never gate or
   * slow down the product experience, and product rule #48 asks us to
   * avoid collecting more than necessary. Events are aggregate product
   * telemetry (new installs, playback errors, quality switches, crashes,
   * trial->premium conversion) — nothing here requires tying an event to
   * a specific signed-in identity to compute the KPIs in rule #49.
   */
  @Post('events')
  async track(@Body() dto: TrackEventDto) {
    await this.analyticsService.track(undefined, dto.name, dto.properties);
    return { received: true };
  }
}
