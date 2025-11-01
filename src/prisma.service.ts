// src/prisma.service.ts

import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  
  // 1. แก้ไข Constructor: เพิ่ม log configuration เพื่อรับ 'beforeExit' event
  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // 2. ปรับปรุง enableShutdownHooks: แก้ไขชื่อ $on ให้ถูกต้องตาม TypeScript 
  // และเปลี่ยนเป็น $on<any> เพื่อให้ยอมรับ 'beforeExit' ได้
  async enableShutdownHooks(app: INestApplication) {
    // Note: เนื่องจากเราเพิ่ม log config แล้ว เราสามารถใช้ $on ได้ 
    // แต่เพื่อหลีกเลี่ยง TS Error ชั่วคราว เราใช้ $on<any>
    (this as any).$on('beforeExit', async () => { 
        await app.close();
    });
  }
  
  /**
   * ฟังก์ชันสำหรับล้างข้อมูลทั้งหมดในตาราง "Ticket" (ใช้สำหรับการทดสอบเท่านั้น!)
   * POST /clean-tickets
   */
  async cleanTicketData() {
    // ใช้ $executeRaw เพื่อเรียกใช้คำสั่ง SQL โดยตรง
    return this.$executeRaw`TRUNCATE TABLE "Ticket" RESTART IDENTITY CASCADE;`;
  }
}