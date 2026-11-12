import PouchDB from "pouchdb-browser";

// Keep the original database name and document shape to preserve existing codes.
let instance;
function getDatabase() {
  instance ??= new PouchDB("mainbase");
  return instance;
}
// Open lazily so unavailable browser storage can be reported by the UI.
export const database = {
  async allDocs(options) {
    return getDatabase().allDocs(options);
  },
  async put(doc) {
    const result = await getDatabase().put(doc);
    scheduleBackup();
    return result;
  },
  async remove(doc) {
    const result = await getDatabase().remove(doc);
    scheduleBackup();
    return result;
  },
};

// Browser storage remains authoritative, so saving never depends on a server.
// The optional Bun host keeps a durable SQLite snapshot for this browser.
let backupQueue = Promise.resolve();
export function scheduleBackup() {
  if (import.meta.env.VITE_SQLITE_BACKUP !== "true") return;
  backupQueue = backupQueue.catch(() => {}).then(async () => {
    const db = getDatabase();
    let identity;
    try { identity = await db.get("_local/sqlite-backup"); }
    catch (error) {
      if (error.status !== 404) throw error;
      identity = { _id: "_local/sqlite-backup", client: crypto.randomUUID() };
      await db.put(identity);
    }
    const records = await getRecords();
    const response = await fetch(`${import.meta.env.BASE_URL}api/snapshots/${identity.client}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("SQLite backup unavailable");
  });
  // Retry from the complete local collection on reconnect, reload, or timer.
  backupQueue.catch(() => {});
}
export async function getRecords() {
  const { rows } = await database.allDocs({ include_docs: true });
  return rows
    .map(({ doc }) => doc)
    .filter((doc) => !doc._id.startsWith("_design/"));
}
export function filterRecords(records, query) {
  const search = query.trim().toLowerCase();
  return records.filter((record) =>
    String(record.title ?? record._id)
      .toLowerCase()
      .includes(search),
  );
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
