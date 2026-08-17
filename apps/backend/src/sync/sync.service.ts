import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncBlob, type SyncKind } from './sync-blob.entity';

@Injectable()
export class SyncService {
  constructor(@InjectRepository(SyncBlob) private readonly repo: Repository<SyncBlob>) {}

  async get(userId: string, kind: SyncKind): Promise<{ payload: unknown; updatedAt: Date } | null> {
    const row = await this.repo.findOne({ where: { userId, kind } });
    if (!row) return null;
    return { payload: JSON.parse(row.payload), updatedAt: row.updatedAt };
  }

  async put(userId: string, kind: SyncKind, payload: unknown): Promise<{ updatedAt: Date }> {
    let row = await this.repo.findOne({ where: { userId, kind } });
    if (!row) {
      row = this.repo.create({ userId, kind });
    }
    row.payload = JSON.stringify(payload);
    const saved = await this.repo.save(row);
    return { updatedAt: saved.updatedAt };
  }
}
