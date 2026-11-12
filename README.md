# Beeper

A responsive, offline-capable QR companion built with React and Vite. Scan with a camera or image, save codes locally, search your collection, and show a saved code as a QR. An optional local Bun server backs up collections to SQLite.

## Development

Use the latest Node.js 22 LTS (22.22.2+; see `.nvmrc`) and npm. Node.js 24.15+ is also supported.

```sh
npm ci
npm start
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Vite prints the development URL. Camera access requires HTTPS or localhost; opening a LAN HTTP address on a phone will not allow camera access. Image uploads provide an alternative.

## Cloudflare Workers / Wrangler migration

`wrangler.jsonc` deploys `dist/` using Workers Static Assets with single-page application fallback. No server Worker, legacy Workers Sites bucket, KV namespace, or Durable Object migration is needed for this browser-only app.

```sh
npm run deploy:check     # build and validate deployment without publishing
npm run preview:worker  # build and serve using Wrangler locally
npx wrangler login      # authenticate your Cloudflare account
npm run deploy          # build and publish
```

Before publishing, set the Worker `name` in `wrangler.jsonc` to the intended target. For Cloudflare Workers Builds, use `npm run build` as the build command and `npx wrangler deploy` as the deploy command. For external CI, provide `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` through secret environment variables. Do not commit credentials.

For an existing Pages or other hosting deployment, first deploy the Worker at its preview address, verify scanning and collection behavior, then move the custom domain in Cloudflare. Keep the original origin/domain to retain access to existing browser data. Browser storage is origin-specific: records are not automatically transferred to a different hostname or browser. Show important records as QR codes before switching origins and scan them on the new origin if needed.

Reference: [Cloudflare SPA deployment](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Offline use and optional SQLite backup

Production builds generate and register a versioned service worker that precaches
the app shell, styles, images, and lazy QR decoder. Open the app once online and
allow installation to finish before disconnecting. Reloading, scanning uploaded
images, saving, searching, showing QR codes, and deleting work offline. Service
workers require HTTPS or localhost; `npm start` is a development server and does
not install one. Use `npm run build && npm run preview` to test offline behavior.
Updates activate after tabs using the previous version close.

The browser keeps its existing PouchDB/IndexedDB `mainbase` collection. Bun's
[`bun:sqlite`](https://bun.sh/docs/runtime/sqlite) runs in the Bun runtime, not in
a browser or Cloudflare Worker. To additionally keep local SQLite snapshots:

```sh
bun install
bun run start:sqlite
# Open http://127.0.0.1:4173
```

This builds with `VITE_SQLITE_BACKUP=true` and serves the app on loopback with a
SQLite database at `data/beeper.sqlite` (override with `SQLITE_PATH`; `PORT` sets
the port). Each browser has its own snapshot. Saves and deletes commit to browser
storage first; complete snapshots are sent to SQLite in order, with retries on
reload, reconnect, and every 30 seconds. No internet connection is needed. If the
Bun server stops, the cached app still works and changes are backed up when it
returns. Keep the same URL to retain access to existing browser records.

SQLite is an additional backup, not cross-device sync or automatic restore.
Snapshots can be inspected/exported from the `snapshots` table (`records` is JSON),
or read at `/api/snapshots/<client>` on the local server. Browser storage remains
the source of truth. Clearing browser storage creates a new client identity;
previous SQLite snapshots remain available for manual recovery. Back up the SQLite
file using SQLite backup tools while the server runs, or stop it before copying
the database and its WAL files. The default Cloudflare deployment remains browser-only.

The Bun host binds to `127.0.0.1` and is intended for personal use on this machine.
It has no user accounts or authentication. The generated SQLite build expects the
same-origin `/api/snapshots/` endpoint; use the regular `npm run build` for static
hosting. Both build modes write to `dist/`, replacing the previous build.

## Verifying offline storage

For a manual check, build and preview the app, open it online, then wait for the
service worker to activate (DevTools → Application → Service Workers). Enable
Offline in DevTools, reload, upload a QR image, save it, and open Collection.
Reload again to confirm the saved code persists; show its QR and delete it while
still offline. External links in scanned codes still need a network connection.

Run the automated checks with the supported Node version and Bun installed:

```sh
npm test
bun run test:sqlite
npm run test:e2e
# SQLite integration: stop any preview/Bun server on port 4173 first.
bun run build:sqlite
SQLITE_E2E=1 npx playwright test
```

Playwright starts and stops the appropriate server itself. SQLite integration
tests use `/tmp/beeper-e2e.sqlite`, separate from the personal database in `data/`.
They verify browser snapshots after saves and deletions; the storage test checks
that snapshots survive reopening the database and remain isolated per browser.
Desktop and mobile browser tests also exercise offline reload and first-use QR
decoding with no network access.

## Dependencies

The app uses React 19, Vite 8, React Router 7, PouchDB 9, and Wrangler 4. Duplicate scanner and UI packages have been removed. The `uuid` override keeps PouchDB on a patched version that supports its `v4()` API; storage and browser tests cover this integration.

## Compatibility and data

- The original `#/`, `#/scanner`, and `#/settings` URLs remain supported; Collection uses the existing settings URL.
- PouchDB retains the `mainbase` database and existing document IDs and titles. Updating packages does not intentionally clear or recreate the database.
- Data stays on this device: in browser storage and, when enabled, a local SQLite backup. Clearing site data removes the browser copy; existing SQLite snapshots remain. No cloud sync or account is configured.
- QR payloads are displayed as text; only HTTP and HTTPS links are clickable. Camera tracks stop when scanning completes or the scanner page closes.
- The old committed `build/` folder is a historical CRA output. It is not used by Vite or Wrangler; publish `dist/` only.
- Automated checks cover search regressions, deletion, storage and camera failure states, and URL handling. Test actual camera permission and scanning on target mobile devices before production cutover.
# new_beeper
