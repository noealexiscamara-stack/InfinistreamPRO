import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Subscription } from '../subscriptions/subscription.entity';
import { Device } from '../devices/device.entity';
import { Payment } from '../payments/payment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({ unique: true, nullable: true })
  phone?: string;

  @Column({ nullable: true })
  country?: string;

  /** Grants access to the admin dashboard endpoints (see common/guards/admin.guard.ts). Set manually in the DB — there is no self-service "become admin" flow. */
  @Column({ name: 'is_admin', default: false })
  isAdmin!: boolean;

  // Never stored/returned in clear: bcrypt hash only, and excluded from
  // any serialized response via class-transformer (product rule #46:
  // "never store IPTV/user passwords in clear text").
  @Column({ name: 'password_hash' })
  @Exclude()
  passwordHash!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions?: Subscription[];

  @OneToMany(() => Device, (device) => device.user)
  devices?: Device[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments?: Payment[];
}
