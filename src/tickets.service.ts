// src/tickets.service.ts

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { TicketStatus } from '@prisma/client';
import { CheckinDto } from './dto/checkin.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class TicketsService {
    private readonly logger = new Logger(TicketsService.name);

    constructor(private prisma: PrismaService) {}

    // ----------------------------------------------------------------------
    // 0. ตรรกะ Create Reservation (เริ่มการจอง 15 บาท)
    // ----------------------------------------------------------------------
    async createReservation(dto: CreateReservationDto, userId: string) { // <-- เพิ่ม userId
        const space = await this.prisma.space.findUnique({ where: { id: dto.spaceId } });
        if (!space) { throw new NotFoundException(`Space with ID ${dto.spaceId} not found.`); }
        if (space.status !== 'AVAILABLE') { throw new BadRequestException(`Space ${space.code} is currently ${space.status}.`); }

        const reservationFee = 15.00;

        return this.prisma.$transaction(async (prisma) => {
            const newTicket = await prisma.ticket.create({
                data: {
                    spaceId: dto.spaceId,
                    vehiclePlate: dto.vehiclePlate.toUpperCase(),
                    status: TicketStatus.PENDING_PAYMENT,
                    pricePaidOnReservation: 0,
                    amountDue: reservationFee,
                    reservationStartTime: null,
                    userId: userId, // <-- ผูก userId
                },
            });

            // ล็อกช่องจอดชั่วคราว
            await prisma.space.update({
                where: { id: dto.spaceId },
                data: {
                    status: 'RESERVED',
                    currentTicketId: newTicket.id
                },
            });

            this.logger.log(`New reservation intent created by User ${userId}: Ticket ${newTicket.id}. Awaiting 15 THB payment.`);

            return {
                ticketId: newTicket.id,
                spaceCode: space.code,
                vehiclePlate: newTicket.vehiclePlate,
                amountDue: reservationFee,
                qrCodeUrl: `PAYMENT_QR_CODE_FOR_15.00_BAHT`
            };
        });
    }

    // ----------------------------------------------------------------------
    // 1. ตรรกะยืนยันการจอง (Webhook 15 บาท)
    // ----------------------------------------------------------------------
    async confirmReservationPayment(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) { throw new NotFoundException('Ticket not found'); }
        if (ticket.status !== TicketStatus.PENDING_PAYMENT || ticket.checkinAt !== null) {
            throw new BadRequestException(`Ticket status is ${ticket.status}. Cannot confirm reservation payment.`);
        }

        await this.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                status: TicketStatus.RESERVED,
                reservationStartTime: new Date(), // <-- เริ่มนับ 60 นาที NO_SHOW ณ บัดนี้
                pricePaidOnReservation: 15.00,
                amountDue: 0,
            },
        });

        this.logger.log(`Reservation for Ticket ${ticketId} confirmed. 60 minute No-Show clock started.`);
        return { message: 'Reservation successful. Ready for check-in.' };
    }

    // ----------------------------------------------------------------------
    // (ใหม่) ตรรกะดึงข้อมูลตั๋วตาม ID
    // ----------------------------------------------------------------------
    async getTicketById(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                space: {
                    select: {
                        id: true,
                        code: true,
                        zone: {
                            select: {
                                id: true,
                                name: true,
                                lot: {
                                    select: {
                                        id: true,
                                        name: true,
                                    }
                                }
                            }
                        }
                    }
                },
                user: { // <-- Include user info (excluding password)
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${ticketId} not found.`);
        }

        // Clean up Decimal types if needed before returning
        // const responseTicket = { ...ticket };
        // if (responseTicket.totalParkingFee) responseTicket.totalParkingFee = responseTicket.totalParkingFee.toNumber();
        // if (responseTicket.amountDue) responseTicket.amountDue = responseTicket.amountDue.toNumber();
        // responseTicket.pricePaidOnReservation = responseTicket.pricePaidOnReservation.toNumber();


        return ticket; // คืนค่าตั๋วที่รวมข้อมูล Space, Zone, Lot, User
    }


    // ----------------------------------------------------------------------
    // 2. ตรรกะ Check-in (สแกนเข้าจอด)
    // ----------------------------------------------------------------------
    async checkIn(ticketId: string, checkinDto: CheckinDto) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, include: { space: true } });
        if (!ticket) { throw new NotFoundException(`Ticket with ID ${ticketId} not found.`); }
        if (ticket.status !== TicketStatus.RESERVED) { throw new BadRequestException(`Ticket status is '${ticket.status}'. Must be RESERVED.`); }
        if (ticket.vehiclePlate !== checkinDto.vehiclePlate) { throw new BadRequestException('Vehicle plate does not match.'); }
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


    // ----------------------------------------------------------------------
    // 3. Helper: คำนวณค่าบริการทั้งหมด (3-Tier Pricing)
    // ----------------------------------------------------------------------
    private calculateTotalFee(checkInTime: Date, checkOutTime: Date): number {
        // (โค้ด 3-Tier Pricing เดิม)
        const durationMs = checkOutTime.getTime() - checkInTime.getTime();
        const totalMinutes = Math.ceil(durationMs / (1000 * 60));
        if (totalMinutes <= 0) { return 15.00; }
        const TIER1_LIMIT_MINUTES = 120;
        const TIER2_LIMIT_MINUTES = 360;
        const TIER1_RATE_PER_30_MIN = 15.00;
        const TIER2_RATE_PER_60_MIN = 5.00;
        const TIER3_RATE_PER_120_MIN = 5.00;
        let totalFee = 0;
        if (totalMinutes <= TIER1_LIMIT_MINUTES) {
            const blocks = Math.ceil(totalMinutes / 30);
            totalFee = blocks * TIER1_RATE_PER_30_MIN;
            return Math.max(totalFee, 15.00);
        }
        totalFee += (TIER1_LIMIT_MINUTES / 30) * TIER1_RATE_PER_30_MIN;
        if (totalMinutes <= TIER2_LIMIT_MINUTES) {
            const minutesInTier2 = totalMinutes - TIER1_LIMIT_MINUTES;
            const blocks = Math.ceil(minutesInTier2 / 60);
            totalFee += blocks * TIER2_RATE_PER_60_MIN;
            return totalFee;
        }
        const minutesInTier2 = TIER2_LIMIT_MINUTES - TIER1_LIMIT_MINUTES;
        totalFee += (minutesInTier2 / 60) * TIER2_RATE_PER_60_MIN;
        const minutesInTier3 = totalMinutes - TIER2_LIMIT_MINUTES;
        const blocks = Math.ceil(minutesInTier3 / 120);
        totalFee += blocks * TIER3_RATE_PER_120_MIN;
        return totalFee;
    }


    // ----------------------------------------------------------------------
    // 4. ตรรกะ Check-out (เริ่มการชำระเงิน)
    // ----------------------------------------------------------------------
    async checkOut(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket || !ticket.checkinAt) { throw new NotFoundException('Ticket not found or has not checked in.'); }
        if (ticket.status !== TicketStatus.PARKED && ticket.status !== TicketStatus.OVERSTAYING) {
            throw new BadRequestException(`Ticket status is ${ticket.status}. Cannot initiate checkout.`);
        }

        const checkOutTime = new Date();
        const totalFee = this.calculateTotalFee(ticket.checkinAt, checkOutTime);
        const amountPaidInReservation = ticket.pricePaidOnReservation.toNumber();

        const amountDue = totalFee - amountPaidInReservation;
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
            // ถ้าไม่มียอดค้างชำระ (เช่น จอดไม่ถึง 30 นาที)
            return this.confirmPayment(ticketId);
        }

        return {
            ticketId: ticket.id,
            totalParkingFee: totalFee,
            amountPaid: amountPaidInReservation,
            amountDue: finalAmountDue,
            qrCodeUrl: `PAYMENT_QR_CODE_FOR_${finalAmountDue.toFixed(2)}_BAHT`,
        };
    }

    // ----------------------------------------------------------------------
    // 5. ตรรกะยืนยันการชำระเงิน (Webhook ตอนออก)
    // ----------------------------------------------------------------------
    async confirmPayment(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) { throw new NotFoundException('Ticket not found'); }
        if (ticket.status !== TicketStatus.PENDING_PAYMENT || ticket.checkinAt === null) {
            throw new BadRequestException(`Ticket status is ${ticket.status}. Cannot confirm exit payment.`);
        }
        await this.prisma.$transaction(async (prisma) => {
            await prisma.ticket.update({
                where: { id: ticketId },
                data: {
                    status: TicketStatus.PAID,
                    gracePeriodStartedAt: new Date(), // <-- เริ่มจับเวลา Grace Period
                    amountDue: 0,
                },
            });
            await prisma.space.update({
                where: { id: ticket.spaceId },
                data: { status: 'PENDING_VACATE' },
            });
        });
        this.logger.log(`[GATE] Payment confirmed for ${ticketId}. Opening barrier. ${this.getGracePeriodMinutes()} minute grace period starts.`);
        return { message: `Payment successful. Barrier open. Please exit within ${this.getGracePeriodMinutes()} minutes.` };
    }

    // ----------------------------------------------------------------------
    // 6. ตรรกะยืนยันว่ารถออกแล้ว (Sensor)
    // ----------------------------------------------------------------------
    async confirmVacant(spaceId: string) {
        const space = await this.prisma.space.findUnique({ where: { id: spaceId } });
        if (!space) { throw new NotFoundException('Space not found'); }
        if (space.status !== 'PENDING_VACATE') {
            this.logger.warn(`Sensor signal received for space ${spaceId}, but status is ${space.status}. Ignoring.`);
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
        this.logger.log(`[SENSOR] Space ${spaceId} is vacant. Barrier closing. Returning to AVAILABLE.`);
        return { message: 'Space confirmed vacant. Barrier closed.' };
    }

    // ----------------------------------------------------------------------
    // Helper function to get Grace Period for Overstaying
    // ----------------------------------------------------------------------
    private getGracePeriodMinutes(): number {
        return 5; // <-- ตั้งค่า Grace Period ที่นี่ (5 นาที)
    }

    // ----------------------------------------------------------------------
    // 7. (Cron Job 1) ตรรกะจัดการ "No-Show" (60 นาที)
    // ----------------------------------------------------------------------
    @Cron('*/5 * * * *') // รันทุก 5 นาที
    async handleNoShowTickets() {
        const GRACE_PERIOD_MINUTES = 60;
        const expirationTime = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000);
        const noShowTickets = await this.prisma.ticket.findMany({
            where: {
                status: TicketStatus.RESERVED,
                reservationStartTime: { lt: expirationTime },
            },
            select: { id: true, spaceId: true },
        });
        if (noShowTickets.length === 0) {
            this.logger.log('No-Show check: No overdue reservations found.');
            return;
        }
        this.logger.warn(`No-Show check: Found ${noShowTickets.length} tickets for cancellation.`);
        for (const ticket of noShowTickets) {
            await this.prisma.$transaction(async (prisma) => {
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: { status: TicketStatus.NO_SHOW, cancellationReason: 'No check-in within 60 minutes.' },
                });
                await prisma.space.update({
                    where: { id: ticket.spaceId },
                    data: { status: 'AVAILABLE', currentTicketId: null },
                });
            });
        }
    }

    // ----------------------------------------------------------------------
    // 8. (Cron Job 2) ตรรกะจัดการ "จอดแช่" (5 นาที)
    // ----------------------------------------------------------------------
    @Cron('* * * * *') // รันทุกนาที
    async handleOverstaying() {
        const GRACE_PERIOD_MINUTES = this.getGracePeriodMinutes(); // <-- ใช้ค่าจาก helper function (5 นาที)
        const expirationTime = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000); // 5 นาทีที่แล้ว
        const overstayingTickets = await this.prisma.ticket.findMany({
            where: {
                status: TicketStatus.PAID,
                gracePeriodStartedAt: { lt: expirationTime },
            },
        });
        if (overstayingTickets.length === 0) { return; }
        this.logger.warn(`Overstay check: Found ${overstayingTickets.length} overstaying tickets.`);
        for (const ticket of overstayingTickets) {
            this.logger.log(`[GATE] Ticket ${ticket.id} overstayed grace period. Closing barrier.`);
            await this.prisma.ticket.update({
                where: { id: ticket.id },
                data: { status: TicketStatus.OVERSTAYING },
            });
        }
    }

    // ----------------------------------------------------------------------
    // 9. (Cron Job 3) ตรรกะจัดการ "รอจ่าย 15 บาท" นานเกินไป (15 นาที)
    // ----------------------------------------------------------------------
    @Cron('* * * * *') // รันทุกนาที
    async handlePendingReservations() {
        const PENDING_RESERVATION_TIMEOUT_MINUTES = 15;
        const expirationTime = new Date(Date.now() - PENDING_RESERVATION_TIMEOUT_MINUTES * 60 * 1000);

        const pendingTickets = await this.prisma.ticket.findMany({
            where: {
                status: TicketStatus.PENDING_PAYMENT,
                checkinAt: null, // <-- กรองเฉพาะตั๋วที่ยังไม่ Check-in
                createdAt: { lt: expirationTime },
            },
            select: { id: true, spaceId: true },
        });

        if (pendingTickets.length === 0) { return; }

        this.logger.warn(`Pending Reservation check: Found ${pendingTickets.length} pending reservations that timed out.`);
        for (const ticket of pendingTickets) {
            await this.prisma.$transaction(async (prisma) => {
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        status: TicketStatus.NO_SHOW,
                        cancellationReason: 'Failed to pay 15 THB reservation fee within 15 minutes.'
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