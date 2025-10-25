import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckinDto {
  @ApiProperty({ example: 'cmh1pti280003tuysjg26n1tk' })
  @IsString()
  space_id: string;

  @ApiProperty({ example: '1กก1234' })
  @IsString()
  vehicle_plate: string;
}
