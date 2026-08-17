import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { DevicesModule } from './devices/devices.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { SyncModule } from './sync/sync.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';

import { User } from './users/user.entity';
import { Subscription } from './subscriptions/subscription.entity';
import { Device } from './devices/device.entity';
import { Payment } from './payments/payment.entity';
import { Playlist } from './playlists/playlist.entity';
import { SyncBlob } from './sync/sync-blob.entity';
import { AnalyticsEvent } from './analytics/analytics-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        // `synchronize` auto-creates tables from entities — convenient for
        // local dev, but production should use TypeORM migrations instead
        // (see docs/GUIDE_DEPLOIEMENT.md). Controlled by DB_SYNCHRONIZE.
        synchronize: config.get<boolean>('database.synchronize'),
        entities: [User, Subscription, Device, Payment, Playlist, SyncBlob, AnalyticsEvent],
      }),
    }),
    AppConfigModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    PaymentsModule,
    DevicesModule,
    PlaylistsModule,
    SyncModule,
    NotificationsModule,
    AnalyticsModule,
    AdminModule,
  ],
})
export class AppModule {}
