import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { DevicePlatform, DeviceStatus } from '@infiny-stream/types';
import { User } from '../users/user.entity';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'device_name' })
  deviceName!: string;

  @Column({ type: 'varchar' })
  platform!: DevicePlatform;

  @Column({ name: 'last_active', type: 'timestamptz' })
  lastActive!: Date;

  @Column({ type: 'varchar', default: 'active' })
  status!: DeviceStatus;
}
