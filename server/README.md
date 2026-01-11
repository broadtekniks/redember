# redember-server

Express + Stripe Checkout + Prisma (Postgres).

## Setup

1. Copy env:
   - `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
2. Set `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_TOKEN`.
3. Install deps:
   - `npm install`
4. Prisma:
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
   - `npm run seed`
5. Run:
   - `npm run dev`
