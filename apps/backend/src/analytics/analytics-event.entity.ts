import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Product usage events (product rule #48): new users, playlist
 * activations, playback errors, buffering, quality changes, crashes,
 * trial->premium conversion, renewals. Deliberately schema-light (a name
 * + a small properties bag) so new event types never require a
 * migration — and deliberately NOT storing anything beyond what's needed
 * to compute the KPIs in rule #49 (no free-text, no device identifiers
 * beyond what's already in the devices table, no location).
 */
@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Index()
  @Column()
  name!: string;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
