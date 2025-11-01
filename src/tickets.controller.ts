// src/tickets.controller.ts

import { Controller, Post, Body, Param, UsePipes, ValidationPipe, BadRequestException, Get, UseGuards, Request } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CheckinDto } from './dto/checkin.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('tickets')
@Controller('tickets')
@UsePipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
}))
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * (แก้ไข) Endpoiont สำหรับการ *เริ่ม* จอง (ต้อง Login)
   * POST /tickets/reserve
   */
  @Post('reserve')
  @UseGuards(AuthGuard('jwt')) // <-- ป้องกัน Endpoint นี้ด้วย JWT Guard
  @ApiBearerAuth() // <-- บอก Swagger ว่าต้องใช้ Bearer Token
  @ApiOperation({ summary: 'สร้างการจองใหม่ (ต้อง Login)' })
  async reserve(@Body() dto: CreateReservationDto, @Request() req) { // <-- เพิ่ม @Request() req
    const userId = req.user.id; // <-- ดึง userId จาก req.user ที่ Passport ใส่ให้
    return this.ticketsService.createReservation(dto, userId); // <-- ส่ง userId ไปให้ Service
  }

  /**
   * (ใหม่) Endpoiont สำหรับยืนยันการจอง (Webhook 15 บาท)
   * POST /tickets/reserve/confirm-payment/:id
   */
  @Post('reserve/confirm-payment/:id')
  @ApiOperation({ summary: 'ยืนยันการจ่ายเงินค่าจอง 15 บาท (Webhook)' })
  async confirmReservation(@Param('id') id: string) {
    // Webhook จาก Payment Gateway จะเรียกเส้นนี้
    return this.ticketsService.confirmReservationPayment(id);
  }

  /**
   * (ใหม่) Endpoiont สำหรับดึงข้อมูลตั๋วตาม ID
   * GET /tickets/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'ดึงข้อมูลตั๋วตาม ID' })
  async getTicket(@Param('id') id: string) {
    return this.ticketsService.getTicketById(id);
  }

  /**
   * (เดิม) Endpoiont สำหรับการ Check-in (สแกนเข้าจอด)
   * POST /tickets/checkin/:id
   */
  @Post('checkin/:id')
  @ApiOperation({ summary: 'Check-in เข้าจอด (สแกน QR, กรอกทะเบียน)' })
  async checkIn(
    @Param('id') id: string,
    @Body() checkinDto: CheckinDto,
  ) {
    return this.ticketsService.checkIn(id, checkinDto);
  }

  /**
   * (เดิม) Endpoiont สำหรับการ *เริ่ม* Check-out (คำนวณค่าบริการ)
   * POST /tickets/checkout/:id
   */
  @Post('checkout/:id')
  @ApiOperation({ summary: 'เริ่ม Check-out (คำนวณค่าบริการ)' })
  async checkOut(@Param('id') id: string) {
    return this.ticketsService.checkOut(id);
  }

  /**
   * (เดิม) Endpoiont สำหรับยืนยันการชำระเงิน (Webhook ตอนออก)
   * POST /tickets/confirm-payment/:id
   */
  @Post('confirm-payment/:id')
  @ApiOperation({ summary: 'ยืนยันการจ่ายเงินตอนออก (Webhook)' })
  async confirmPayment(@Param('id') id: string) {
    return this.ticketsService.confirmPayment(id);
  }
}