import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseService implements OnModuleInit {
  public client: PrismaClient | null = null;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      console.warn(
        "DATABASE_URL is not configured. Running with the in-memory store."
      );
      return;
    }
    try {
      this.client = new PrismaClient();
      await this.client.$connect();
      console.log("Connected to the local SQLite database.");
    } catch (err: any) {
      console.error(
        "Local database connection failed. In-memory store will be used. Error:",
        err.message
      );
      this.client = null;
    }
  }
}
