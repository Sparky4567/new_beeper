import React, { useEffect, useRef, useState } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import QrScanner from "qr-scanner";
import QrCreator from "qr-creator";
import { database, filterRecords, getRecords, safeUrl } from "./database";

function Icon({ name, ...props }) {
  const paths = {
    scan: "M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z",
    home: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    collection: "M7 3h13v16H7zM4 7v15h12M11 7h5v5h-5zM11 15h5",
    link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
    text: "M6 3h9l4 4v14H5V3zM14 3v5h5M9 12h6M9 16h6",
    upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
    camera: "M3 7h4l2-3h6l2 3h4v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    share: "M12 15V3m-4 4 4-4 4 4M5 12v9h14v-9",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6",
    close: "m6 6 12 12M6 18 18 6",
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.collection} />
    </svg>
  );
}

function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="status-dot" /> YOUR EVERYDAY QR COMPANION
          </span>
          <h1>
            A little scan. A new <em>connection.</em>
          </h1>
          <p>Scan a QR code, save what matters, and find it here anytime.</p>
          <div className="overview-actions">
            <Link className="button primary" to="/scanner">
              <Icon name="scan" /> Start scanning <Icon name="arrow" />
            </Link>
            <Link className="collection-shortcut" to="/settings">
              <Icon name="collection" /> Collection <Icon name="arrow" />
            </Link>
          </div>
          <div className="hero-note">
            <Icon name="shield" /> No account. Just your device.
          </div>
        </div>
      </section>
      <section className="steps" aria-label="How Beeper works">
        {[
          ["scan", "Scan a code", "Point your camera at any QR code."],
          [
            "collection",
            "Save a discovery",
            "Keep links and text on your device.",
          ],
          ["share", "Share a QR", "Show a saved code to pass it on."],
        ].map(([n, title, text]) => (
          <article key={n}>
            <span className="step-number">
              <Icon name={n} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function Scanner() {
  const video = useRef(null);
  const scanner = useRef(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    if (!running) return;
    let active = true;
    const instance = new QrScanner(
      video.current,
      ({ data }) => {
        if (!active) return;
        setResult(data);
        setRunning(false);
        setMessage("");
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      },
    );
    scanner.current = instance;
    instance.start().catch(() => {
      if (active) {
        setMessage(
          "Could not access the camera. Allow camera permission and use HTTPS or localhost, then try again.",
        );
        setRunning(false);
      }
    });
    return () => {
      active = false;
      instance.destroy();
      scanner.current = null;
    };
  }, [running]);
  async function save() {
    setSaving(true);
    try {
      await database.put({ _id: result, title: result });
      setMessage("Saved to your collection.");
      setResult("");
    } catch (error) {
      setMessage(
        error.status === 409
          ? "This code is already in your collection."
          : "Could not save this code. Check that browser storage is available.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function scanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRunning(false);
    setResult("");
    setMessage("");
    setProcessing(true);
    try {
      const code = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
      });
      setResult(code.data);
    } catch {
      setMessage("No QR code found. Try a clearer image.");
    }
    setProcessing(false);
    event.target.value = "";
  }
  return (
    <section className="workspace scanner-workspace">
      <span className="eyebrow">DISCOVER SOMETHING NEW</span>
      <h1>
        Point. Scan. <em>Save.</em>
      </h1>
      <p className="intro">Scan a QR code or upload an image.</p>
      <div className="scanner-panel">
        <div className="viewfinder">
          <video ref={video} muted playsInline hidden={!running} />
          {!running && (
            <div className="camera-placeholder">
              <Icon name="scan" width="64" height="64" />
              <p>Your next discovery starts here</p>
            </div>
          )}
        </div>
        <div className="scanner-actions">
          <button
            className="button primary"
            disabled={processing}
            onClick={() => {
              setMessage("");
              setResult("");
              setRunning(!running);
            }}
          >
            <Icon name="camera" /> {running ? "Stop camera" : "Start camera"}
          </button>
          <label className="button secondary">
            <Icon name="upload" /> Upload image
            <input
              type="file"
              accept="image/*"
              disabled={processing}
              onChange={scanFile}
              className="file-input"
            />
          </label>
        </div>
      </div>
      {processing && (
        <p role="status" className="notice">
          Reading your image…
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {result && (
        <div className="result-panel">
          <span className="eyebrow">CODE FOUND</span>
          <p className="code-value">{result}</p>
          <button className="button primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save to collection"}
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setResult("");
              setMessage("");
            }}
          >
            Discard
          </button>
        </div>
      )}
      <p className="privacy-note">
        <Icon name="shield" /> Camera images are processed on your device.
      </p>
    </section>
  );
}

function Collection() {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const qr = useRef(null);
  const dialog = useRef(null);
  useEffect(() => {
    getRecords()
      .then(setRecords)
      .catch(() =>
        setError(
          "Could not load your codes. Check that browser storage is available.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!selected && !deleting) {
      if (dialog.current?.open) dialog.current.close();
      return;
    }
    if (!dialog.current.open) dialog.current.showModal();
    if (selected && qr.current) {
      qr.current.replaceChildren();
      try {
        QrCreator.render(
          {
            text: String(selected.title ?? selected._id),
            radius: 0.25,
            ecLevel: "M",
            fill: "#101918",
            background: "#ffffff",
            size: 256,
          },
          qr.current,
        );
      } catch {
        qr.current.textContent = "This code is too large to display as a QR.";
      }
    }
  }, [selected, deleting]);
  const visible = filterRecords(records, query);
  function close() {
    setSelected(null);
    setDeleting(null);
  }
  async function remove() {
    setBusy(true);
    try {
      await database.remove(deleting);
      setRecords((items) => items.filter((item) => item._id !== deleting._id));
      close();
    } catch {
      setError("Could not delete this code. Refresh and try again.");
      close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR LITTLE DISCOVERIES</span>
          <h1>
            The <em>collection.</em>
          </h1>
        </div>
        <span className="count">
          {records.length} saved {records.length === 1 ? "code" : "codes"}
        </span>
      </div>
      <p className="intro">A place for everything worth coming back to.</p>
      <label className="search">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Search saved codes"
          placeholder="Find something in your collection…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading your collection…</p>
      ) : visible.length ? (
        <div className="records">
          {visible.map((record) => {
            const value = String(record.title ?? record._id);
            const url = safeUrl(value);
            return (
              <article className="record" key={record._id}>
                <span className="record-icon">
                  <Icon name={url ? "link" : "text"} />
                </span>
                <div className="record-content">
                  <span className="eyebrow">{url ? "LINK" : "TEXT"}</span>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {value}
                    </a>
                  ) : (
                    <p>{value}</p>
                  )}
                </div>
                <div className="record-actions">
                  <button
                    className="button secondary"
                    onClick={() => setSelected(record)}
                  >
                    <Icon name="scan" /> Show QR
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() => setDeleting(record)}
                  >
                    <Icon name="trash" width="16" height="16" /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name={query ? "search" : "collection"} width="44" height="44" />
          <h2>
            {query
              ? "No matching discoveries"
              : "Make room for a little discovery."}
          </h2>
          <p>
            {query
              ? "Try another search. Your saved codes are still here."
              : "Your saved QR codes will appear here. Start with your first scan."}
          </p>
          {!query && (
            <Link to="/scanner" className="button primary">
              Scan a code <Icon name="arrow" />
            </Link>
          )}
        </div>
      )}
      <p className="privacy-note">
        <Icon name="shield" /> Saved in this browser. Clearing site data removes
        your collection.
      </p>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) close();
        }}
        aria-labelledby="dialog-title"
      >
        <button
          className="dialog-close text-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          <Icon name="close" />
        </button>
        <h2 id="dialog-title">
          {selected ? "Pass it on." : "Delete this code?"}
        </h2>
        {selected ? (
          <>
            <div className="export-qr" ref={qr} />
            <p className="code-value">{selected.title ?? selected._id}</p>
          </>
        ) : (
          <>
            <p>This removes the code from this device.</p>
            <p className="code-value">{deleting?.title ?? deleting?._id}</p>
            <button
              className="button delete-button"
              disabled={busy}
              onClick={remove}
            >
              {busy ? "Deleting…" : "Delete code"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Keep it
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Beeper home">
          <span className="brand-mark">
            <Icon name="scan" width="27" height="27" />
          </span>
          <span>
            beeper<small>SCAN · SAVE · SHARE</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink end to="/">
            <Icon name="home" />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/scanner">
            <Icon name="scan" />
            <span>Scan</span>
          </NavLink>
          <NavLink to="/settings">
            <Icon name="collection" />
            <span>Collection</span>
          </NavLink>
        </nav>
        <span className="header-note">
          <span className="status-dot" /> Stored on your device
        </span>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/settings" element={<Collection />} />
          <Route
            path="*"
            element={
              <section className="workspace">
                <h1>
                  Nothing here. <em>Yet.</em>
                </h1>
                <Link to="/" className="button primary">
                  Back to home
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer>
        <span>Small codes. Good connections.</span>
        <span>Beeper · Made for the curious.</span>
      </footer>
    </div>
  );
}
