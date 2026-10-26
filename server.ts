import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import dotenv from "dotenv";
import { acceptPhotos, AppModule } from "./server/app.module";

// Load .env.local first, then .env (DATABASE_URL in .env wins)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  acceptPhotos(app);

  const PORT = 3001;
  await app.listen(PORT, "0.0.0.0");
  console.log(`🚀 NestJS API running on http://0.0.0.0:${PORT}`);
}

bootstrap();
