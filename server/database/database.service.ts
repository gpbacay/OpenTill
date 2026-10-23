import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

@Injectable()
export class DatabaseService implements OnModuleInit {
  public client: PrismaClient | null = null;

  async onModuleInit() {
    // Hosted (Vercel): Turso, which is SQLite over the network. Locally: the SQLite file in DATABASE_URL.
    const turso = process.env.TURSO_DATABASE_URL;
    if (!turso && !process.env.DATABASE_URL) {
      console.warn(
        "DATABASE_URL is not configured. Running with the in-memory store."
      );
      return;
    }
    try {
      this.client = turso
        ? new PrismaClient({ adapter: new PrismaLibSQL(createClient({ url: turso, authToken: process.env.TURSO_AUTH_TOKEN })) })
        : new PrismaClient();
      await this.client.$connect();
      console.log("Connected to the database.");
    } catch (err: any) {
      console.error(
        "Local database connection failed. In-memory store will be used. Error:",
        err.message
      );
      this.client = null;
    }
  }
}
