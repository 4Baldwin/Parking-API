import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { SpacesController } from './spaces.controller';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [],
  controllers: [AppController, SpacesController, TicketsController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
