# NxtGen POS

A multi-tenant, offline-first Point of Sale system for retail operations — register sales, manage inventory, onboard store tenants, and track performance from one interface.

## Features

- **Register** — Ring up sales from a product catalog with an active cart, held carts, and receipt printing
- **Offline-first** — Keep selling without a connection; queued orders sync automatically when back online
- **Multi-tenant** — Onboard and switch between store tenants from a shared workspace
- **Products** — Create and manage catalog items per tenant
- **Analytics & dashboard** — Sales trends, inventory signals, and operational overview in a bento-style dashboard

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Language** | TypeScript |
| **Frontend** | React 19, Next.js 15 (App Router), Tailwind CSS 4, Lucide React, Motion, Recharts |
| **Backend** | NestJS (modular monolith), Express (`@nestjs/platform-express`) |
| **Data store** | [Neon](https://neon.tech) (serverless PostgreSQL) via HTTP driver adapter |
| **ORM** | Prisma (`@prisma/adapter-neon`) |
| **Runtime / tooling** | Node.js, Next.js, tsx (API dev), esbuild (Nest prod bundle), dotenv |

### Architecture notes

- Locally, Next.js (`:3000`) and the NestJS API (`:3001`) run together via `npm run dev`. Next rewrites `/api/*` to Nest.
- On [Vercel](https://vercel.com), the project is configured as **Next.js** (`vercel.json` → `framework: "nextjs"`). Point `API_URL` at your Nest/API host for production rewrites.
- Domain APIs live under `server/` as Nest modules: **tenants**, **products**, **orders**, plus a shared **database** module that connects to Neon through Prisma (`DATABASE_URL`) using the Neon HTTP adapter (works when TCP port 5432 is blocked).
- Schema models live in `prisma/schema.prisma` (Tenant, Product, Order, OrderItem).
- The UI lives under `app/` and `components/` and talks to those APIs; offline queue and local persistence use the browser (`localStorage`) until sync reaches Neon.

## Run Locally

**Prerequisites:** Node.js and a [Neon](https://neon.tech) project

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection string  
   (use role `neondb_owner`; Prisma reads `.env`)
3. Generate the Prisma client and apply the schema (HTTP — preferred when `prisma db push` fails with P1001):
   `npx prisma generate`
   `npm run db:push`
4. Start the app:
   `npm run dev`
