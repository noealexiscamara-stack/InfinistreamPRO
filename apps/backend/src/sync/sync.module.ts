import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncBlob } from './sync-blob.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SyncBlob])],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
