import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { database, getRecords } from "./database";

vi.mock("./database", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    database: { put: vi.fn(), remove: vi.fn() },
    getRecords: vi.fn(),
  };
});
vi.mock("qr-scanner", () => ({
  default: class {
    start() {
      return Promise.reject(new Error("denied"));
    }
    destroy() {}
  },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  getRecords.mockResolvedValue([
    { _id: "alpha", title: "Alpha" },
    { _id: "beta", title: "Beta" },
  ]);
  database.remove.mockResolvedValue({ ok: true });
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
function mount(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe("Beeper", () => {
  it("opens the scanner from home and reports camera denial", async () => {
    mount();
    fireEvent.click(screen.getByRole("link", { name: /start scanning/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start camera" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not access the camera",
    );
  });
  it("searches the full collection when changing queries and clearing search", async () => {
    mount("/settings");
    await screen.findByText("Alpha");
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "alpha" } });
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "beta" } });
    expect(screen.getByText("Beta")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
  it("removes the final record and shows the empty state", async () => {
    getRecords.mockResolvedValue([
      { _id: "alpha", _rev: "1-x", title: "Alpha" },
    ]);
    mount("/settings");
    await screen.findByText("Alpha");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete", exact: true }),
    );
    expect(database.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete code" }));
    await waitFor(() =>
      expect(
        screen.getByText("Make room for a little discovery."),
      ).toBeInTheDocument(),
    );
    expect(database.remove).toHaveBeenCalledWith({
      _id: "alpha",
      _rev: "1-x",
      title: "Alpha",
    });
  });
  it("displays storage failures", async () => {
    getRecords.mockRejectedValue(new Error("unavailable"));
    mount("/settings");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your codes",
    );
  });
});
