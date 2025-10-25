import { ApiProperty } from '@nestjs/swagger';

export class CheckinResponseDto {
  @ApiProperty({ example: 'cmh2abcd0000tuysxyz123abc' })
  ticket_id: string;

  @ApiProperty({ example: 'OCCUPIED' })
  space_status: 'OCCUPIED';
}
