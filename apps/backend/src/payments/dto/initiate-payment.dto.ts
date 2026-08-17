import { IsIn } from 'class-validator';
import type { PaymentProvider } from '@infiny-stream/types';

const PROVIDERS: PaymentProvider[] = ['orange_money', 'mtn_momo', 'holopay', 'card'];

export class InitiatePaymentDto {
  @IsIn(PROVIDERS)
  provider!: PaymentProvider;
}
