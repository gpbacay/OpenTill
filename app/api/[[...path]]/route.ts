// The Nest API inside the Next.js app, so Vercel runs it as part of the same deployment (every /api/* request lands here).
// Locally `npm run dev` runs Nest on :3001 instead and next.config.ts rewrites /api/* to it before this file is reached.
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import inject from "light-my-request";
import { AppModule } from "../../../server/app.module";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Dispatch = Parameters<typeof inject>[0];
let ready: Promise<Dispatch> | undefined;

// Built once per warm instance.
function boot() {
  ready ??= NestFactory.create(AppModule, { logger: ["error", "warn"] }).then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as Dispatch;
  });
  return ready;
}

/** Feeds a web Request to Nest's Express app and turns the answer back into a web Response. */
async function handle(request: Request) {
  const url = new URL(request.url);
  // Serverless instances don't share memory, so a live stream here would miss other instances' changes.
  // A failed stream makes the browser poll instead (lib/realtime.ts).
  if (url.pathname === "/api/events") return Response.json({ message: "Live updates are off here; the app polls instead." }, { status: 404 });
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const answer = await inject(await boot(), {
    method: request.method as "GET",
    url: url.pathname + url.search,
    headers: Object.fromEntries(request.headers),
    payload: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
  });
  const headers = new Headers();
  for (const [name, value] of Object.entries(answer.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
    else if (value !== undefined) headers.set(name, String(value));
  }
  headers.delete("content-length"); // the Response sets its own
  headers.delete("transfer-encoding");
  return new Response(answer.statusCode === 204 || answer.statusCode === 304 ? null : answer.rawPayload, {
    status: answer.statusCode,
    headers,
  });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
