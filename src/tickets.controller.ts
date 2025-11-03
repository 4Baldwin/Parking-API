// src/tickets.controller.ts

import {
  Controller,
  Post,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException, // <-- 1. เพิ่มบรรทัดนี้
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CheckinDto } from './dto/checkin.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Tickets')
@Controller('api/tickets')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // --- (*** 2. เพิ่ม Endpoint ใหม่สำหรับ Dashboard ***) ---
  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tickets for the logged-in user' })
  async getMyTickets(@Request() req) {
    const userId = req.user.id; // (อิงจาก JwtStrategy)
    return this.ticketsService.findMyTickets(userId);
  }
  // --- (สิ้นสุดการเพิ่ม) ---

  @Post('reserve')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างการจองใหม่ (ต้อง Login)' })
  async reserve(@Body() dto: CreateReservationDto, @Request() req) {
    const userId = req.user.id;
    return this.ticketsService.createReservation(dto, userId);
  }

  @Post('reserve/confirm-payment/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ยืนยันการจ่ายเงินค่าจอง (Webhook)' })
  async confirmReservation(@Param('id') id: string) {
    return this.ticketsService.confirmReservationPayment(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงข้อมูลตั๋วตาม ID (ต้องเป็นเจ้าของ)' })
  async getTicket(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    const ticket = await this.ticketsService.getTicketById(id);
    if (ticket.userId !== userId) {
      throw new NotFoundException('Ticket not found or access denied'); // <-- 3. ตอนนี้จะหาเจอแล้ว
    }
    return ticket;
  }

  @Post('checkin/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check-in เข้าจอด (สแกน QR, กรอกทะเบียน)' })
  async checkIn(@Param('id') id: string, @Body() checkinDto: CheckinDto) {
    return this.ticketsService.checkIn(id, checkinDto);
  }

  @Post('checkout/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'เริ่ม Check-out (คำนวณค่าบริการ)' })
  async checkOut(@Param('id') id: string) {
    return this.ticketsService.checkOut(id);
  }

  @Post('confirm-payment/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ยืนยันการจ่ายเงินตอนออก (Webhook)' })
  async confirmPayment(@Param('id') id: string) {
    return this.ticketsService.confirmPayment(id);
  }
}