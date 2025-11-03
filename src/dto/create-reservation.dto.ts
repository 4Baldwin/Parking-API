// src/dto/create-reservation.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUppercase,
  MinLength,
  MaxLength,
  IsNumber,
  IsIn,
  Matches, // (*** 1. Import Matches ***)
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'ABC-1234', description: 'เลขทะเบียนรถ' })
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @MinLength(4)
  @MaxLength(10)
  vehiclePlate: string;

  @ApiProperty({
    example: 'cln1y9g000030e3s72qj8y54z',
    description: 'ID ช่องจอด (Space ID)',
  })
  // (*** 2. แก้ไขเป็น @Matches() ***)
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'spaceId must be a valid CUID',
  })
  @IsNotEmpty()
  spaceId: string;

  @ApiProperty({
    example: 60,
    description: 'แพ็คเกจที่เลือก (30 หรือ 60 นาที)',
  })
  @IsNumber()
  @IsIn([30, 60])
  prePaidDurationMinutes: number;
}