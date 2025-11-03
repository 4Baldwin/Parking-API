/*
  Warnings:

  - You are about to alter the column `amountDue` on the `Ticket` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `totalParkingFee` on the `Ticket` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "amountDue" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "totalParkingFee" SET DATA TYPE DECIMAL(10,2);
