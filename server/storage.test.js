import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStorage } from "./storage.js";

test("snapshots survive restart, isolate browsers, and preserve deletions", () => {
  const dir = mkdtempSync(join(tmpdir(), "beeper-sqlite-"));
  let storage = openStorage(join(dir, "test.sqlite"));
  try {
    storage.save("one", [{ _id: "https://example.com", title: "A 'quote'" }]);
    storage.save("two", [{ _id: "other" }]);
    storage.close();
    storage = openStorage(join(dir, "test.sqlite"));
    expect(storage.read("one")[0].title).toBe("A 'quote'");
    storage.save("one", []);
    expect(storage.read("one")).toEqual([]);
    expect(storage.read("two")).toEqual([{ _id: "other" }]);
    expect(storage.read("missing")).toBeNull();
  } finally {
    storage.close();
    rmSync(dir, { recursive: true });
  }
});
