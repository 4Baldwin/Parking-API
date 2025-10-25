import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 ล้างข้อมูลเก่าทั้งหมด...');
  await prisma.space.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.parkingLot.deleteMany();

  console.log('🚗 กำลังสร้างข้อมูลใหม่...');

  // ✅ สร้าง ParkingLot หลัก
  const lot = await prisma.parkingLot.create({
    data: { name: 'Main Lot' },
  });

  // ✅ สร้าง Zone ตัวอย่าง
  const zoneA = await prisma.zone.create({
    data: {
      name: 'A',
      lotId: lot.id,
    },
  });

  // ✅ สร้างช่องจอด 10 ช่อง
  const spaces = Array.from({ length: 10 }).map((_, i) => ({
    code: `A${i + 1}`,
    zoneId: zoneA.id,
  }));

  await prisma.space.createMany({ data: spaces });

  console.log('✅ สร้างข้อมูลเสร็จสิ้น');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
