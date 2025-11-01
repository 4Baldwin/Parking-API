// src/app.controller.ts

import { Controller, Get, Post } from '@nestjs/common'; // <--- เพิ่ม Post
import { AppService } from './app.service';
import { PrismaService } from './prisma.service'; // <--- เพิ่ม Import PrismaService

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prismaService: PrismaService, // <--- Inject PrismaService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Endpoint สำหรับล้างข้อมูลตาราง Ticket (ใช้สำหรับการทดสอบเท่านั้น!)
   * POST /clean-tickets
   */
  @Post('clean-tickets')
  async cleanTickets() {
    await this.prismaService.cleanTicketData();
    return { 
        message: 'Successfully truncated (deleted all data from) the Ticket table.' 
    };
  }
}