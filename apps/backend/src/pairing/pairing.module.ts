import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DevicesModule } from '../devices/devices.module';
import { PairingCode } from './pairing-code.entity';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PairingCode]),
    DevicesModule,
    // Same signing config as AuthModule: the token a paired TV receives is
    // an ordinary access token, indistinguishable from one issued by login.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret'),
        signOptions: { expiresIn: config.get<string>('auth.jwtExpiresIn') as unknown as number },
      }),
    }),
  ],
  providers: [PairingService],
  controllers: [PairingController],
})
export class PairingModule {}
