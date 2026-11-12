import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

test("offline navigation survives the static host index.html redirect", async ({ page, context }) => {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    if (path === "/index.html") {
      response.writeHead(308, { Location: "/" }).end();
      return;
    }
    const file = path === "/" ? "/index.html" : path;
    const types = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml" };
    try {
      const body = await readFile(new URL(`../dist${file}`, import.meta.url));
      response.writeHead(200, { "Content-Type": types[file.split(".").pop()] || "application/octet-stream" }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
      }
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: /A little scan/ })).toBeVisible();
    await page.getByRole("link", { name: "Start scanning" }).click();
    await page.evaluate(() => { delete window.BarcodeDetector; });
    await page.locator("input[type=file]").setInputFiles("tests/fixtures/qr-example.png");
    await expect(page.getByText("CODE FOUND", { exact: true })).toBeVisible();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("launches the cached shell without waiting for a stalled network", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
    const cacheName = (await caches.keys()).find(name => name.startsWith("beeper-"));
    const cache = await caches.open(cacheName);
    await cache.put("/index.html", new Response("<h1>Stale cached page</h1>", {
      headers: { "Content-Type": "text/html" },
    }));
  });
  // Cache-first navigation must not wait for even a successful online request.
  await context.route("**/*", () => {});
  await page.reload({ waitUntil: "domcontentloaded", timeout: 5000 });
  await expect(page.getByRole("heading", { name: "Stale cached page" })).toBeVisible();
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.setOffline(true);
  const launchUrl = page.url();
  await page.close();
  page = await context.newPage();
  await page.goto(launchUrl);
  await expect(page.getByRole("heading", { name: "Stale cached page" })).toBeVisible();
});

test("backs up saved codes and deletions to the Bun SQLite host", async ({ page }) => {
  test.skip(!process.env.SQLITE_E2E, "Requires the optional Bun host");
  await page.goto("/#/scanner");
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/qr-example.png");
  await expect(page.getByText("CODE FOUND", { exact: true })).toBeVisible();
  const saved = page.waitForResponse(response => response.url().includes("/api/snapshots/") && response.request().method() === "PUT" && response.request().postDataJSON().length === 1);
  await page.getByRole("button", { name: "Save to collection" }).click();
  const response = await saved;
  expect(response.status()).toBe(204);
  const snapshot = await page.request.get(response.url());
  expect(await snapshot.json()).toHaveLength(1);
  await page.getByRole("link", { name: "Collection", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const deleted = page.waitForResponse(response => response.url().includes("/api/snapshots/") && response.request().method() === "PUT" && response.request().postDataJSON().length === 0);
  await page.getByRole("button", { name: "Delete code", exact: true }).click();
  expect((await deleted).status()).toBe(204);
  expect(await (await page.request.get(response.url())).json()).toEqual([]);
});

test("cold reload, scan, save, show QR, and delete while offline", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("Ready to use offline", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  const launchUrl = page.url();
  await page.close();
  page = await context.newPage();
  await page.goto(launchUrl);
  await page.getByRole("link", { name: "Start scanning" }).click();
  // First scan is offline: the lazy decoder chunk must already be cached.
  await page.evaluate(() => { delete window.BarcodeDetector; });
  await page.locator("input[type=file]").setInputFiles("tests/fixtures/qr-example.png");
  await expect(page.getByText("CODE FOUND", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save to collection" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved to your collection.");
  await page.getByRole("link", { name: "Collection", exact: true }).click();
  await page.reload();
  await expect(page.locator(".record")).toHaveCount(1);
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.locator(".export-qr canvas")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete code", exact: true }).click();
  await page.reload();
  await expect(page.locator(".record")).toHaveCount(0);
});

test("scan an image, persist a code, share its QR, and delete it", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A little scan/ }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
  await page.screenshot({
    path: `/tmp/beeper-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Start scanning" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("tests/fixtures/qr-example.png");
  await expect(page.getByText("CODE FOUND", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save to collection" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved to your collection.",
  );
  await page.getByRole("link", { name: "Collection", exact: true }).click();
  await expect(page.locator(".record")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".record")).toHaveCount(1);
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".export-qr canvas")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("searchbox").fill("no-matching-record");
  await expect(page.getByText("No matching discoveries")).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.locator(".record")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete code", exact: true }).click();
  await expect(
    page.getByText("Make room for a little discovery."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps the main screens within the viewport", async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/#/scanner", "/#/settings"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        route.endsWith("scanner")
          ? "Point. Scan."
          : route.endsWith("settings")
            ? "collection"
            : "A little scan",
      );
      if (route.endsWith("scanner")) {
        // A landscape camera feed must stay inside the taller preview frame.
        await page.locator("video").evaluate(async (video) => {
          const canvas = document.createElement("canvas");
          canvas.width = 1920;
          canvas.height = 1080;
          canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
          video.srcObject = canvas.captureStream(1);
          video.hidden = false;
          await video.play();
        });
        const frame = await page.locator(".viewfinder").boundingBox();
        const video = await page.locator("video").boundingBox();
        expect(frame.height).toBeGreaterThanOrEqual(260);
        expect(video.height).toBeCloseTo(frame.height, 0);
        expect(video.y).toBeCloseTo(frame.y, 0);
        const controls = await page.locator(".scanner-actions").boundingBox();
        expect(video.y + video.height).toBeLessThanOrEqual(controls.y);
      }
      if (route.endsWith("settings")) {
        await expect(
          page.getByText("Make room for a little discovery."),
        ).toBeVisible();
      }
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }));
      expect(
        size.width,
        `${route} horizontal fit at ${viewport.width}`,
      ).toBeLessThanOrEqual(viewport.width);
      expect(
        size.height,
        `${route} vertical fit at ${viewport.width}`,
      ).toBeLessThanOrEqual(size.viewportHeight);
    }
  }
});
