// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // <-- Import ConfigService
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer'; // <-- 1. Import MailerModule
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { SpacesController } from './spaces.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    // --- 2. เพิ่ม MailerModule.forRootAsync ---
    MailerModule.forRootAsync({
      imports: [ConfigModule], // <-- Import ConfigModule ที่นี่ด้วย
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'), // เช่น 'smtp.gmail.com'
          port: configService.get<number>('MAIL_PORT', 587), // เช่น 587 (TLS)
          secure: configService.get<string>('MAIL_SECURE') === 'true', // false สำหรับ 587
          auth: {
            user: configService.get<string>('MAIL_USER'), // Email ที่ใช้ส่ง
            pass: configService.get<string>('MAIL_PASSWORD'), // App Password
          },
        },
        defaults: {
          from: `"${configService.get<string>('MAIL_FROM_NAME', 'Parking App')}" <${configService.get<string>('MAIL_USER')}>`,
        },
      }),
      inject: [ConfigService],
    }),
    // --- สิ้นสุด MailerModule ---
  ],
  controllers: [AppController, SpacesController, TicketsController],
  providers: [AppService, PrismaService, TicketsService],
})
export class AppModule {}