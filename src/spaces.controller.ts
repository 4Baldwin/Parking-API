import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SpaceQueryDto } from './dto/space-query.dto';

@ApiTags('spaces')
@Controller('spaces')
export class SpacesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({
    description: 'List spaces with optional filters & pagination',
    schema: {
      example: {
        data: [
          { id: 'cmh...', code: 'A1', zoneId: 'cmh...', status: 'AVAILABLE' },
          { id: 'cmh...', code: 'A2', zoneId: 'cmh...', status: 'OCCUPIED' }
        ],
        meta: { page: 1, page_size: 10, total_items: 42, total_pages: 5 }
      }
    }
  })
  async list(@Query() q: SpaceQueryDto) {
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
}