import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { scheduleBackup } from "./database.js";

function mount() {
  createRoot(document.getElementById("root")).render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
}
if (window.cordova)
  document.addEventListener("deviceready", mount, { once: true });
else mount();

if (import.meta.env.VITE_SQLITE_BACKUP === "true") {
  scheduleBackup();
  window.addEventListener("online", scheduleBackup);
  window.setInterval(scheduleBackup, 30000);
}
