-- AlterEnum
ALTER TYPE "SpaceStatus" ADD VALUE 'PENDING_VACATE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "TicketStatus" ADD VALUE 'PAID';
ALTER TYPE "TicketStatus" ADD VALUE 'OVERSTAYING';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "gracePeriodStartedAt" TIMESTAMP(3);
