// src/tickets.service.ts
// (ฉบับสมบูรณ์: Logic ราคาใหม่ + Logic จอดต่อ + Fix TS Errors + Fix Overstay Space Status + findMyTickets)

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { TicketStatus, SpaceStatus } from '@prisma/client';
import { CheckinDto } from './dto/checkin.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private prisma: PrismaService) {}

  // (ส่วน 0. createReservation)
  async createReservation(dto: CreateReservationDto, userId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: dto.spaceId },
    });
    if (!space) {
      throw new NotFoundException(`Space with ID ${dto.spaceId} not found.`);
    }
    if (space.status !== 'AVAILABLE') {
      throw new BadRequestException(
        `Space ${space.code} is currently ${space.status}.`,
      );
    }
    let reservationFee = 0;
    if (dto.prePaidDurationMinutes === 30) {
      reservationFee = 15.00;
    } else if (dto.prePaidDurationMinutes === 60) {
      reservationFee = 30.00;
    } else {
      throw new BadRequestException(
        'Invalid prePaidDurationMinutes. Must be 30 or 60.',
      );
    }
    try {
      const newTicket = await this.prisma.$transaction(async (prisma) => {
        const activeStates = [
          TicketStatus.PENDING_PAYMENT,
          TicketStatus.RESERVED,
          TicketStatus.PARKED,
        ];
        const existingActiveTicket = await prisma.ticket.findFirst({
          where: {
            vehiclePlate: dto.vehiclePlate.toUpperCase(),
            status: { in: activeStates },
          },
        });
        if (existingActiveTicket) {
          throw new ConflictException(
            `Vehicle plate ${dto.vehiclePlate} already has an active ticket (Status: ${existingActiveTicket.status}).`,
          );
        }
        const ticket = await prisma.ticket.create({
          data: {
            spaceId: dto.spaceId,
            vehiclePlate: dto.vehiclePlate.toUpperCase(),
            status: TicketStatus.PENDING_PAYMENT,
            prePaidDurationMinutes: dto.prePaidDurationMinutes,
            cumulativePaid: 0,
            amountDue: reservationFee,
            reservationStartTime: null,
            userId: userId,
          },
        });
        await prisma.space.update({
          where: { id: dto.spaceId },
          data: {
            status: 'RESERVED',
            currentTicketId: ticket.id,
          },
        });
        this.logger.log(
          `New reservation (Ticket ${ticket.id}) for ${dto.prePaidDurationMinutes} mins. Awaiting ${reservationFee} THB payment.`,
        );
        return ticket;
      });
      return {
        ticketId: newTicket.id,
        spaceCode: space.code,
        vehiclePlate: newTicket.vehiclePlate,
        amountDue: reservationFee,
        qrCodeUrl: `PAYMENT_QR_CODE_FOR_${reservationFee.toFixed(2)}_BAHT`,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Reservation transaction failed', error);
      throw new BadRequestException('Reservation failed, space might be taken.');
    }
  }

  // (ส่วน 1. confirmReservationPayment)
  async confirmReservationPayment(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (
      ticket.status !== TicketStatus.PENDING_PAYMENT ||
      ticket.checkinAt !== null
    ) {
      throw new BadRequestException(
        `Ticket status is ${ticket.status}. Cannot confirm reservation payment.`,
      );
    }
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.RESERVED,
        reservationStartTime: new Date(),
        cumulativePaid: ticket.amountDue ?? 0,
        amountDue: 0,
      },
    });
    this.logger.log(
      `Reservation for Ticket ${ticketId} confirmed. ${ticket.prePaidDurationMinutes} minute No-Show clock started.`,
    );
    return { message: 'Reservation successful. Ready for check-in.' };
  }

  // (ตรรกะดึงข้อมูลตั๋วตาม ID)
  async getTicketById(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        space: { select: { code: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found.`);
    }
    return ticket;
  }

  // --- (*** 1. นี่คือฟังก์ชันที่เพิ่มเข้ามาสำหรับ Dashboard ***) ---
  async findMyTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: {
        userId: userId,
      },
      include: {
        space: {
          select: { code: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });
  }
  // --- (สิ้นสุดการเพิ่ม) ---

  // (ส่วน 2. checkIn)
  async checkIn(ticketId: string, checkinDto: CheckinDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { space: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found.`);
    }
    if (ticket.status !== TicketStatus.RESERVED) {
      throw new BadRequestException(
        `Ticket status is '${ticket.status}'. Must be RESERVED.`,
      );
    }
    if (ticket.vehiclePlate !== checkinDto.vehiclePlate.toUpperCase()) {
      throw new BadRequestException('Vehicle plate does not match.');
    }
    const checkInTime = new Date();
    const updatedTicket = await this.prisma.$transaction(async (prisma) => {
      const t = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.PARKED, checkinAt: checkInTime },
      });
      await prisma.space.update({
        where: { id: ticket.spaceId },
        data: { status: 'OCCUPIED', currentTicketId: ticketId },
      });
      return t;
    });
    console.log(`[GATE] Opening barrier for Space ${ticket.space.code}`);
    return updatedTicket;
  }

  // (ส่วน 3. calculateTotalFee - Logic ใหม่)
  private calculateTotalFee(checkInTime: Date, checkOutTime: Date): number {
    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    const totalMinutes = Math.ceil(durationMs / (1000 * 60));
    if (totalMinutes <= 0) {
      return 0;
    }
    if (totalMinutes <= 30) return 15;
    if (totalMinutes <= 60) return 30;
    if (totalMinutes <= 90) return 40;
    if (totalMinutes <= 120) return 50;
    if (totalMinutes <= 150) return 60;
    if (totalMinutes <= 180) return 70;
    if (totalMinutes <= 240) return 75;
    if (totalMinutes <= 300) return 80;
    if (totalMinutes <= 360) return 85;

    let totalFee = 85;
    const minutesAfter6Hours = totalMinutes - 360;
    const blocksOf2Hours = Math.ceil(minutesAfter6Hours / 120);
    totalFee += blocksOf2Hours * 5;
    return totalFee;
  }

  // (ส่วน 4. checkOut)
  async checkOut(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket || !ticket.checkinAt) {
      throw new NotFoundException('Ticket not found or has not checked in.');
    }
    if (
      ticket.status !== TicketStatus.PARKED &&
      ticket.status !== TicketStatus.OVERSTAYING
    ) {
      throw new BadRequestException(
        `Ticket status is ${ticket.status}. Cannot initiate checkout.`,
      );
    }
    const checkOutTime = new Date();
    const totalFee = this.calculateTotalFee(ticket.checkinAt, checkOutTime);
    const cumulativePaid = ticket.cumulativePaid.toNumber();
    const amountDue = totalFee - cumulativePaid;
    const finalAmountDue = amountDue > 0 ? amountDue : 0;
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.PENDING_PAYMENT,
        checkoutAt: checkOutTime,
        totalParkingFee: totalFee,
        amountDue: finalAmountDue,
      },
    });
    if (finalAmountDue <= 0) {
      return this.confirmPayment(ticketId);
    }
    return {
      ticketId: ticket.id,
      totalParkingFee: totalFee,
      cumulativePaid: cumulativePaid,
      amountDue: finalAmountDue,
      qrCodeUrl: `PAYMENT_QR_CODE_FOR_${finalAmountDue.toFixed(2)}_BAHT`,
    };
  }

  // (ส่วน 5. confirmPayment)
  async confirmPayment(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (
      ticket.status === TicketStatus.PENDING_PAYMENT &&
      ticket.checkinAt !== null
    ) {
      const newCumulativePaid =
        (ticket.cumulativePaid?.toNumber() ?? 0) +
        (ticket.amountDue?.toNumber() ?? 0);
      await this.prisma.$transaction(async (prisma) => {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: TicketStatus.PAID,
            gracePeriodStartedAt: new Date(),
            amountDue: 0,
            cumulativePaid: newCumulativePaid,
          },
        });
        await prisma.space.update({
          where: { id: ticket.spaceId },
          data: { status: 'PENDING_VACATE' },
        });
      });
      this.logger.log(
        `[GATE] Payment confirmed for ${ticketId}. Opening barrier. 5 minute grace period starts.`,
      );
      return {
        message: `Payment successful. Barrier open. Please exit within 5 minutes.`,
      };
    }
    throw new BadRequestException(
      `Ticket status is ${ticket.status}. Cannot confirm exit payment.`,
    );
  }

  // (ส่วน 6. confirmVacant)
  async confirmVacant(spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
    });
    if (!space) {
      throw new NotFoundException('Space not found');
    }
    if (space.status !== 'PENDING_VACATE') {
      this.logger.warn(
        `Sensor signal received for space ${spaceId}, but status is ${space.status}. Ignoring.`,
      );
      return { message: 'Space is not awaiting vacating. Signal ignored.' };
    }
    await this.prisma.$transaction(async (prisma) => {
      await prisma.space.update({
        where: { id: spaceId },
        data: { status: 'AVAILABLE', currentTicketId: null },
      });
      if (space.currentTicketId) {
        await prisma.ticket.update({
          where: { id: space.currentTicketId },
          data: { status: TicketStatus.COMPLETED },
        });
      }
    });
    this.logger.log(
      `[SENSOR] Space ${spaceId} is vacant. Barrier closing. Returning to AVAILABLE.`,
    );
    return { message: 'Space confirmed vacant. Barrier closed.' };
  }

  // (Helper function - getGracePeriodMinutes)
  private getGracePeriodMinutes(): number {
    return 5;
  }

  // (ส่วน 7. handleNoShowTickets - แก้ Bug 'null')
  @Cron('*/5 * * * *')
  async handleNoShowTickets() {
    const now = new Date();
    const reservedTickets = await this.prisma.ticket.findMany({
      where: {
        status: TicketStatus.RESERVED,
        checkinAt: null,
      },
      select: {
        id: true,
        spaceId: true,
        reservationStartTime: true,
        prePaidDurationMinutes: true,
      },
    });
    if (reservedTickets.length === 0) {
      return;
    }
    const ticketsToCancel: (typeof reservedTickets[0])[] = [];
    for (const ticket of reservedTickets) {
      if (!ticket.reservationStartTime) {
        this.logger.warn(
          `Skipping No-Show check for Ticket ${ticket.id}: missing reservationStartTime`,
        );
        continue;
      }
      const expirationTime = new Date(
        ticket.reservationStartTime.getTime() +
          ticket.prePaidDurationMinutes * 60 * 1000,
      );
      if (now > expirationTime) {
        ticketsToCancel.push(ticket);
      }
    }
    if (ticketsToCancel.length === 0) {
      return;
    }
    this.logger.warn(
      `No-Show check: Found ${ticketsToCancel.length} tickets for cancellation.`,
    );
    for (const ticket of ticketsToCancel) {
      await this.prisma.$transaction(async (prisma) => {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.NO_SHOW,
            cancellationReason: `No check-in within ${ticket.prePaidDurationMinutes} minutes.`,
          },
        });
        await prisma.space.update({
          where: { id: ticket.spaceId },
          data: { status: 'AVAILABLE', currentTicketId: null },
        });
      });
    }
  }

  // (ส่วน 8. handleOverstaying - แก้ Bug PENDING_VACATE)
  @Cron('* * * * *')
  async handleOverstaying() {
    const GRACE_PERIOD_MINUTES = this.getGracePeriodMinutes();
    const expirationTime = new Date(
      Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000,
    );
    const overstayingTickets = await this.prisma.ticket.findMany({
      where: {
        status: TicketStatus.PAID,
        gracePeriodStartedAt: { lt: expirationTime },
      },
      include: {
        space: {
          select: { id: true }
        }
      }
    });
    if (overstayingTickets.length === 0) {
      return;
    }
    this.logger.warn(
      `Overstay check: Found ${overstayingTickets.length} overstaying tickets. Reverting to PARKED.`,
    );
    for (const ticket of overstayingTickets) {
      this.logger.log(
        `[GATE] Ticket ${ticket.id} overstayed grace period. Closing barrier. Reverting to PARKED.`,
      );
      await this.prisma.$transaction(async (prisma) => {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.PARKED,
            gracePeriodStartedAt: null,
            checkoutAt: null,
          },
        });
        await prisma.space.update({
          where: { id: ticket.spaceId },
          data: {
            status: 'OCCUPIED'
          }
        });
      });
    }
  }

  // (ส่วน 9. handlePendingReservations - เหมือนเดิม)
  @Cron('* * * * *')
  async handlePendingReservations() {
    const PENDING_RESERVATION_TIMEOUT_MINUTES = 15;
    const expirationTime = new Date(
      Date.now() - PENDING_RESERVATION_TIMEOUT_MINUTES * 60 * 1000,
    );
    const pendingTickets = await this.prisma.ticket.findMany({
      where: {
        status: TicketStatus.PENDING_PAYMENT,
        checkinAt: null,
        createdAt: { lt: expirationTime },
      },
      select: { id: true, spaceId: true },
    });
    if (pendingTickets.length === 0) {
      return;
    }
    this.logger.warn(
      `Pending Reservation check: Found ${pendingTickets.length} pending reservations that timed out.`,
    );
    for (const ticket of pendingTickets) {
      await this.prisma.$transaction(async (prisma) => {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.NO_SHOW,
            cancellationReason:
              'Failed to pay reservation fee within 15 minutes.',
          },
        });
        await prisma.space.update({
          where: { id: ticket.spaceId },
          data: { status: 'AVAILABLE', currentTicketId: null },
        });
      });
    }
  }
}