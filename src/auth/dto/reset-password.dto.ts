// src/auth/dto/reset-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The password reset token received via email' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'newSecurePassword123', description: 'New password (minimum 6 characters)' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}