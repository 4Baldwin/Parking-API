// src/spaces.controller.ts

import { Controller, Get, Query, Post, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ApiOkResponse, ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'; // <-- 1. แก้ไขบรรทัดนี้
import { SpaceQueryDto } from './dto/space-query.dto';
import { TicketsService } from './tickets.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Spaces')
@Controller('api/spaces')
export class SpacesController {
  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List of parking spaces' })
  async list(@Query() q: SpaceQueryDto) {
    // ... (โค้ด list เหมือนเดิม) ...
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

  @Post('confirm-vacant/:id')
  @ApiOperation({ summary: 'Confirm vacant (Called by Sensor)' }) // <-- 2. ตอนนี้จะหาเจอแล้ว
  async confirmVacant(@Param('id') spaceId: string) {
    return this.ticketsService.confirmVacant(spaceId);
  }
}