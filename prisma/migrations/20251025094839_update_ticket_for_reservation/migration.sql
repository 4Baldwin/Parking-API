/*
  Warnings:

  - The values [HOLD,OVERDUE] on the enum `SpaceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('RESERVED', 'PARKED', 'COMPLETED', 'NO_SHOW');

-- AlterEnum
BEGIN;
CREATE TYPE "SpaceStatus_new" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED');
ALTER TABLE "public"."Space" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Space" ALTER COLUMN "status" TYPE "SpaceStatus_new" USING ("status"::text::"SpaceStatus_new");
ALTER TYPE "SpaceStatus" RENAME TO "SpaceStatus_old";
ALTER TYPE "SpaceStatus_new" RENAME TO "SpaceStatus";
DROP TYPE "public"."SpaceStatus_old";
ALTER TABLE "Space" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "currentTicketId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "amountDue" DECIMAL(10,2),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "pricePaidOnReservation" DECIMAL(10,2) NOT NULL DEFAULT 15.00,
ADD COLUMN     "reservationStartTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "TicketStatus" NOT NULL DEFAULT 'RESERVED',
ADD COLUMN     "totalParkingFee" DECIMAL(10,2),
ALTER COLUMN "checkinAt" DROP NOT NULL,
ALTER COLUMN "checkinAt" DROP DEFAULT;
