// The Nest API as one Vercel Function: everything under /api/* lands here (the web app has no /api routes of its own).
import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../server/app.module";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let ready: Promise<Handler> | undefined;

// Built once per warm instance. Nest's default body parser handles JSON.
function boot() {
  ready ??= NestFactory.create(AppModule, { logger: ["error", "warn"] }).then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as Handler;
  });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  (await boot())(req, res);
}
