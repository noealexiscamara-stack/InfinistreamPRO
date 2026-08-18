import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PairingService } from './pairing.service';
import { PollPairingDto, StartPairingDto } from './dto/pairing.dto';

/**
 * TV pairing, shaped after the OAuth 2.0 Device Authorization Grant
 * (RFC 8628). Typing a 120-character M3U URL on a remote control is the
 * problem this solves: the television shows a six-character code, the user
 * approves it from their phone, and the TV picks up an access token.
 *
 * `/start` and `/poll` are deliberately public — the television has no
 * credentials yet, that is the entire premise. The security comes from the
 * device secret issued at `/start`, not from authentication (see
 * PairingCode's class docs).
 */
@Controller('pairing')
export class PairingController {
  constructor(private readonly pairingService: PairingService) {}

  /** Called by the TV. Public by design. */
  @Post('start')
  start(@Body() dto: StartPairingDto) {
    return this.pairingService.start(dto.deviceName, dto.platform);
  }

  /** Called by the TV on a timer. Public, but gated on the device secret. */
  @Post('poll')
  poll(@Body() dto: PollPairingDto) {
    return this.pairingService.poll(dto.code, dto.deviceSecret);
  }

  /** Web dashboard: show the user what they are about to authorise. */
  @UseGuards(JwtAuthGuard)
  @Get(':code')
  describe(@Param('code') code: string) {
    return this.pairingService.describe(code);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':code/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.pairingService.approve(user.userId, code);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':code/deny')
  deny(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.pairingService.deny(user.userId, code);
  }
}
