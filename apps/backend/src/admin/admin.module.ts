import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Payment } from '../payments/payment.entity';
import { Device } from '../devices/device.entity';
import { Playlist } from '../playlists/playlist.entity';
import { UsersModule } from '../users/users.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription, Payment, Device, Playlist]), UsersModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
