import { Database } from "bun:sqlite";

export function openStorage(filename) {
  const db = new Database(filename, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS snapshots (
    client TEXT PRIMARY KEY,
    records TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const put = db.query(`INSERT INTO snapshots VALUES (?, ?, ?)
    ON CONFLICT(client) DO UPDATE SET records = excluded.records,
    updated_at = excluded.updated_at`);
  return {
    save(client, records) {
      put.run(client, JSON.stringify(records), new Date().toISOString());
    },
    read(client) {
      const row = db.query("SELECT records FROM snapshots WHERE client = ?").get(client);
      return row ? JSON.parse(row.records) : null;
    },
    close() { db.close(); },
  };
}
