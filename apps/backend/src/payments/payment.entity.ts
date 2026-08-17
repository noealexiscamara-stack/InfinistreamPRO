import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Currency, PaymentProvider, PaymentStatus } from '@infiny-stream/types';
import { User } from '../users/user.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar' })
  provider!: PaymentProvider;

  @Column('decimal', { precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar' })
  currency!: Currency;

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status!: PaymentStatus;

  @Index({ unique: true })
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
