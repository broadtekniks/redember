# Red Ember Spice MVP

Monorepo:

- `server/` Express + Stripe + Prisma (Postgres)
- `web/` React (Vite)

## Prereqs

- Node.js 18+ (recommended 20+)
- Postgres running locally (or a hosted Postgres)
- Stripe CLI installed

Optional: a local Postgres container is included in `docker-compose.yml`.

## 1) Backend setup (Prisma + Express)

If you want a local Postgres quickly:

```powershell
cd c:\Users\neo\projects\redember
docker compose up -d
```

In PowerShell:

```powershell
cd c:\Users\neo\projects\redember\server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` and set:

- `DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/redember`
- `STRIPE_SECRET_KEY=sk_test_...`
- `CLIENT_URL=http://localhost:5173`
- `PORT=4242`
- `ADMIN_TOKEN=change_me`

Create DB tables:

```powershell
npx prisma generate
npx prisma migrate dev --name init
node prisma\seed.js
```

Run server:

```powershell
npm run dev
```

Server endpoints:

- `GET http://localhost:4242/api/product`
- `POST http://localhost:4242/api/checkout` body: `{ "quantity": 1 }`
- `POST http://localhost:4242/api/stripe/webhook` (Stripe only)
- Admin:
  - `GET /api/admin/inventory` header `x-admin-token: <ADMIN_TOKEN>`
  - `GET /api/admin/orders` header `x-admin-token: <ADMIN_TOKEN>`

## 2) Stripe webhook listener (source of truth)

In another terminal:

```powershell
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

Copy the printed webhook signing secret into `server/.env` as `STRIPE_WEBHOOK_SECRET=whsec_...`.

## 3) Frontend setup (React + Vite)

In PowerShell:

```powershell
cd c:\Users\neo\projects\redember\web
npm install
npm run dev
```

Open:

- Shop: `http://localhost:5173/`
- Admin: `http://localhost:5173/admin`

Note: Vite proxies `/api/*` to `http://localhost:4242` via `web/vite.config.js`.

## 4) Test payment

Use Stripe test card:

- `4242 4242 4242 4242`
- Any future expiry date
- Any CVC

## Inventory model (MVP note)

- Price/amount is defined server-side only (client never sends price).
- Inventory decrements on `checkout.session.completed` webhook.
- MVP caveat: without reservations, extremely concurrent checkouts can still oversell. Stock decrement is guarded to never go negative.
