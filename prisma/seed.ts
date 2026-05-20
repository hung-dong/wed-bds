import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('123456', 10);
  const staffPassword = await bcrypt.hash('123456', 10);

  await prisma.transaction.deleteMany();
  await prisma.task.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.property.deleteMany();

  await prisma.user.upsert({
    where: { email: 'admin@anhhung.vn' },
    update: {},
    create: { email: 'admin@anhhung.vn', name: 'Dương Xuân Hùng', password: adminPassword, role: 'ADMIN' },
  });

  await prisma.user.upsert({
    where: { email: 'staff@anhhung.vn' },
    update: {},
    create: { email: 'staff@anhhung.vn', name: 'Nhân viên kinh doanh', password: staffPassword, role: 'STAFF' },
  });

  await prisma.property.createMany({
    data: [
      {
        title: 'Lô đất thổ cư',
        address: 'Đường Bùi Dự, Pleiku, Gia Lai',
        status: 'AVAILABLE',
        legalStatus: 'Sổ đỏ',
        value: 1500000000,
      },
      {
        title: 'Nhà phố trung tâm',
        address: 'Phường Pleiku, Gia Lai',
        status: 'NEGOTIATING',
        legalStatus: 'Hợp đồng mua bán',
        value: 2300000000,
      },
    ],
  });

  await prisma.lead.createMany({
    data: [
      { name: 'Nguyễn Văn A', phone: '0901234567', status: 'NEW' },
      { name: 'Trần Thị B', phone: '0912345678', status: 'FOLLOW_UP' },
    ],
  });

  await prisma.task.createMany({
    data: [
      { title: 'Kiểm tra quy hoạch khu đất Pleiku', urgency: 5, value: 4 },
      { title: 'Làm việc với khách chốt cọc', urgency: 4, value: 5 },
      { title: 'Cập nhật công nợ trong ngày', urgency: 3, value: 4 },
    ],
  });

  await prisma.transaction.createMany({
    data: [
      { amount: 50000000, type: 'INCOME', note: 'Tiền cọc đất' },
      { amount: 12000000, type: 'EXPENSE', note: 'Chi phí marketing' },
    ],
  });

  console.log('Database seeded successfully.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
