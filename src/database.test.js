import { describe, expect, it } from "vitest";
import PouchDB from "pouchdb-browser";
import { database, getRecords, filterRecords, safeUrl } from "./database";
describe("saved code handling", () => {
  it("matches old records case-insensitively without mutating them", () => {
    const records = [{ _id: "a", title: "Alpha" }, { _id: "Beta" }];
    expect(filterRecords(records, " ALPHA ")).toEqual([records[0]]);
    expect(filterRecords(records, "beta")).toEqual([records[1]]);
    expect(filterRecords(records, "")).toHaveLength(2);
  });
  it("only makes HTTP and HTTPS codes clickable", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///etc/passwd",
      "plain text",
    ])
      expect(safeUrl(value)).toBeNull();
  });
});

it("reads records created with the legacy database name and shape", async () => {
  const legacy = new PouchDB("mainbase");
  await legacy.put({
    _id: "https://legacy.example/",
    title: "https://legacy.example/",
  });
  expect(await getRecords()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        _id: "https://legacy.example/",
        title: "https://legacy.example/",
      }),
    ]),
  );
  const records = await getRecords();
  await database.remove(
    records.find((record) => record._id === "https://legacy.example/"),
  );
  expect(await getRecords()).toEqual([]);
  await legacy.close();
});
