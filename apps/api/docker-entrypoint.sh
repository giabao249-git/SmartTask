#!/bin/sh
set -e

echo "🔄 Running Prisma migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "🔍 Checking if database needs initial seed..."
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.user.count()
    .then((count) => {
      process.stdout.write(String(count));
      return prisma.\$disconnect();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "🌱 Database is empty (0 users). Running seed..."
  npm run prisma:seed
  echo "✅ Seed completed."
else
  echo "⏭️  Database already has $USER_COUNT user(s). Skipping seed."
fi

echo "🚀 Starting SmartTask API..."
exec node dist/src/main
