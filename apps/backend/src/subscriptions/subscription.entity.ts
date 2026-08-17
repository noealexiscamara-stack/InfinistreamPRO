import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Currency, SubscriptionPlan, SubscriptionStatus } from '@infiny-stream/types';
import { User } from '../users/user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar' })
  plan!: SubscriptionPlan;

  @Index()
  @Column({ type: 'varchar', default: 'active' })
  status!: SubscriptionStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'varchar' })
  currency!: Currency;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate!: Date;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId?: string;
}
