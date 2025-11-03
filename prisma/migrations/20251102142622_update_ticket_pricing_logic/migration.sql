/*
  Warnings:

  - You are about to drop the column `pricePaidOnReservation` on the `Ticket` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "pricePaidOnReservation",
ADD COLUMN     "cumulativePaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "prePaidDurationMinutes" INTEGER NOT NULL DEFAULT 30,
ALTER COLUMN "amountDue" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "totalParkingFee" SET DATA TYPE DECIMAL(65,30);
