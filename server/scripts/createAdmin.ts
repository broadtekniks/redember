#!/usr/bin/env tsx
/**
 * Create Admin User Script
 *
 * Usage:
 *   npm run create-admin
 *   or
 *   npx tsx scripts/createAdmin.ts
 *
 * Interactive prompts for email, password, and name.
 * Creates a new admin user with hashed password.
 */

import bcrypt from "bcrypt";
import { prisma } from "../src/db";
import * as readline from "readline";

interface AdminInput {
  email: string;
  password: string;
  name?: string;
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function questionHidden(
  rl: readline.Interface,
  query: string
): Promise<string> {
  return new Promise((resolve) => {
    // Hide password input
    const stdin = process.stdin;
    (stdin as any).setRawMode?.(true);

    process.stdout.write(query);
    let password = "";

    stdin.on("data", function onData(char: Buffer) {
      const charStr = char.toString("utf8");

      switch (charStr) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl-D
          stdin.removeListener("data", onData);
          (stdin as any).setRawMode?.(false);
          process.stdout.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl-C
          process.exit(0);
          break;
        case "\u007F": // Backspace
        case "\b":
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write("\b \b");
          }
          break;
        default:
          if (charStr.charCodeAt(0) >= 32) {
            password += charStr;
            process.stdout.write("*");
          }
          break;
      }
    });
  });
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }
  return { valid: true };
}

async function createAdminUser(input: AdminInput): Promise<void> {
  const { email, password, name } = input;

  // Validate email
  if (!validateEmail(email)) {
    throw new Error("Invalid email format");
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message);
  }

  // Check if user already exists
  const existingUser = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error(`Admin user with email "${email}" already exists`);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create admin user
  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: name || null,
      active: true,
    },
  });

  console.log("\n✅ Admin user created successfully!");
  console.log(`   ID: ${admin.id}`);
  console.log(`   Email: ${admin.email}`);
  if (admin.name) {
    console.log(`   Name: ${admin.name}`);
  }
  console.log(`   Created: ${admin.createdAt.toISOString()}`);
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   Red Ember - Create Admin User       ║");
  console.log("╚════════════════════════════════════════╝");
  console.log();

  const rl = createInterface();

  try {
    // Get email
    let email = "";
    while (!email || !validateEmail(email)) {
      email = await question(rl, "Email: ");
      if (!validateEmail(email)) {
        console.log("❌ Invalid email format. Please try again.\n");
      }
    }

    // Get password
    let password = "";
    let passwordValid = false;
    while (!passwordValid) {
      password = await questionHidden(
        rl,
        "Password (min 8 chars, 1 upper, 1 lower, 1 number): "
      );
      const validation = validatePassword(password);
      if (!validation.valid) {
        console.log(`❌ ${validation.message}\n`);
      } else {
        passwordValid = true;
      }
    }

    // Confirm password
    const passwordConfirm = await questionHidden(rl, "Confirm password: ");
    if (password !== passwordConfirm) {
      console.log("❌ Passwords do not match!");
      rl.close();
      process.exit(1);
    }

    // Get name (optional)
    const name = await question(rl, "Name (optional): ");

    rl.close();

    console.log("\n⏳ Creating admin user...\n");

    await createAdminUser({
      email,
      password,
      name: name.trim() || undefined,
    });
  } catch (error) {
    rl.close();
    console.error("\n❌ Error:", (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Support both interactive and command-line arguments
if (process.argv.length >= 4) {
  // Non-interactive mode: node createAdmin.ts email password [name]
  const [, , email, password, name] = process.argv;

  createAdminUser({ email, password, name })
    .then(() => {
      prisma.$disconnect();
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", (error as Error).message);
      prisma.$disconnect();
      process.exit(1);
    });
} else {
  // Interactive mode
  main();
}
