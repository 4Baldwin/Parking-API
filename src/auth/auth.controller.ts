// src/auth/auth.controller.ts

import { Controller, Post, Body, UsePipes, ValidationPipe, UnauthorizedException, HttpCode, HttpStatus, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto'; // <-- 1. เพิ่ม Import ForgotPasswordDto
import { ResetPasswordDto } from './dto/reset-password.dto';   // <-- 2. เพิ่ม Import ResetPasswordDto
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('auth')
@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * (เดิม) Endpoint สำหรับสมัครสมาชิก
   * POST /auth/register
   */
  @Post('register')
  @ApiOperation({ summary: 'สมัครสมาชิกใหม่' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  /**
   * (เดิม) Endpoint สำหรับ Login
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login และรับ JWT token' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  /**
   * (เดิม) ตัวอย่าง Endpoint ที่มีการป้องกัน: ดูโปรไฟล์ User ปัจจุบัน
   * GET /auth/profile
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดูโปรไฟล์ User ปัจจุบัน (ต้อง Login)' })
  getProfile(@Request() req) {
    return req.user;
  }

  // --- เพิ่ม Endpoints ใหม่ ---

  /**
   * (ใหม่) Endpoint สำหรับขอรีเซ็ตรหัสผ่าน
   * POST /auth/forgot-password
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK) // คืน 200 OK เสมอเพื่อป้องกัน Timing Attack
  @ApiOperation({ summary: 'ส่ง Email ลิงก์รีเซ็ตรหัสผ่าน' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    // 3. เรียกใช้ Service method
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  /**
   * (ใหม่) Endpoint สำหรับรีเซ็ตรหัสผ่านด้วย Token
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'รีเซ็ตรหัสผ่านโดยใช้ Token จาก Email' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    // 4. เรียกใช้ Service method
    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }
  // --- สิ้นสุด Endpoints ใหม่ ---
}