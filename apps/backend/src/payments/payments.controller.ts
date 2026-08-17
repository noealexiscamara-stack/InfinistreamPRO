import { Body, Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import type { PaymentProvider } from '@infiny-stream/types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(user.userId, dto.provider);
  }

  /**
   * Public by necessity — payment providers call this directly, not the
   * authenticated mobile client. Authenticity is instead established by
   * `adapter.verifyWebhook()` checking the provider's own signature.
   */
  @Post('webhook/:provider')
  webhook(@Param('provider') provider: PaymentProvider, @Body() body: unknown, @Headers() headers: Record<string, string>) {
    return this.paymentsService.handleWebhook(provider, body, headers);
  }
}
