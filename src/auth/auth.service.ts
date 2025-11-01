// src/auth/auth.service.ts

import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, Prisma, PasswordResetToken } from '@prisma/client'; // <-- Import PasswordResetToken
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

// --- เพิ่ม Type Definition ---
// สร้าง Type ที่รวม PasswordResetToken และ User ที่ include มาด้วย
type PasswordResetTokenWithUser = Prisma.PasswordResetTokenGetPayload<{
    include: { user: true }
}>;
// --- สิ้นสุด Type Definition ---


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private prisma: PrismaService,
  ) {}

  /**
   * ตรวจสอบ Email และ Password สำหรับ Login (โค้ดเดิม)
   */
  async validateUser(email: string, pass: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * สร้าง Access Token สำหรับ User ที่ Login สำเร็จ (โค้ดเดิม)
   */
  async login(user: Omit<User, 'password'>) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * สมัครสมาชิก User ใหม่ (โค้ดเดิม)
   */
  async register(userData: Prisma.UserCreateInput) {
    return this.usersService.create(userData);
  }

  // ----------------------------------------------------------------------
  // ตรรกะ Forgot Password
  // ----------------------------------------------------------------------
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If your email is registered, you will receive a password reset link.' };
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 นาที
    await this.prisma.$transaction([
        this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        this.prisma.passwordResetToken.create({ data: { token: hashedToken, userId: user.id, expiresAt: expiresAt } })
    ]);
    const resetUrl = `http://localhost:5173/reset-password?token=${rawToken}`; // !!! เปลี่ยน URL Frontend
    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Reset Your Parking App Password',
        html: `<p>Click the link to reset: <a href="${resetUrl}">${resetUrl}</a> (Expires in 15 mins).</p>`,
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) { this.logger.error(`Failed to send email to ${user.email}`, error.stack); }
    return { message: 'If your email is registered, you will receive a password reset link.' };
  }

  // ----------------------------------------------------------------------
  // ตรรกะ Reset Password
  // ----------------------------------------------------------------------
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const potentialTokens = await this.prisma.passwordResetToken.findMany({
        where: {
            expiresAt: { gt: new Date() }
        },
        include: { user: true }
    });

    // --- แก้ไข: กำหนด Type ที่ชัดเจน ---
    let validTokenRecord: PasswordResetTokenWithUser | null = null;
    // --- สิ้นสุดการแก้ไข ---

    for (const record of potentialTokens) {
        if (await bcrypt.compare(token, record.token)) {
            validTokenRecord = record; // ตอนนี้ Type ตรงกันแล้ว
            break;
        }
    }

    // --- แก้ไข: ตรวจสอบ Type ก่อนเข้าถึง property ---
    if (!validTokenRecord) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }
    // --- สิ้นสุดการแก้ไข ---


    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.$transaction([
        this.prisma.user.update({
            // TypeScript รู้แล้วว่า validTokenRecord ไม่ใช่ null ที่นี่
            where: { id: validTokenRecord.userId },
            data: { password: hashedNewPassword },
        }),
        this.prisma.passwordResetToken.delete({ where: { id: validTokenRecord.id } })
    ]);

    this.logger.log(`Password successfully reset for user ${validTokenRecord.user.email}`);
    return { message: 'Password has been successfully reset.' };
  }
}