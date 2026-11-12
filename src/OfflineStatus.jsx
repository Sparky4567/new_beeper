import { useEffect, useState } from "react";

export default function OfflineStatus() {
  const [status, setStatus] = useState("Preparing offline use…");
  useEffect(() => {
    if (!import.meta.env.PROD) {
      setStatus("Stored on your device");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setStatus("Offline use unavailable");
      return;
    }
    let active = true;
    const showReady = () => {
      if (active && navigator.serviceWorker.controller) setStatus("Ready to use offline");
    };
    navigator.serviceWorker.addEventListener("controllerchange", showReady);
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${import.meta.env.VITE_BUILD_ID}`, { updateViaCache: "none" })
      .then(async registration => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (active && worker.state === "redundant" && !navigator.serviceWorker.controller) {
            setStatus("Offline setup failed. Reconnect and reload.");
          }
        });
        await navigator.serviceWorker.ready;
        showReady();
      })
      .catch(() => {
        if (active) setStatus("Offline setup failed. Reconnect and reload.");
      });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", showReady);
    };
  }, []);
  return <span className="header-note" aria-live="polite"><span className="status-dot" /> {status}</span>;
}
