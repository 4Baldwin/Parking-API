// src/auth/dto/forgot-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'test@example.com', description: 'Email address to send reset link' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}