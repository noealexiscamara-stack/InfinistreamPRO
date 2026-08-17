import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';

import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Device } from '../devices/device.entity';
import { Payment } from '../payments/payment.entity';
import { Playlist } from '../playlists/playlist.entity';
import { SyncBlob } from '../sync/sync-blob.entity';
import { AnalyticsEvent } from '../analytics/analytics-event.entity';

// Dedicated DataSource for the TypeORM CLI (migration:generate / migration:run).
// Kept separate from app.module.ts's TypeOrmModule.forRootAsync because the
// CLI needs a plain DataSource instance, not a NestJS-wired async factory —
// but the entity list and connection options are meant to stay in sync with
// app.module.ts. If you add an entity there, add it here too.
//
// Loads the same .env the app itself uses (DB_HOST/DB_PORT/... — see
// .env.example) so `npx typeorm-ts-node-commonjs migration:run -d
// src/database/data-source.ts` talks to the same database as `npm run
// start:prod`.
// `quiet: true` — dotenv's default CLI output is a marketing "tip" line
// noise on every migration command; suppressed here so `migration:run`
// output stays limited to what TypeORM actually reports.
loadEnv({ quiet: true });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'infiny_stream',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'infiny_stream',
  // Never true here: migrations are the only schema-mutation path once this
  // file is in use (see docs/GUIDE_DEPLOIEMENT.md).
  synchronize: false,
  entities: [User, Subscription, Device, Payment, Playlist, SyncBlob, AnalyticsEvent],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
});
