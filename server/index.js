import { resolve, sep } from "node:path";
import { mkdirSync } from "node:fs";
import { openStorage } from "./storage.js";

const root = resolve("dist");
mkdirSync("data", { recursive: true });
const storage = openStorage(process.env.SQLITE_PATH || "data/beeper.sqlite");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT || 4173),
  maxRequestBodySize: 16 * 1024 * 1024,
  async fetch(request) {
    const url = new URL(request.url);
    // Only same-origin browser writes; bind locally because this is a personal store.
    if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) {
      return new Response("Forbidden", { status: 403 });
    }
    const match = /^\/api\/snapshots\/([a-f0-9-]{36})$/.exec(url.pathname);
    if (match) {
      if (request.method === "GET") {
        const records = storage.read(match[1]);
        return Response.json(records, { status: records ? 200 : 404, headers: { "Cache-Control": "no-store" } });
      }
      if (request.method === "PUT") {
        let records;
        try { records = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
        if (!Array.isArray(records) || records.some(doc => !doc || typeof doc._id !== "string")) {
          return new Response("Invalid records", { status: 400 });
        }
        storage.save(match[1], records);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 405 });
    }
    if (url.pathname.startsWith("/api/")) return new Response(null, { status: 404 });
    if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405 });
    let path;
    try { path = resolve(root, "." + decodeURIComponent(url.pathname)); }
    catch { return new Response(null, { status: 400 }); }
    if (path !== root && !path.startsWith(root + sep)) return new Response(null, { status: 403 });
    if (path === root) path = resolve(root, "index.html");
    let file = Bun.file(path);
    if (!await file.exists()) {
      if (!request.headers.get("accept")?.includes("text/html")) return new Response(null, { status: 404 });
      file = Bun.file(resolve(root, "index.html"));
    }
    return new Response(request.method === "HEAD" ? null : file, {
      headers: { "Content-Type": file.type, "Cache-Control": "no-cache" },
    });
  },
});
console.log(`Beeper with SQLite: ${server.url}`);
