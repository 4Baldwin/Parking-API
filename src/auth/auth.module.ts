// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined in the environment variables');
        }
        const expiresIn = configService.get<string>('JWT_EXPIRES', '1h');

        return {
          secret: secret,
          // --- แก้ไขส่วนนี้ ---
          // ใช้ Type Assertion (as any) เพื่อบอก TS ให้ยอมรับ string
          signOptions: { expiresIn: expiresIn as any },
          // --- สิ้นสุดการแก้ไข ---
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    PrismaService,
    JwtStrategy,
  ],
  exports: [AuthService, UsersService],
})
export class AuthModule {}