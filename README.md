# OpenTill

A multi-tenant, offline-first Point of Sale system for retail operations: register sales, manage inventory, onboard store tenants, and track performance from one interface.

## Features

- **Register:** Ring up sales from a product catalog. Leave "Cash received" empty for an exact payment and the cashier defaults to the signed-in user. Held carts and receipt printing included
- **Inventory:** Stock levels with low and out-of-stock warnings, restocks from suppliers, stock adjustments (damage, count corrections) and a full stock history. Stock only moves through logged changes, so the numbers always add up
- **Sales:** Searchable, filterable sales table (period, status, payment, cashier) with receipts and a Reports tab
- **Suppliers:** Contacts, what you bought from each and when they last delivered
- **Expenses:** Track rent, bills and restocks, filter by period, category and supplier, and see what is left after expenses
- **Custom columns:** Add your own columns (for example "Brand" on products) to the Inventory, Suppliers and Expenses tables with the **Columns** button. They appear in the table, the add/edit form and search
- **Realtime:** Changes show up on every open tab and device within a moment
- **Offline-first:** Keep working without a connection. Everything is saved on the device and syncs when the API is reachable again
- **Tables:** Sticky headers, pagination, search and filters everywhere; phone layout with a bottom navigation bar
- **Multi-tenant:** Onboard and switch between stores

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
- **Modular monolith.** One deployable API, split into Nest modules under `server/`. Each module owns its controller, service and Prisma tables, and talks to others only through exported services:
  `tenants`, `products`, `inventory` (stock ledger), `orders`, `suppliers`, `expenses`, `columns` (custom columns), `realtime` (change feed), `auth`, plus a shared `database` module.
  Store-scoped CRUD (suppliers, expenses, columns) shares one base class in `server/common/`, so a new module is a table, a `build()` validator and a tiny controller.
- **Realtime.** Every write publishes `{tenantId, topic}` to `RealtimeService`. `GET /api/events` streams those as Server-Sent Events to the owner's browsers, which re-fetch the affected list.
- **Graceful degradation.** The browser keeps a local copy of every list plus an outbox of unsent changes (`lib/use-collection.ts`), so every page renders and accepts edits with the API down. If the live stream cannot connect, the app falls back to polling every 20 seconds. If SQLite is unreachable the API serves from an in-memory store. Stock changes are idempotent by id, so replaying the outbox never double counts.
- **Stock.** `Product.stock` is only changed by stock movements (`OPENING`, `RESTOCK`, `ADJUSTMENT`) and by sales (`SALE`). Each is a row in `StockMovement`.
- **Tables.** `components/data-table/` holds the shared `DataTable` (sticky header, pagination), search and filter controls and the custom column manager. Lists are searched, filtered and paged in the browser, which is what lets them work offline.
- Schema models live in `prisma/schema.prisma`.

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
