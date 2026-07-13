import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { AppModule } from "./server/app.module";

// Load .env.local first, then .env (Prisma/Neon DATABASE_URL lives in .env and wins)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.json());

  console.log(`🌐 Server environment: ${process.env.NODE_ENV || "development"}`);

  if (process.env.NODE_ENV !== "production") {
    console.log("⚡ Mounting Vite dev server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`📦 Serving production build from ${distPath}...`);
    expressApp.use(express.static(distPath));
    expressApp.get("*", (req: any, res: any) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  await app.listen(PORT, "0.0.0.0");
  console.log(`🚀 NestJS Modular Monolith running on http://0.0.0.0:${PORT}`);
}

bootstrap();
