"use client";

import { useState, useEffect, useCallback } from "react";

type Action = "check-in" | "break-in" | "break-out" | "check-out";
type Status = "checked-in" | "on-break" | "returned" | "checked-out" | null;

interface BreakSession {
  _id: string;
  breakIn: string;
  breakOut: string | null;
  duration: number;
}

interface TimeEntry {
  _id: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  breaks: BreakSession[];
  totalWorked: number;
  totalBreak: number;
  status: Status;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Compute live totals from the entry + current time */
function computeLiveTotals(entry: TimeEntry, now: Date): { workedMins: number; breakMins: number } {
  if (!entry.checkIn) return { workedMins: 0, breakMins: 0 };

  // For checked-out entries, use the server's final calculated values
  if (entry.status === "checked-out" && entry.checkOut) {
    return {
      workedMins: entry.totalWorked,
      breakMins: entry.totalBreak,
    };
  }

  // For all active statuses (checked-in, on-break, returned),
  // compute entirely from timestamps so totals tick live
  const checkInMs = new Date(entry.checkIn).getTime();
  const nowMs = now.getTime();

  let completedBreakMs = 0;
  let ongoingBreakMs = 0;

  for (const b of entry.breaks ?? []) {
    if (b.breakOut) {
      completedBreakMs += new Date(b.breakOut).getTime() - new Date(b.breakIn).getTime();
    } else {
      // Currently on break — accumulate live against now
      ongoingBreakMs = nowMs - new Date(b.breakIn).getTime();
    }
  }

  const totalBreakMs = completedBreakMs + ongoingBreakMs;
  const elapsedMs = Math.max(0, nowMs - checkInMs);
  const workedMs = Math.max(0, elapsedMs - totalBreakMs);

  return {
    workedMins: Math.floor(workedMs / 60000),
    breakMins: Math.floor(totalBreakMs / 60000),
  };
}

export default function TimeClockPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [fetching, setFetching] = useState(false);

  // Live totals — recalculated every second
  const [liveTotals, setLiveTotals] = useState({ workedMins: 0, breakMins: 0 });

  // Tick every second: update clock + live totals
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (entry) setLiveTotals(computeLiveTotals(entry, now));
    }, 1000);
    return () => clearInterval(timer);
  }, [entry]);

  // Recalculate immediately when entry changes
  useEffect(() => {
    if (entry) setLiveTotals(computeLiveTotals(entry, new Date()));
    else setLiveTotals({ workedMins: 0, breakMins: 0 });
  }, [entry]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const fetchStatus = useCallback(async (e: string, n: string) => {
    if (!e.trim() || !n.trim()) return;
    setFetching(true);
    try {
      const res = await fetch(
        `/api/time/punch?email=${encodeURIComponent(e.trim().toLowerCase())}&name=${encodeURIComponent(n.trim())}`
      );
      const data = await res.json();
      setEntry(data.entry || null);
    } catch {
      // silent
    } finally {
      setFetching(false);
    }
  }, []);

  const validateEmail = (val: string) => {
    if (!val) { setEmailError("Email is required"); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setEmailError("Enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleEmailBlur = () => {
    if (validateEmail(email) && name.trim()) fetchStatus(email, name);
  };

  const handleNameBlur = () => {
    if (name.trim() && validateEmail(email)) fetchStatus(email, name);
  };

  const handleCheckStatus = () => {
    if (!name.trim()) { setMessage({ text: "Please enter your name first", type: "error" }); return; }
    if (!validateEmail(email)) { setMessage({ text: "Please enter a valid email first", type: "error" }); return; }
    fetchStatus(email, name);
  };

  const handleAction = async (action: Action) => {
    if (!name.trim()) { setMessage({ text: "Please enter your name", type: "error" }); return; }
    if (!validateEmail(email)) { setMessage({ text: "Please enter a valid email", type: "error" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/time/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeName: name.trim(), email: email.trim().toLowerCase(), action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Action failed", type: "error" });
      } else {
        setMessage({ text: data.message, type: "success" });
        setEntry(data.entry);
      }
    } catch {
      setMessage({ text: "Network error, please try again", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const status: Status = entry?.status ?? null;

  const buttons: { action: Action; label: string; emoji: string; color: string; disabled: boolean }[] = [
    { action: "check-in",  label: "CHECK IN",  emoji: "🟢", color: "btn-checkin",  disabled: status !== null },
    { action: "break-in",  label: "BREAK",     emoji: "☕", color: "btn-break",    disabled: status !== "checked-in" && status !== "returned" },
    { action: "break-out", label: "RETURN",    emoji: "🔄", color: "btn-return",   disabled: status !== "on-break" },
    { action: "check-out", label: "CHECK OUT", emoji: "🔴", color: "btn-checkout", disabled: status === null || status === "on-break" || status === "checked-out" },
  ];

  const statusLabels: Record<NonNullable<Status>, string> = {
    "checked-in":  "🟢 WORKING",
    "on-break":    "☕ ON BREAK",
    returned:      "🔄 RETURNED",
    "checked-out": "🔴 CHECKED OUT",
  };

  const today = currentTime.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Whether to show the live pulse indicator on totals
  const isLive = status === "checked-in" || status === "on-break" || status === "returned";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0e14;
          color: #e8eaf0;
          font-family: 'Barlow', sans-serif;
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          background: #0a0e14;
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(0,200,100,0.04) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(0,120,255,0.04) 0%, transparent 60%),
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.015) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.015) 40px);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 16px 80px;
        }

        .header { text-align: center; margin-bottom: 48px; }

        .company-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          padding: 6px 14px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          letter-spacing: 2px;
          color: #7eb8ff;
          margin-bottom: 24px;
          text-transform: uppercase;
        }

        .dot { width: 6px; height: 6px; background: #00ff88; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }

        .logo-img {
          width: 72px; height: 72px; object-fit: contain;
          display: block; margin: 0 auto 16px;
          filter: drop-shadow(0 0 12px rgba(0,255,136,0.3));
        }

        h1 {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(36px, 8vw, 72px);
          font-weight: 800;
          letter-spacing: -1px;
          text-transform: uppercase;
          line-height: 1;
          color: #fff;
        }
        h1 span { color: #00ff88; }

        .live-clock {
          font-family: 'Share Tech Mono', monospace;
          font-size: clamp(42px, 10vw, 88px);
          color: #00ff88;
          letter-spacing: 4px;
          line-height: 1;
          margin: 24px 0 8px;
          text-shadow: 0 0 30px rgba(0,255,136,0.4);
          animation: flicker 8s infinite;
        }

        @keyframes flicker {
          0%, 95%, 100% { opacity: 1; }
          96% { opacity: 0.92; } 97% { opacity: 1; } 98% { opacity: 0.95; }
        }

        .date-display {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #6b7280;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 36px;
          position: relative;
          overflow: hidden;
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #00ff88, transparent);
        }

        .field-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #4b5563;
          margin-bottom: 8px;
        }

        .name-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          padding: 14px 18px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 24px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 1px;
          transition: all 0.2s;
          outline: none;
        }

        .name-input::placeholder { color: #374151; }
        .name-input:focus {
          border-color: #00ff88;
          background: rgba(0,255,136,0.05);
          box-shadow: 0 0 0 3px rgba(0,255,136,0.08);
        }
        .name-input.input-error {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.04);
        }

        .field-error {
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          color: #f87171;
          margin-top: 5px;
          letter-spacing: 0.5px;
        }

        .check-status-btn {
          width: 100%;
          margin-top: 14px;
          padding: 12px;
          background: rgba(126,184,255,0.08);
          border: 1px solid rgba(126,184,255,0.2);
          border-radius: 6px;
          color: #7eb8ff;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          flex-direction: row;
        }
        .check-status-btn:hover:not(:disabled) {
          background: rgba(126,184,255,0.15);
          border-color: rgba(126,184,255,0.4);
          box-shadow: 0 0 16px rgba(126,184,255,0.15);
        }
        .check-status-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .status-bar {
          margin-top: 14px;
          padding: 12px 18px;
          border-radius: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 48px;
        }

        .status-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          letter-spacing: 1px;
        }
        .status-idle { color: #4b5563; }

        .buttons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 28px;
        }

        button {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700;
          font-size: 17px;
          letter-spacing: 2px;
          text-transform: uppercase;
          border: none;
          border-radius: 6px;
          padding: 18px 10px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          position: relative;
          overflow: hidden;
        }

        button .btn-emoji { font-size: 22px; }
        button .btn-text  { font-size: 13px; letter-spacing: 2px; }
        button:active:not(:disabled) { transform: scale(0.97); }
        button::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0); transition: background 0.15s; }
        button:hover:not(:disabled)::after { background: rgba(255,255,255,0.06); }

        .btn-checkin  { background: rgba(0,200,80,0.15);   border: 1px solid rgba(0,255,100,0.3);   color: #00ff88; }
        .btn-break    { background: rgba(250,180,0,0.12);  border: 1px solid rgba(250,180,0,0.3);   color: #fbbf24; }
        .btn-return   { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3);  color: #60a5fa; }
        .btn-checkout { background: rgba(239,68,68,0.12);  border: 1px solid rgba(239,68,68,0.3);   color: #f87171; }

        .btn-checkin:not(:disabled):hover  { box-shadow: 0 0 20px rgba(0,255,136,0.2); }
        .btn-break:not(:disabled):hover    { box-shadow: 0 0 20px rgba(251,191,36,0.2); }
        .btn-return:not(:disabled):hover   { box-shadow: 0 0 20px rgba(96,165,250,0.2); }
        .btn-checkout:not(:disabled):hover { box-shadow: 0 0 20px rgba(239,68,68,0.2); }

        button:disabled { opacity: 0.2; cursor: not-allowed; filter: grayscale(0.5); }

        .toast {
          margin-top: 20px;
          padding: 12px 18px;
          border-radius: 6px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.5px;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .toast-success { background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.25); color: #00ff88; }
        .toast-error   { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.25);  color: #f87171; }

        /* ── TIMELINE ── */
        .timeline {
          margin-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 24px;
        }

        .timeline-title {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #374151;
          margin-bottom: 16px;
        }

        .timeline-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .timeline-row:last-child { border-bottom: none; }

        .timeline-label {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          letter-spacing: 1.5px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .timeline-value {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #d1d5db;
        }

        /* ── SUMMARY CHIPS ── */
        .summary-row {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }

        .summary-chip {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 12px 8px 10px;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s;
        }

        /* Glow border when live */
        .summary-chip.live-chip {
          border-color: rgba(0,255,136,0.2);
        }
        .summary-chip.live-chip-amber {
          border-color: rgba(251,191,36,0.25);
        }

        .summary-chip-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 8px;
          letter-spacing: 1.5px;
          color: #4b5563;
          text-transform: uppercase;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .summary-chip-value {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #00ff88;
          line-height: 1;
          letter-spacing: -0.5px;
          transition: color 0.2s;
        }

        .summary-chip-value.amber { color: #fbbf24; }
        .summary-chip-value.blue  { color: #60a5fa; }

        /* Live pulse dot inside chip label */
        .live-dot-sm {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #00ff88;
          display: inline-block;
          animation: pulse 1.2s infinite;
          flex-shrink: 0;
        }
        .live-dot-sm.amber { background: #fbbf24; }

        /* Break blocks */
        .break-block {
          margin: 6px 0;
          border-left: 2px solid rgba(251,191,36,0.3);
          padding-left: 10px;
        }

        .break-block-header {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #fbbf24;
          padding: 6px 0 2px;
          opacity: 0.8;
        }

        .timeline-row-indent { padding-left: 4px; }
        .accent-amber { color: #fbbf24 !important; }

        .live-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          color: #fbbf24;
          animation: pulse 1.5s infinite;
        }

        .loading-spinner {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          opacity: 0.6;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .footer-link {
          margin-top: 48px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          letter-spacing: 1.5px;
          color: #374151;
          text-transform: uppercase;
          text-align: center;
        }
        .footer-link a { color: #4b5563; text-decoration: none; transition: color 0.2s; }
        .footer-link a:hover { color: #7eb8ff; }

        @media (max-width: 480px) {
          .card { padding: 24px 20px; }
          .buttons-grid { gap: 8px; }
          button { padding: 14px 6px; }
          .live-clock { letter-spacing: 2px; }
          .logo-img { width: 56px; height: 56px; }
        }
      `}</style>

      <div className="page">
        <div className="header">
          <div className="company-badge">
            <span className="dot" />
            EMPLOYEE TIME CLOCK
          </div>
          <img src="/images/logov3.png" alt="Logo" className="logo-img" />
          <h1>TIME<span>TRACK</span></h1>
          <div className="live-clock">
            {currentTime.toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
            })}
          </div>
          <div className="date-display">{today}</div>
        </div>

        <div className="card">
          <div className="field-label">Your Email</div>
          <input
            className={`name-input${emailError ? " input-error" : ""}`}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
            onBlur={handleEmailBlur}
            onKeyDown={(e) => e.key === "Enter" && handleEmailBlur()}
            autoComplete="email"
          />
          {emailError && <p className="field-error">{emailError}</p>}

          <div className="field-label" style={{ marginTop: "16px" }}>Your Name</div>
          <input
            className="name-input"
            type="text"
            placeholder="Enter your full name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => e.key === "Enter" && handleNameBlur()}
            autoComplete="name"
          />

          <button className="check-status-btn" onClick={handleCheckStatus} disabled={fetching}>
            {fetching
              ? <><span className="loading-spinner" /> CHECKING...</>
              : <>🔍 CHECK MY STATUS</>}
          </button>

          <div className="status-bar">
            {fetching ? (
              <span className="status-text status-idle">
                <span className="loading-spinner" /> Fetching your status...
              </span>
            ) : status ? (
              <span className="status-text">{statusLabels[status]}</span>
            ) : (
              <span className="status-text status-idle">
                {email.trim() && name.trim()
                  ? "NO RECORD FOR TODAY — TAP CHECK MY STATUS"
                  : "ENTER EMAIL & NAME TO BEGIN"}
              </span>
            )}
          </div>

          <div className="buttons-grid">
            {buttons.map(({ action, label, emoji, color, disabled }) => (
              <button
                key={action}
                className={color}
                disabled={disabled || loading}
                onClick={() => handleAction(action)}
              >
                <span className="btn-emoji">{loading && !disabled ? "⏳" : emoji}</span>
                <span className="btn-text">{label}</span>
              </button>
            ))}
          </div>

          {message && (
            <div className={`toast ${message.type === "success" ? "toast-success" : "toast-error"}`}>
              {message.text}
            </div>
          )}

          {entry && (
            <div className="timeline">
              <div className="timeline-title">Today&apos;s Log</div>

              <div className="timeline-row">
                <span className="timeline-label">🟢 Check In</span>
                <span className="timeline-value">{formatTime(entry.checkIn)}</span>
              </div>

              {entry.breaks && entry.breaks.length > 0 && (
                entry.breaks.map((b, i) => (
                  <div key={b._id || i} className="break-block">
                    <div className="break-block-header">Break #{i + 1}</div>
                    <div className="timeline-row timeline-row-indent">
                      <span className="timeline-label">☕ Start</span>
                      <span className="timeline-value">{formatTime(b.breakIn)}</span>
                    </div>
                    <div className="timeline-row timeline-row-indent">
                      <span className="timeline-label">🔄 End</span>
                      <span className="timeline-value">
                        {b.breakOut ? formatTime(b.breakOut) : <span className="live-tag">ON BREAK</span>}
                      </span>
                    </div>
                    {b.duration > 0 && (
                      <div className="timeline-row timeline-row-indent">
                        <span className="timeline-label">⏱ Duration</span>
                        <span className="timeline-value accent-amber">{formatMinutes(b.duration)}</span>
                      </div>
                    )}
                  </div>
                ))
              )}

              <div className="timeline-row">
                <span className="timeline-label">🔴 Check Out</span>
                <span className="timeline-value">{formatTime(entry.checkOut)}</span>
              </div>

              {/* ── LIVE SUMMARY CHIPS ── */}
              <div className="summary-row">
                <div className={`summary-chip${isLive && status !== "on-break" ? " live-chip" : ""}`}>
                  <div className="summary-chip-label">
                    {isLive && status !== "on-break" && <span className="live-dot-sm" />}
                    Hours Worked
                  </div>
                  <div className="summary-chip-value">
                    {liveTotals.workedMins > 0 ? formatMinutes(liveTotals.workedMins) : "—"}
                  </div>
                </div>

                <div className={`summary-chip${isLive && status === "on-break" ? " live-chip-amber" : ""}`}>
                  <div className="summary-chip-label">
                    {isLive && status === "on-break" && <span className="live-dot-sm amber" />}
                    Total Break
                  </div>
                  <div className="summary-chip-value amber">
                    {liveTotals.breakMins > 0 ? formatMinutes(liveTotals.breakMins) : "—"}
                  </div>
                </div>

                <div className="summary-chip">
                  <div className="summary-chip-label">Breaks Taken</div>
                  <div className="summary-chip-value blue">
                    {entry.breaks?.length ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="footer-link">
          Admin?{" "}
          <a href="/login">Login to view all records →</a>
          <p>Crafted by Nikko with coffee and love ☕</p>
        </div>
      </div>
    </>
  );
}