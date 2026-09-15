/**
 * Dữ liệu mẫu tối thiểu (Phase 1). Phase 10 mở rộng thành bộ demo 3 tuần
 * (2 dự án, 6 người, ~80 task, lịch bận, giờ thực tế) theo docs/04-kien-truc/08 §5.
 * Chạy: npm run db:seed (idempotent — chạy lại không tạo trùng).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Demo@1234', 12);
  const users = [
    { email: 'lan@smarttask.local', fullName: 'Nguyễn Thị Lan', shortName: 'Lan' },
    { email: 'minh@smarttask.local', fullName: 'Trần Quang Minh', shortName: 'Minh' },
    { email: 'huy@smarttask.local', fullName: 'Lê Đức Huy', shortName: 'Huy' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  console.log(`Seed: ${users.length} tài khoản demo (mật khẩu Demo@1234)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
