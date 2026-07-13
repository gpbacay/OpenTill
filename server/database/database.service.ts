import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseService implements OnModuleInit {
  public client: PrismaClient | null = null;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      console.warn("⚠️ DATABASE_URL is not configured. Running database service with in-memory fallback store.");
      return;
    }
    try {
      this.client = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } }
      });
      await this.client.$connect();
      console.log("⚡ Connected to Neon PostgreSQL via Prisma ORM!");
    } catch (err: any) {
      console.error("❌ Prisma database connection error. Fallback will be active. Error:", err.message);
      this.client = null;
    }
  }
}
