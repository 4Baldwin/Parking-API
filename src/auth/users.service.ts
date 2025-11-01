// src/auth/users.service.ts

import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * สร้าง User ใหม่ในฐานข้อมูล
   * @param data ข้อมูล User (email, password, name)
   * @returns User ที่สร้างขึ้น (ไม่รวม password)
   */
  async create(data: Prisma.UserCreateInput): Promise<Omit<User, 'password'>> {
    // 1. Hash รหัสผ่านก่อนบันทึก
    const saltRounds = 10; // จำนวนรอบในการ Hash (ค่ามาตรฐาน)
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    try {
      // 2. สร้าง User ใน Database
      const user = await this.prisma.user.create({
        data: {
          ...data,
          password: hashedPassword, // ใช้รหัสผ่านที่ Hash แล้ว
        },
      });

      // 3. คืนค่า User โดยลบ password ออก
      const { password, ...result } = user;
      return result;
    } catch (error) {
      // 4. จัดการ Error กรณี Email ซ้ำ (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error; // ส่งต่อ Error อื่นๆ
    }
  }

  /**
   * ค้นหา User ตาม Email
   * @param email Email ที่ต้องการค้นหา
   * @returns User ที่พบ (รวม password) หรือ null ถ้าไม่พบ
   */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * ค้นหา User ตาม ID (อาจมีประโยชน์สำหรับ JWT)
   * @param id ID ของ User
   * @returns User ที่พบ (ไม่รวม password) หรือ null ถ้าไม่พบ
   */
  async findOneById(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    const { password, ...result } = user;
    return result;
  }
}