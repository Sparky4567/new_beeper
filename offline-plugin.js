import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Include every output file, including lazy chunks and the QR decoder worker.
export function offlinePlugin() {
  let config;
  return {
    name: "beeper-offline",
    configResolved(value) { config = value; },
    async closeBundle() {
      const root = config.build.outDir;
      async function files(dir = "") {
        const entries = await readdir(join(root, dir), { withFileTypes: true });
        return (await Promise.all(entries.map((entry) => {
          const path = join(dir, entry.name);
          return entry.isDirectory() ? files(path) : path === "sw.js" ? [] : [path];
        }))).flat();
      }
      const paths = (await files()).sort();
      const hash = createHash("sha256");
      for (const path of paths) hash.update(await readFile(join(root, path)));
      const version = hash.digest("hex").slice(0, 16);
      const urls = paths.map((path) => config.base + path);
      await writeFile(join(root, "sw.js"), `
const CACHE = "beeper-${version}";
const FILES = ${JSON.stringify(urls)};
const SHELL = ${JSON.stringify(config.base + "index.html")};
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("beeper-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(${JSON.stringify(config.base + "api/")})) return;
  // Never cache data APIs or unrelated requests.
  const path = event.request.mode === "navigate" ? SHELL : url.pathname;
  if (!FILES.includes(path)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(path) || fetch(event.request);
  })());
});
`);
    },
  };
}
