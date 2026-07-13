import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
// Prefer HTTP/fetch so queries work when TCP:5432 is blocked
neonConfig.poolQueryViaFetch = true;

@Injectable()
export class DatabaseService implements OnModuleInit {
  public client: PrismaClient | null = null;
  private pool: Pool | null = null;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      console.warn(
        "⚠️ DATABASE_URL is not configured. Running database service with in-memory fallback store."
      );
      return;
    }
    try {
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaNeon(this.pool);
      this.client = new PrismaClient({ adapter });
      await this.client.$connect();
      console.log("⚡ Connected to Neon PostgreSQL via Prisma ORM!");
    } catch (err: any) {
      console.error(
        "❌ Prisma database connection error. Fallback will be active. Error:",
        err.message
      );
      this.client = null;
    }
  }
}
