import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import type { SyncKind } from './sync-blob.entity';

const VALID_KINDS: SyncKind[] = ['favorites', 'history'];

function assertValidKind(kind: string): asserts kind is SyncKind {
  if (!VALID_KINDS.includes(kind as SyncKind)) {
    throw new BadRequestException(`Type de synchronisation inconnu : ${kind}`);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get(':kind')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string) {
    assertValidKind(kind);
    return this.syncService.get(user.userId, kind);
  }

  @Put(':kind')
  async put(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string, @Body() body: unknown) {
    assertValidKind(kind);
    return this.syncService.put(user.userId, kind, body);
  }
}
