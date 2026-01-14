#!/usr/bin/env tsx
/**
 * Quick Admin User Creator
 * 
 * Usage:
 *   npx tsx scripts/quickAdmin.ts admin@example.com MySecurePass123 "Admin Name"
 * 
 * Creates an admin user without interactive prompts.
 * For interactive mode, use: npm run create-admin
 */

import bcrypt from "bcrypt";
import { prisma } from "../src/db";

async function quickCreateAdmin(email: string, password: string, name?: string) {
  try {
    // Check if user exists
    const existing = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existing) {
      console.error(`❌ Admin user "${email}" already exists`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        active: true,
      },
    });

    console.log("✅ Admin user created:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name || "(none)"}`);
    console.log(`   ID: ${admin.id}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const [, , email, password, name] = process.argv;

if (!email || !password) {
  console.error("Usage: npx tsx scripts/quickAdmin.ts <email> <password> [name]");
  console.error("\nExample:");
  console.error('  npx tsx scripts/quickAdmin.ts admin@redember.com SecurePass123 "Admin User"');
  console.error("\nFor interactive mode with validation, use:");
  console.error("  npm run create-admin");
  process.exit(1);
}

quickCreateAdmin(email, password, name);
