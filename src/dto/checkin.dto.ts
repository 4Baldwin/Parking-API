// src/dto/checkin.dto.ts

import { ApiProperty } from '@nestjs/swagger'; // <-- 1. Import ApiProperty
import { IsString, IsNotEmpty, IsUppercase, MinLength, MaxLength } from 'class-validator';

export class CheckinDto {
  @ApiProperty({ // <-- 2. เพิ่ม ApiProperty
    example: 'ABC-1234',
    description: 'เลขทะเบียนรถที่ใช้ในการจอง (ต้องตรงกัน)',
    minLength: 4,
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @MinLength(4)
  @MaxLength(10)
  vehiclePlate: string;
}