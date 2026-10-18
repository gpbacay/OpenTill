# OpenTill

A multi-tenant, offline-first Point of Sale system for retail operations: register sales, manage inventory, onboard store tenants, and track performance from one interface.

## Features

- **Register:** Ring up sales from a product catalog with an active cart, held carts, and receipt printing
- **Offline-first:** Keep selling without a connection. Sales, catalog edits, and new stores stay on the device and sync to the local database when the register can reach it
- **Mobile-first:** Phone layout with a bottom navigation bar. Wider screens use the side navigation
- **Multi-tenant:** Onboard and switch between store tenants from a shared workspace
- **Products:** Create and manage catalog items per tenant
- **Analytics & dashboard:** Sales trends, inventory signals, and operational overview in a bento-style dashboard

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Language** | TypeScript |
| **Frontend** | React 19, Next.js 15 (App Router), Tailwind CSS 4, Lucide React, Motion, Recharts |
| **Backend** | NestJS (modular monolith), Express (`@nestjs/platform-express`) |
| **Data store** | SQLite file on this machine (`data/opentill.db`) |
| **ORM** | Prisma |
| **Runtime / tooling** | Node.js, Next.js, tsx (API dev), esbuild (Nest prod bundle), dotenv |

### Architecture notes

- Locally, Next.js (`:3000`) and the NestJS API (`:3001`) run together via `npm run dev`. Next rewrites `/api/*` to Nest.
- Domain APIs live under `server/` as Nest modules: **tenants**, **products**, **orders**, plus a shared **database** module that reads and writes the SQLite file through Prisma (`DATABASE_URL`).
- Schema models live in `prisma/schema.prisma` (Tenant, Product, Order, OrderItem).
- The register keeps a copy in the browser (`localStorage`). Checkout, catalog edits, and new stores work with no network. When the local API is reachable again, that queue is written to SQLite.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`. `DATABASE_URL` already points at the local SQLite file.
3. Generate the Prisma client and create the database file:
   `npx prisma generate`
   `npm run db:push`
4. Start the app:
   `npm run dev`
