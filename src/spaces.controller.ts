// src/spaces.controller.ts

import { Controller, Get, Query, Post, Param } from '@nestjs/common'; // <--- เพิ่ม Post, Param
import { PrismaService } from './prisma.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SpaceQueryDto } from './dto/space-query.dto';
import { TicketsService } from './tickets.service'; // <--- เพิ่ม Import TicketsService

@ApiTags('spaces')
@Controller('spaces')
export class SpacesController {
  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService, // <--- เพิ่ม Inject TicketsService
  ) {}

  /**
   * (เดิม) Endpoiont สำหรับดูรายการช่องจอด
   * GET /spaces
   */
  @Get()
  @ApiOkResponse({ /* ... */ })
  async list(@Query() q: SpaceQueryDto) {
    // ... (โค้ดเดิมของคุณ)
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.zone_id) where.zoneId = q.zone_id;

    const skip = (q.page - 1) * q.page_size;
    const take = q.page_size;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.space.findMany({
        where,
        skip,
        take,
        select: { id: true, code: true, zoneId: true, status: true },
        orderBy: [{ zoneId: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.space.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / q.page_size));

    return {
      data: items,
      meta: {
        page: q.page,
        page_size: q.page_size,
        total_items: total,
        total_pages: totalPages,
      },
    };
  }

  /**
   * (ใหม่) Endpoiont สำหรับ Sensor เพื่อยืนยันว่ารถออกจากช่องจอดแล้ว
   * POST /spaces/confirm-vacant/:id
   */
  @Post('confirm-vacant/:id')
  async confirmVacant(@Param('id') spaceId: string) {
    // Endpoint นี้ควรถูกเรียกโดย Hardware Sensor เท่านั้น
    return this.ticketsService.confirmVacant(spaceId);
  }
}