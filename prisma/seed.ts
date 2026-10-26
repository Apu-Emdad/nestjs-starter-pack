/**
 * Seed script
 *
 * Creates the roles the app needs, the example teams, then the first super admin (user name "admin", email
 * "admin@example.com", password "12345678"). Safe to run again: it creates only what is
 * missing. Run it with `yarn db:seed`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { ROLE } from '../src/common/constants/roles.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Department } from '../src/generated/prisma/enums.js';

const SUPER_ADMIN_USER_NAME = 'admin';
const SUPER_ADMIN_EMAIL = 'admin@example.com';
const SUPER_ADMIN_PASSWORD = '12345678';

const TEAMS = [
  { name: 'Frontend', department: Department.ENGINEERING },
  { name: 'Backend', department: Department.ENGINEERING },
  { name: 'Platform', department: Department.ENGINEERING },
  { name: 'Product design', department: Department.DESIGN },
  { name: 'Brand', department: Department.DESIGN },
  { name: 'Inbound sales', department: Department.SALES },
  { name: 'Outbound sales', department: Department.SALES },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL ?? ''),
  });

  try {
    // 1. creating the roles
    for (const name of Object.values(ROLE)) {
      await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    // 2. creating the example teams
    for (const team of TEAMS) {
      await prisma.team.upsert({
        where: { name: team.name },
        update: {},
        create: team,
      });
    }

    // 3. skipping the super admin when the user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ userName: SUPER_ADMIN_USER_NAME }, { email: SUPER_ADMIN_EMAIL }],
      },
      select: { uid: true },
    });

    if (existing) {
      console.log(
        `Super admin seed skipped: "${SUPER_ADMIN_USER_NAME}" or "${SUPER_ADMIN_EMAIL}" exists`,
      );
      return;
    }

    // 4. creating the super admin
    await prisma.user.create({
      data: {
        userName: SUPER_ADMIN_USER_NAME,
        email: SUPER_ADMIN_EMAIL,
        passwordHash: await argon2.hash(SUPER_ADMIN_PASSWORD),
        roleInfo: { connect: { name: ROLE.SUPER_ADMIN } },
      },
    });

    console.log(`Super admin "${SUPER_ADMIN_USER_NAME}" created`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
