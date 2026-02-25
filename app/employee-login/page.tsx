"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if already logged in as employee
    const stored = sessionStorage.getItem("employeeSession");
    if (stored) {
      router.push("/employee-portal");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/employee-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }

      // Store session in sessionStorage
      sessionStorage.setItem("employeeSession", JSON.stringify(data.employee));
      router.push("/employee-portal");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
          font-family: 'Cabinet Grotesk', sans-serif;
          background: #f7f6f3;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #f7f6f3;
          position: relative;
          overflow: hidden;
        }

        /* subtle grid pattern */
        .page::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .card {
          background: #fff;
          border: 1.5px solid #e4e2dd;
          border-radius: 16px;
          padding: 40px 40px 36px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
          position: relative;
          opacity: 0;
          transform: translateY(16px);
          animation: slideIn 0.4s cubic-bezier(0.34,1.2,0.64,1) 0.1s forwards;
        }

        @keyframes slideIn {
          to { opacity: 1; transform: translateY(0); }
        }

        .logo-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 28px;
        }

        .logo-img {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        .logo-text {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 15px;
          font-weight: 900;
          color: #1a1916;
          letter-spacing: -0.3px;
        }

        .logo-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.15);
          flex-shrink: 0;
        }

        .heading {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 900;
          color: #1a1916;
          letter-spacing: -0.75px;
          margin-bottom: 6px;
        }

        .subheading {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: #a8a49d;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 28px;
        }

        .field {
          margin-bottom: 16px;
        }

        .label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #7c7970;
          display: block;
          margin-bottom: 6px;
        }

        .input-wrap {
          position: relative;
        }

        .input {
          width: 100%;
          background: #f7f6f3;
          border: 1.5px solid #e4e2dd;
          border-radius: 8px;
          padding: 11px 14px 11px 42px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          color: #1a1916;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .input:focus {
          border-color: #1a1916;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(26,25,22,0.06);
        }

        .input::placeholder {
          color: #c8c5be;
        }

        .input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #a8a49d;
          font-size: 14px;
          pointer-events: none;
          line-height: 1;
        }

        .hint {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          color: #a8a49d;
          letter-spacing: 0.3px;
        }

        .hint-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #c8c5be;
          flex-shrink: 0;
        }

        .error-box {
          background: #fff1f1;
          border: 1.5px solid #fecaca;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #b91c1c;
          animation: shake 0.3s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .btn {
          width: 100%;
          padding: 12px 20px;
          background: #1a1916;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.2px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
          position: relative;
          overflow: hidden;
        }

        .btn:hover:not(:disabled) {
          background: #2d2c29;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
          height: 1px;
          background: #e4e2dd;
          margin: 24px 0;
        }

        .footer-link {
          text-align: center;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: #a8a49d;
          letter-spacing: 0.5px;
        }

        .footer-link a {
          color: #1a1916;
          text-decoration: none;
          font-weight: 500;
          border-bottom: 1px solid #ccc9c2;
          padding-bottom: 1px;
          transition: border-color 0.15s;
        }

        .footer-link a:hover {
          border-color: #1a1916;
        }

        .badge-row {
          display: flex;
          gap: 6px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .badge {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          padding: 3px 8px;
          border-radius: 20px;
          border: 1px solid;
          letter-spacing: 0.3px;
          font-weight: 600;
        }

        .badge-green { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
        .badge-blue  { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo-row">
            <img src="/images/logov3.png" alt="Logo" className="logo-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="logo-text">
              <span style={{ color: "#22c55e" }}>CRIS</span> TIME<span style={{ color: "#22c55e" }}>TRACK</span>
            </span>
            <div className="logo-dot" />
          </div>

          <h1 className="heading">Employee Portal</h1>
          <p className="subheading">Sign in to view your attendance</p>

          <div className="badge-row">
            <span className="badge badge-green">✓ Secure</span>
            <span className="badge badge-blue">📅 Calendar</span>
            <span className="badge badge-green">⏱ Time Records</span>
          </div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label className="label" htmlFor="name">Your Name</label>
              <div className="input-wrap">
                <span className="input-icon">👤</span>
                <input
                  id="name"
                  className="input"
                  type="text"
                  placeholder="e.g. John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  autoFocus
                />
              </div>
              <div className="hint">
                <span className="hint-dot" />
                Enter your full name exactly as registered
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="email">Email (Password)</label>
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
  id="email"
  className="input"
  type="password"
  placeholder="Enter your password"
  value={email}
  onChange={e => setEmail(e.target.value)}
  required
  autoComplete="current-password"
/>
              </div>
              <div className="hint">
                <span className="hint-dot" />
                Your email address is your password
              </div>
            </div>

            {error && (
              <div className="error-box">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button className="btn" type="submit" disabled={loading || !name.trim() || !email.trim()}>
              {loading ? (
                <><div className="spinner" /> Signing in…</>
              ) : (
                <>Sign In →</>
              )}
            </button>
          </form>

          <div className="divider" />

          <div className="footer-link">
            Team manager? <a href="/login">Admin login here</a>
          </div>
        </div>
      </div>
    </>
  );
}