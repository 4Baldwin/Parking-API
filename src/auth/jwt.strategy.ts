// src/auth/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from './users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    // --- แก้ไขส่วนนี้ ---
    const secret = configService.get<string>('JWT_SECRET'); // ดึงค่า Secret
    if (!secret) {
      // ถ้าไม่มี JWT_SECRET ใน .env ให้โยน Error ตอนเริ่มแอปฯ เลย
      throw new Error('JWT_SECRET is not defined in the environment variables');
    }
    // --- สิ้นสุดการแก้ไข ---

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // <-- ใช้ค่า secret ที่ตรวจสอบแล้ว
    });
  }

  /**
   * Passport จะตรวจสอบ Signature และวันหมดอายุของ JWT โดยใช้ Secret Key ก่อน
   * ถ้า Token ถูกต้อง มันจะเรียกฟังก์ชัน validate() นี้
   * @param payload ข้อมูลที่ถอดรหัสจาก JWT (เช่น { email: 'user@example.com', sub: 'user_id' })
   * @returns User object (ไม่รวม password) ที่จะถูกแนบไปกับ Request (req.user)
   */
  async validate(payload: { sub: string; email: string }) {
    // เราใช้ User ID (payload.sub) จาก Token ในการค้นหา User
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      // ถ้า User ที่ผูกกับ Token นี้ไม่มีตัวตนแล้ว
      throw new UnauthorizedException('User not found');
    }
    // Passport จะแนบ User object ที่ return นี้ไปกับ Request object (เป็น req.user)
    return user;
  }
}