import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SyncKind = 'favorites' | 'history';

/**
 * Deliberately simple cross-device sync for Premium users (product rules
 * #8 and #37 — "favoris synchronisés", "historique synchronisé"). The
 * detailed, queryable copy of favorites/history lives in the mobile app's
 * local SQLite (see apps/mobile/src/utils/db.ts); the server only needs
 * to shuttle a last-write-wins JSON snapshot between a user's devices, so
 * a single opaque blob per (user, kind) avoids standing up a parallel
 * relational schema for data the server itself never queries.
 */
@Entity('sync_blobs')
@Index(['userId', 'kind'], { unique: true })
export class SyncBlob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar' })
  kind!: SyncKind;

  @Column({ type: 'text' })
  payload!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
