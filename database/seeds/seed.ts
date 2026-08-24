import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PERMISSIONS, ROLES, DEFAULT_ROLE_PERMISSIONS } from '@alkabeer/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting deterministic seed process for ALKABEER VIP WEB...');

  // 1. Seed Permissions
  console.log('🔑 Seeding system permissions...');
  const permissionEntries = Object.entries(PERMISSIONS);
  for (const [nameKey, key] of permissionEntries) {
    const module = key.split('.')[0];
    await prisma.permission.upsert({
      where: { key },
      update: { module },
      create: {
        key,
        name: nameKey.replace(/_/g, ' '),
        module,
        description: `Allows action: ${key}`,
      },
    });
  }
  console.log(`✅ Seeded ${permissionEntries.length} permissions.`);

  // 2. Seed Roles & Role Permissions
  console.log('🛡️  Seeding default RBAC roles...');
  for (const [roleKey, roleName] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `Standard system role: ${roleName}`,
      },
    });

    const allowedPermissions = DEFAULT_ROLE_PERMISSIONS[roleKey as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
    for (const permKey of allowedPermissions) {
      const perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }
  console.log('✅ Seeded default roles and permission mappings.');

  // 3. Seed Default Telecom Companies
  console.log('📱 Seeding default telecom companies...');
  const defaultCompanies = [
    { name: 'Vodafone Egypt', code: 'VODAFONE', color: '#E60000', paymentDay: 1 },
    { name: 'Orange Egypt', code: 'ORANGE', color: '#FF7900', paymentDay: 1 },
    { name: 'Etisalat Egypt', code: 'ETISALAT', color: '#7EB105', paymentDay: 1 },
    { name: 'Telecom Egypt (WE)', code: 'WE', color: '#5B2C82', paymentDay: 1 },
  ];

  for (const comp of defaultCompanies) {
    await prisma.company.upsert({
      where: { code: comp.code },
      update: { name: comp.name, color: comp.color, paymentDay: comp.paymentDay },
      create: comp,
    });
  }
  console.log('✅ Seeded default telecom companies.');

  // 4. Seed Default Treasury Accounts
  console.log('🏦 Seeding default treasury accounts...');
  const defaultAccounts = [
    { name: 'الخزينة الرئيسية (كاش)', type: 'CASH' as const, openingBalance: 0, currentBalance: 0 },
    { name: 'الحساب البنكي (CIB / الأهلي)', type: 'BANK' as const, openingBalance: 0, currentBalance: 0 },
    { name: 'محفظة كاش إلكترونية (فودافون كاش)', type: 'WALLET' as const, openingBalance: 0, currentBalance: 0 },
  ];

  for (const acc of defaultAccounts) {
    await prisma.treasuryAccount.upsert({
      where: { name: acc.name },
      update: { type: acc.type },
      create: acc,
    });
  }
  console.log('✅ Seeded default treasury accounts.');

  // 5. Seed Default Expense Categories
  console.log('📁 Seeding default expense categories...');
  const defaultCategories = [
    { name: 'إيجار المقر', description: 'إيجار الفروع والمقرات الشهرية' },
    { name: 'رواتب وبدلات', description: 'رواتب الموظفين والبدلات' },
    { name: 'فواتير ومرافق', description: 'كهرباء، مياه، إنترنت' },
    { name: 'صيانة وتجهيزات', description: 'مصاريف صيانة وأجهزة' },
    { name: 'مصاريف عمومية وإدارية', description: 'نثريات ومطبوعات ومستلزمات مكتبية' },
  ];

  for (const cat of defaultCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: cat,
    });
  }
  console.log('✅ Seeded default expense categories.');

  // 6. Seed Super Admin User (Conditional on ENV variables)
  const adminUsername = process.env.SEED_ADMIN_USERNAME;
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminFullName = process.env.SEED_ADMIN_FULLNAME || 'System Administrator';

  if (adminUsername && adminEmail && adminPassword) {
    console.log(`👤 Seeding Super Admin user from environment [${adminUsername}]...`);
    const passwordHash = await argon2.hash(adminPassword);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: adminUsername },
          { email: adminEmail },
        ],
      },
    });

    let adminUser;
    if (existingUser) {
      adminUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          username: adminUsername,
          email: adminEmail,
          fullName: adminFullName,
          passwordHash,
          status: 'ACTIVE',
        },
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          username: adminUsername,
          email: adminEmail,
          fullName: adminFullName,
          passwordHash,
          status: 'ACTIVE',
        },
      });
    }

    const adminRole = await prisma.role.findUnique({ where: { name: ROLES.ADMIN } });
    if (adminRole) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: adminUser.id,
            roleId: adminRole.id,
          },
        },
        update: {},
        create: {
          userId: adminUser.id,
          roleId: adminRole.id,
          assignedBy: 'SYSTEM_SEED',
        },
      });
    }
    console.log(`✅ Super Admin user [${adminUsername}] seeded successfully.`);
  } else {
    console.log(
      'ℹ️  Skipping Super Admin user creation: SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD not set in environment.'
    );
  }

  console.log('🎉 Deterministic seed process completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
