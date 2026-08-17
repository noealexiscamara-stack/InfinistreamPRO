import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';

@Injectable()
export class AnalyticsService {
  constructor(@InjectRepository(AnalyticsEvent) private readonly repo: Repository<AnalyticsEvent>) {}

  track(userId: string | undefined, name: string, properties?: Record<string, unknown>): Promise<AnalyticsEvent> {
    const event = this.repo.create({ userId, name, properties });
    return this.repo.save(event);
  }

  countByName(name: string, since?: Date): Promise<number> {
    return this.repo.count({
      where: since ? { name, createdAt: MoreThanOrEqual(since) } : { name },
    });
  }
}
