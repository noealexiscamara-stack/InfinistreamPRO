import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OrangeMoneyProvider } from './providers/orange-money.provider';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { HoloPayProvider } from './providers/holopay.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), SubscriptionsModule],
  providers: [PaymentsService, OrangeMoneyProvider, MtnMomoProvider, HoloPayProvider],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
