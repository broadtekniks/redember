# Admin User Creation Scripts

This directory contains scripts for creating admin users in the Red Ember application.

## Scripts

### 1. Interactive Admin Creator (Recommended)

**Command:**

```bash
npm run create-admin
```

**Features:**

- Interactive prompts for email, password, and name
- Email validation
- Password strength validation (min 8 chars, uppercase, lowercase, number)
- Password confirmation
- Hidden password input (displays as asterisks)
- User-friendly output with emojis and formatting

**Example:**

```bash
cd server
npm run create-admin

# Follow the prompts:
# Email: admin@redember.com
# Password: ********
# Confirm password: ********
# Name (optional): John Admin
```

### 2. Quick Admin Creator

**Command:**

```bash
npx tsx scripts/quickAdmin.ts <email> <password> [name]
```

**Features:**

- No prompts - create user with command-line arguments
- Useful for automation and testing
- No validation (use carefully)

**Example:**

```bash
npx tsx scripts/quickAdmin.ts admin@redember.com SecurePass123 "John Admin"
```

### 3. Direct TypeScript Execution

You can also run the interactive script directly:

```bash
npx tsx scripts/createAdmin.ts
```

Or pass arguments for non-interactive mode:

```bash
npx tsx scripts/createAdmin.ts admin@redember.com SecurePass123 "John Admin"
```

## Password Requirements

For the interactive mode, passwords must meet these requirements:

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

**Good passwords:**

- `AdminPass123`
- `SecureP@ss1`
- `MyAdmin2024`

**Bad passwords:**

- `admin` (too short, no uppercase/number)
- `password` (too short, no uppercase/number)
- `ADMIN123` (no lowercase)
- `admin123` (no uppercase)

## Checking Existing Admins

To see all admin users:

```bash
npx tsx -e "import { prisma } from './src/db'; const users = await prisma.adminUser.findMany(); console.log(users); prisma.\$disconnect();"
```

Or use the admin panel after logging in as an admin.

## Security Notes

- Passwords are hashed using bcrypt with 10 salt rounds
- Never commit admin credentials to git
- Use strong passwords in production
- Store credentials securely (password manager, environment variables, etc.)
- Rotate admin passwords regularly

## Troubleshooting

**Error: "Admin user already exists"**

- An admin with that email already exists
- Use a different email or delete the existing admin first

**Error: "Database connection failed"**

- Make sure PostgreSQL is running
- Check your `.env` file has correct `DATABASE_URL`
- Run `docker-compose up -d` to start the database

**Error: "Module not found"**

- Run `npm install` in the server directory
- Make sure you're in the server directory when running commands

## Example Workflow

### First-time setup:

```bash
# 1. Start database
docker-compose up -d

# 2. Run migrations
npm run migrate

# 3. Create first admin
npm run create-admin
# Email: admin@redember.com
# Password: YourSecurePass123
# Name: Super Admin

# 4. Start server
npm run dev

# 5. Login at http://localhost:5173/admin/login
```

### Adding more admins:

```bash
# Quick method:
npx tsx scripts/quickAdmin.ts manager@redember.com ManagerPass123 "Store Manager"

# Or interactive:
npm run create-admin
```
