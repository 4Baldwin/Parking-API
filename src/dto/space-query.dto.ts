import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SpaceStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class SpaceQueryDto {
  @ApiPropertyOptional({ enum: SpaceStatus })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;

  @ApiPropertyOptional({ example: 'cmh1pti250002tuyse9fb2smb' })
  @IsOptional()
  @IsString()
  zone_id?: string;

  @ApiPropertyOptional({ example: 1, description: 'หน้าเริ่มที่ 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'จำนวนต่อหน้า (สูงสุด 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 10;
}
