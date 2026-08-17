import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * The mobile app calls this on every app start to confirm entitlement —
   * never trusting a locally-cached "is premium" flag alone (rule #41).
   */
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const subscription = await this.subscriptionsService.getActiveForUser(user.userId);
    if (!subscription) throw new NotFoundException('Aucun abonnement trouvé pour cet utilisateur.');
    return subscription;
  }
}
