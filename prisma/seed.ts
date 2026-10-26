/**
 * Seed script
 *
 * Creates the roles the app needs, the example teams and employees, then the first super admin (user name "admin", email
 * "admin@example.com", password "12345678"). Safe to run again: it creates only what is
 * missing. Run it with `yarn db:seed`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
import { ROLE } from '../src/common/constants/roles.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Department, EmploymentType } from '../src/generated/prisma/enums.js';

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

const EMPLOYEE_COUNT = 40;
const FIRST_NAMES = [
  'Maya',
  'Arjun',
  'Sofia',
  'Liam',
  'Aisha',
  'Noah',
  'Mei',
  'Omar',
  'Elena',
  'Kai',
  'Zara',
  'Ravi',
  'Nina',
  'Leo',
  'Hana',
  'Sam',
  'Ivy',
  'Tariq',
  'Lucia',
  'Ethan',
];
const LAST_NAMES = [
  'Rodriguez',
  'Patel',
  'Nguyen',
  'Okafor',
  'Silva',
  'Khan',
  'Berg',
  'Costa',
  'Ahmed',
  'Moreau',
  'Tanaka',
  'Ivanov',
  'Haddad',
  'Rossi',
  'Kim',
  'Novak',
  'Santos',
  'Cohen',
  'Dubois',
  'Walker',
];
const SKILLS = {
  [Department.ENGINEERING]: ['React', 'Node', 'TypeScript', 'SQL', 'Docker'],
  [Department.DESIGN]: ['Figma', 'Branding', 'UX research', 'Illustration'],
  [Department.SALES]: ['Negotiation', 'CRM', 'Outreach', 'Presentations'],
};

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
    const teams = [];
    for (const team of TEAMS) {
      teams.push(
        await prisma.team.upsert({
          where: { name: team.name },
          update: {},
          create: team,
        }),
      );
    }

    // 3. creating the example employees
    const passwordHash = await argon2.hash(SUPER_ADMIN_PASSWORD);
    const employmentTypes = Object.values(EmploymentType);

    for (let i = 0; i < EMPLOYEE_COUNT; i++) {
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[(i + 5 * Math.floor(i / 20)) % LAST_NAMES.length];
      const userName = `${first}_${last}`.toLowerCase();
      const team = teams[i % teams.length];
      const skills = SKILLS[team.department];

      const user = await prisma.user.findUnique({
        where: { userName },
        select: { id: true },
      });

      if (user) continue;

      await prisma.employee.create({
        data: {
          fullName: `${first} ${last}`,
          bio: i % 2 === 0 ? `${team.name} team member.` : null,
          salary: 2500 + (i % 14) * 450,
          skills: [skills[i % skills.length], skills[(i + 1) % skills.length]],
          employmentType: employmentTypes[i % employmentTypes.length],
          joinDate: new Date(
            dayjs()
              .subtract(15 + i * 27, 'day')
              .format('YYYY-MM-DD'),
          ),
          isRemote: i % 3 === 0,
          teamInfo: { connect: { id: team.id } },
          userInfo: {
            create: {
              userName,
              email: `${first}.${last}@example.com`.toLowerCase(),
              passwordHash,
              roleInfo: { connect: { name: ROLE.USER } },
            },
          },
        },
      });
    }

    // 4. skipping the super admin when the user already exists
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

    // 5. creating the super admin
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
