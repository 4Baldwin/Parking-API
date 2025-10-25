import {
  Controller,
  Post,
  Body,
  Param,
  ConflictException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiCreatedResponse, ApiOkResponse, ApiConflictResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { PrismaService } from './prisma.service';
import { CheckinDto } from './dto/checkin.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { SpaceStatus } from '@prisma/client';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private prisma: PrismaService) {}

  // 🅰️ สร้างตั๋วใหม่ (เช็กอินรถ)
  @Post('checkin')
  @ApiCreatedResponse({
    description: 'สร้างตั๋วเช็กอินสำเร็จ',
    schema: {
      example: {
        ticket_id: 'cmh2abcd0000tuysxyz123abc',
        space_status: 'OCCUPIED',
      },
    },
  })
  @ApiConflictResponse({ description: 'ช่องจอดนี้ถูกใช้งานอยู่' })
  @ApiNotFoundResponse({ description: 'ไม่พบช่องจอดนี้' })
  async checkin(@Body() body: CheckinDto) {
    const { space_id, vehicle_plate } = body;

    return this.prisma.$transaction(async (tx) => {
      const space = await tx.space.findUnique({ where: { id: space_id } });
      if (!space) throw new NotFoundException('ไม่พบช่องจอดนี้');
      if (space.status !== 'AVAILABLE')
        throw new ConflictException('ช่องจอดนี้ถูกใช้งานอยู่');

      const ticket = await tx.ticket.create({
        data: { spaceId: space_id, vehiclePlate: vehicle_plate },
      });

      await tx.space.update({
        where: { id: space_id },
        data: { status: SpaceStatus.OCCUPIED },
      });

      return { ticket_id: ticket.id, space_status: SpaceStatus.OCCUPIED };
    });
  }

  // 🅱️ เช็กเอาต์ (คำนวณเงินและคืนช่อง)
  @Post(':ticket_id/checkout')
  @HttpCode(200)
  @ApiOkResponse({
    type: CheckoutResponseDto,
    description: 'เช็กเอาต์สำเร็จ พร้อมคำนวณยอดชำระ',
  })
  @ApiConflictResponse({ description: 'ตั๋วนี้ถูกเช็กเอาต์ไปแล้ว' })
  @ApiNotFoundResponse({ description: 'ไม่พบตั๋วนี้' })
  async checkout(@Param('ticket_id') ticketId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { space: true },
      });

      if (!ticket) throw new NotFoundException('ไม่พบตั๋วนี้');
      if (ticket.checkoutAt) throw new ConflictException('ตั๋วนี้ถูกเช็กเอาต์ไปแล้ว');

      const now = new Date();
      const diffMs = now.getTime() - ticket.checkinAt.getTime();
      const hours = Math.ceil(diffMs / (1000 * 60 * 60)); // ปัดขึ้นเป็นชั่วโมง
      const amount = hours * 20; // คิด 20 บาทต่อชั่วโมง

      await tx.ticket.update({
        where: { id: ticketId },
        data: { checkoutAt: now },
      });

      await tx.space.update({
        where: { id: ticket.spaceId },
        data: { status: SpaceStatus.AVAILABLE },
      });

      const response: CheckoutResponseDto = {
        ticket_id: ticket.id,
        vehicle_plate: ticket.vehiclePlate,
        space_code: ticket.space.code,
        checkin_at: ticket.checkinAt.toISOString(),
        checkout_at: now.toISOString(),
        amount,
        currency: 'THB',
      };

      return response;
    });
  }
}
