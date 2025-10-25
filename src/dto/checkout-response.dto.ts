import { ApiProperty } from '@nestjs/swagger';

export class CheckoutResponseDto {
  @ApiProperty({ example: 'cmh2abcd0000tuysxyz123abc' })
  ticket_id: string;

  @ApiProperty({ example: '1กน1234' })
  vehicle_plate: string;

  @ApiProperty({ example: 'A1' })
  space_code: string;

  @ApiProperty({ example: '2025-10-22T11:27:48.324Z' })
  checkin_at: string;

  @ApiProperty({ example: '2025-10-22T11:56:36.000Z' })
  checkout_at: string;

  @ApiProperty({ example: 20 })
  amount: number;

  @ApiProperty({ example: 'THB' })
  currency: string;
}
