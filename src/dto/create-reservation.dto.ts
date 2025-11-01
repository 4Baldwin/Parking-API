// src/dto/create-reservation.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUppercase, MinLength, MaxLength } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'ABC-1234', description: 'เลขทะเบียนรถ' })
  @IsString()
  @IsNotEmpty()
  @IsUppercase()
  @MinLength(4)
  @MaxLength(10)
  vehiclePlate: string;

  @ApiProperty({ example: 'cln1y9g000030e3s72qj8y54z', description: 'ID ช่องจอดที่ต้องการจอง (Space ID)' })
  @IsString()
  @IsNotEmpty()
  spaceId: string;
  
  // --- ลบฟิลด์ reservationStartTime (ApiProperty และ @IsOptional) ออกจากที่นี่ ---
}