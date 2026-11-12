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

## Cloudflare Pages deployment

The production app is hosted at https://beeper.artefaktas.eu on the Cloudflare
Pages project `new-beeper` (production branch `main`). `wrangler.jsonc` sets
`pages_build_output_dir` to `dist/`. Deploy the regular browser-only build;
the optional Bun/SQLite server is not deployed to Pages.

```sh
npm run build
npx wrangler pages dev dist             # optional local Pages preview
npx wrangler login                     # authenticate if needed
npx wrangler pages deploy dist --project-name new-beeper --branch main
```

For Git-connected Pages builds, use the repository root as the build directory,
`npm run build` as the build command, and `dist` as the output directory. Commit
the source files, `package.json`, and `package-lock.json` before pushing to
`main`. For external CI, provide `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` through secret environment variables.

Keep the same domain to retain access to existing browser records. Browser
storage belongs to each origin: the Pages preview URL and production custom
domain have separate collections and separate offline installations.

The package's older Worker deployment scripts are not used for this Pages
configuration; use the explicit `wrangler pages` commands above.

## Offline use and optional SQLite backup

### Install the offline PWA

1. Open https://beeper.artefaktas.eu online on the device you will use.
2. Wait for **Ready to use offline** in the app header.
3. Choose **Install app** in your browser, or **Add to Home Screen** on iOS.
4. Close all Beeper tabs and app windows, enable airplane mode, and reopen the
   installed app. Scanning and your saved collection work without a server or
   an internet connection. Following a scanned website link still needs internet.

Setup is required once per browser/device. If setup fails, reconnect and reload.
If an old version persists after deployment, open the site online with a fresh
query string (for example `?setup=offline-v3`), then close every Beeper window
and reopen it. Do not clear site data to update: that also deletes saved codes.
Browser storage may be removed by browser cleanup, storage pressure, or private
browsing; an installed PWA does not provide a permanent backup.

### Resource caching

Production builds generate and register a versioned service worker that precaches
the app shell, styles, images, and lazy QR decoder. Open the app once online and
allow installation to finish before disconnecting. Reloading, scanning uploaded
images, saving, searching, showing QR codes, and deleting work offline. Service
workers require HTTPS or localhost; `npm start` is a development server and does
not install one. Use `npm run build && npm run preview` to test offline behavior.
After setup, page loads use the cached app shell immediately, without waiting
for a network connection. Updates download in the background and activate after
all open Beeper windows and tabs close.
Precached responses are normalized after redirects so static hosting redirects
such as `/index.html` → `/` do not prevent offline navigation.
The service worker URL includes a build identifier, and precache downloads use
versioned query strings to bypass stale CDN responses. Resources are stored in
the browser Cache API; saved QR records remain in IndexedDB. SQLite is not
needed to launch or use the installed PWA offline.

### Optional local SQLite backup

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

For a manual check, build and preview the app, open it online, and wait for
**Ready to use offline**. Disconnect, close the tab, and reopen the same URL in
a new tab (or launch the installed PWA in airplane mode). Upload a QR image,
save it, and open Collection. Reload to confirm it persists; show its QR and
delete it while still offline. Also test camera scanning on the target device.

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
Desktop and mobile browser tests exercise closing and reopening a tab offline,
first-use QR decoding, saved records, static-host HTML redirects, and a stalled
network that must not delay loading the cached shell. Browser automation does
not exercise the operating system's PWA installation flow.

## Dependencies

The app uses React 19, Vite 8, React Router 7, PouchDB 9, and Wrangler 4. Duplicate scanner and UI packages have been removed. The `uuid` override keeps PouchDB on a patched version that supports its `v4()` API; storage and browser tests cover this integration.

## Compatibility and data

- The original `#/`, `#/scanner`, and `#/settings` URLs remain supported; Collection uses the existing settings URL.
- PouchDB retains the `mainbase` database and existing document IDs and titles. Updating packages does not intentionally clear or recreate the database.
- Data stays on this device: in browser storage and, when enabled, a local SQLite backup. Clearing site data removes the browser copy; existing SQLite snapshots remain. No cloud sync or account is configured.
- QR payloads are displayed as text; only HTTP and HTTPS links are clickable. Camera tracks stop when scanning completes or the scanner page closes.
- The old committed `build/` folder is a historical CRA output. It is not used by Vite or Wrangler; publish `dist/` only.
- Automated checks cover search regressions, deletion, storage and camera failure states, and URL handling. Test actual camera permission and scanning on target mobile devices before production cutover.
