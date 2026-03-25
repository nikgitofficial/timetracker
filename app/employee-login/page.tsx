"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register-password";

export default function EmployeeLoginPage() {
  const router = useRouter();

  const [name,            setName]            = useState("");
  const [password,        setPassword]        = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStrength,      setPwStrength]      = useState(0);

  const [mode,       setMode]       = useState<Mode>("login");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [showNewPw,  setShowNewPw]  = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("employeeSession");
    if (stored) router.push("/employee-portal");
  }, [router]);

  // Password strength meter
  useEffect(() => {
    if (!newPassword) { setPwStrength(0); return; }
    let score = 0;
    if (newPassword.length >= 6)           score++;
    if (newPassword.length >= 10)          score++;
    if (/[A-Z]/.test(newPassword))         score++;
    if (/[0-9]/.test(newPassword))         score++;
    if (/[^A-Za-z0-9]/.test(newPassword))  score++;
    setPwStrength(score);
  }, [newPassword]);

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][pwStrength] || "";
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"][pwStrength] || "#e4e2dd";

  const resetForm = () => {
    setError(""); setSuccessMsg("");
    setPassword(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setShowPw(false); setShowNewPw(false);
  };
  const switchMode = (m: Mode) => { setMode(m); resetForm(); };

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/employee-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     name.trim(),
          password: password.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid credentials"); return; }
      sessionStorage.setItem("employeeSession", JSON.stringify(data.employee));
      router.push("/employee-portal");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── SET / CHANGE PASSWORD ─────────────────────────────────────────────────
  const handleRegisterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccessMsg(""); setLoading(true);
    try {
      const res  = await fetch("/api/employee-auth/register-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:            name.trim(),
          currentPassword: currentPassword.trim() || undefined,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setSuccessMsg(data.message || "Password set! You can now sign in.");
      setTimeout(() => switchMode("login"), 2200);
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
        body { font-family: 'Cabinet Grotesk', sans-serif; background: #f7f6f3; min-height: 100vh; -webkit-font-smoothing: antialiased; }

        .page {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 24px; background: #f7f6f3; position: relative; overflow: hidden;
        }
        .page::before {
          content: ''; position: absolute; inset: 0;
          background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }

        .card {
          background: #fff; border: 1.5px solid #e4e2dd; border-radius: 16px;
          padding: 36px 40px 32px; width: 100%; max-width: 400px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
          opacity: 0; transform: translateY(16px);
          animation: slideIn 0.4s cubic-bezier(0.34,1.2,0.64,1) 0.1s forwards;
        }
        @keyframes slideIn { to { opacity: 1; transform: translateY(0); } }

        .mode-tabs { display: flex; background: #f7f6f3; border: 1.5px solid #e4e2dd; border-radius: 8px; padding: 3px; margin-bottom: 24px; }
        .mode-tab  { flex: 1; padding: 7px 10px; border: none; background: transparent; border-radius: 6px;
          font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.5px; color: #7c7970;
          cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .mode-tab.active { background: #1a1916; color: #fff; font-weight: 600; }

        .logo-row { display: flex; align-items: center; gap: 8px; margin-bottom: 22px; }
        .logo-img  { width: 28px; height: 28px; object-fit: contain; }
        .logo-text { font-family: 'Cabinet Grotesk', sans-serif; font-size: 15px; font-weight: 900; color: #1a1916; letter-spacing: -0.3px; }
        .logo-dot  { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.15); flex-shrink: 0; }

        .heading    { font-family: 'Cabinet Grotesk', sans-serif; font-size: 22px; font-weight: 900; color: #1a1916; letter-spacing: -0.75px; margin-bottom: 4px; }
        .subheading { font-family: 'DM Mono', monospace; font-size: 10px; color: #a8a49d; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 22px; }

        .field { margin-bottom: 14px; }
        .label { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #7c7970; display: block; margin-bottom: 5px; }

        .input-wrap { position: relative; }
        .input {
          width: 100%; background: #f7f6f3; border: 1.5px solid #e4e2dd; border-radius: 8px;
          padding: 11px 40px 11px 42px;
          font-family: 'DM Mono', monospace; font-size: 13px; color: #1a1916;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .input:focus { border-color: #1a1916; background: #fff; box-shadow: 0 0 0 3px rgba(26,25,22,0.06); }
        .input::placeholder { color: #c8c5be; }
        .input-no-pr { padding-right: 14px; }

        .input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #a8a49d; font-size: 14px; pointer-events: none; line-height: 1; }
        .pw-toggle  { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-family: 'DM Mono', monospace; font-size: 9px; color: #7c7970; letter-spacing: 0.5px; border-radius: 4px; transition: color 0.12s; }
        .pw-toggle:hover { color: #1a1916; }

        .pw-strength-wrap { margin-top: 6px; }
        .pw-strength-bar  { height: 3px; border-radius: 2px; background: #e4e2dd; overflow: hidden; margin-bottom: 3px; }
        .pw-strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }
        .pw-strength-lbl  { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.5px; }

        .hint { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-family: 'DM Mono', monospace; font-size: 9px; color: #a8a49d; }
        .hint-dot { width: 4px; height: 4px; border-radius: 50%; background: #c8c5be; flex-shrink: 0; }

        .section-divider { display: flex; align-items: center; gap: 10px; margin: 14px 0 12px; }
        .section-divider-line { flex: 1; height: 1px; background: #e4e2dd; }
        .section-divider-lbl  { font-family: 'DM Mono', monospace; font-size: 9px; color: #c8c5be; letter-spacing: 1.5px; text-transform: uppercase; white-space: nowrap; }

        .error-box {
          background: #fff1f1; border: 1.5px solid #fecaca; border-radius: 8px;
          padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
          font-family: 'DM Mono', monospace; font-size: 11px; color: #b91c1c;
          animation: shake 0.3s ease;
        }
        .success-box {
          background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px;
          padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
          font-family: 'DM Mono', monospace; font-size: 11px; color: #15803d;
        }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

        .btn {
          width: 100%; padding: 12px 20px; background: #1a1916; color: #fff; border: none; border-radius: 8px;
          font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: -0.2px;
          cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px;
        }
        .btn:hover:not(:disabled) { background: #2d2c29; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.6; cursor: wait; }
        .btn-green { background: #16a34a; }
        .btn-green:hover:not(:disabled) { background: #15803d; }

        .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider { height: 1px; background: #e4e2dd; margin: 20px 0; }
        .footer-link { text-align: center; font-family: 'DM Mono', monospace; font-size: 10px; color: #a8a49d; letter-spacing: 0.5px; }
        .footer-link a { color: #1a1916; text-decoration: none; font-weight: 500; border-bottom: 1px solid #ccc9c2; padding-bottom: 1px; transition: border-color 0.15s; }
        .footer-link a:hover { border-color: #1a1916; }

        .badge-row { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
        .badge { font-family: 'DM Mono', monospace; font-size: 9px; padding: 3px 8px; border-radius: 20px; border: 1px solid; letter-spacing: 0.3px; font-weight: 600; }
        .badge-green { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
        .badge-blue  { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }

        .info-box { background: #f5f3ff; border: 1.5px solid #ddd6fe; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-family: 'DM Mono', monospace; font-size: 10px; color: #5b21b6; line-height: 1.6; }

        .no-pw-hint { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 9px 13px; margin-top: 10px; font-family: 'DM Mono', monospace; font-size: 9px; color: #92400e; line-height: 1.6; }
      `}</style>

      <div className="page">
        <div className="card">

          {/* Logo */}
          <div className="logo-row">
            <img src="/images/logov3.png" alt="Logo" className="logo-img"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="logo-text">
              <span style={{ color: "#22c55e" }}>CRIS</span> TIME<span style={{ color: "#22c55e" }}>TRACK</span>
            </span>
            <div className="logo-dot" />
          </div>

          {/* Mode tabs */}
          <div className="mode-tabs">
            <button className={`mode-tab${mode === "login" ? " active" : ""}`} onClick={() => switchMode("login")}>
              🔑 Sign In
            </button>
            <button className={`mode-tab${mode === "register-password" ? " active" : ""}`} onClick={() => switchMode("register-password")}>
              🔒 Set Password
            </button>
          </div>

          {/* ── LOGIN ── */}
          {mode === "login" && (
            <>
              <h1 className="heading">Employee Portal</h1>
              <p className="subheading">Sign in to view your attendance</p>

              <div className="badge-row">
                <span className="badge badge-green">✓ Secure</span>
                <span className="badge badge-blue">📅 Calendar</span>
                <span className="badge badge-green">⏱ Time Records</span>
              </div>

              <form onSubmit={handleLogin}>
                <div className="field">
                  <label className="label" htmlFor="login-name">Your Name</label>
                  <div className="input-wrap">
                    <span className="input-icon">👤</span>
                    <input id="login-name" className="input input-no-pr" type="text"
                      placeholder="e.g. John Smith" value={name}
                      onChange={e => setName(e.target.value)}
                      required autoComplete="name" autoFocus />
                  </div>
                  <div className="hint"><span className="hint-dot" />Enter your full name exactly as registered</div>
                </div>

                <div className="field">
                  <label className="label" htmlFor="login-pw">
                    Password <span style={{ color: "#c8c5be", fontWeight: 400 }}>(leave blank if not set yet)</span>
                  </label>
                  <div className="input-wrap">
                    <span className="input-icon">🔑</span>
                    <input id="login-pw" className="input"
                      type={showPw ? "text" : "password"}
                      placeholder="Your private password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password" />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                      {showPw ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>

                {error && <div className="error-box"><span>⚠</span><span>{error}</span></div>}

                <button className="btn" type="submit" disabled={loading || !name.trim()}>
                  {loading ? <><div className="spinner" /> Signing in…</> : <>Sign In →</>}
                </button>

                {!error && (
                  <div className="no-pw-hint">
                    💡 No password yet? Leave the password blank and sign in with your name only, then go to <strong>Set Password</strong> to secure your account.
                  </div>
                )}
              </form>

              <div className="divider" />
              <div className="footer-link">
                Team manager? <a href="/login">Admin login here</a>
              </div>
            </>
          )}

          {/* ── SET / CHANGE PASSWORD ── */}
          {mode === "register-password" && (
            <>
              <h1 className="heading">Set Your Password</h1>
              <p className="subheading">Secure your account with a private password</p>

              <div className="info-box">
                🔒 First time? Enter your name and choose a password. After this, only you can sign in to your account.
              </div>

              <form onSubmit={handleRegisterPassword}>
                <div className="field">
                  <label className="label" htmlFor="reg-name">Your Name</label>
                  <div className="input-wrap">
                    <span className="input-icon">👤</span>
                    <input id="reg-name" className="input input-no-pr" type="text"
                      placeholder="e.g. John Smith" value={name}
                      onChange={e => setName(e.target.value)} required autoComplete="name" autoFocus />
                  </div>
                  <div className="hint"><span className="hint-dot" />Must match your registered name exactly</div>
                </div>

                <div className="field">
                  <label className="label" htmlFor="reg-current-pw">
                    Current Password <span style={{ color: "#c8c5be", fontWeight: 400 }}>(leave blank if first time)</span>
                  </label>
                  <div className="input-wrap">
                    <span className="input-icon">🔓</span>
                    <input id="reg-current-pw" className="input"
                      type={showPw ? "text" : "password"}
                      placeholder="Only required if changing password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      autoComplete="current-password" />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                      {showPw ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>

                <div className="section-divider">
                  <div className="section-divider-line" />
                  <span className="section-divider-lbl">New Password</span>
                  <div className="section-divider-line" />
                </div>

                <div className="field">
                  <label className="label" htmlFor="reg-new-pw">New Password</label>
                  <div className="input-wrap">
                    <span className="input-icon">🔒</span>
                    <input id="reg-new-pw" className="input"
                      type={showNewPw ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required autoComplete="new-password" />
                    <button type="button" className="pw-toggle" onClick={() => setShowNewPw(v => !v)}>
                      {showNewPw ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="pw-strength-wrap">
                      <div className="pw-strength-bar">
                        <div className="pw-strength-fill" style={{ width: `${(pwStrength / 5) * 100}%`, background: strengthColor }} />
                      </div>
                      <span className="pw-strength-lbl" style={{ color: strengthColor }}>{strengthLabel}</span>
                    </div>
                  )}
                </div>

                <div className="field">
                  <label className="label" htmlFor="reg-confirm-pw">Confirm Password</label>
                  <div className="input-wrap">
                    <span className="input-icon">✅</span>
                    <input id="reg-confirm-pw" className="input input-no-pr"
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required autoComplete="new-password" />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <div className="hint" style={{ color: "#ef4444" }}>
                      <span className="hint-dot" style={{ background: "#ef4444" }} />Passwords don&apos;t match
                    </div>
                  )}
                  {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                    <div className="hint" style={{ color: "#16a34a" }}>
                      <span className="hint-dot" style={{ background: "#16a34a" }} />Passwords match ✓
                    </div>
                  )}
                </div>

                {error      && <div className="error-box"><span>⚠</span><span>{error}</span></div>}
                {successMsg && <div className="success-box"><span>✓</span><span>{successMsg}</span></div>}

                <button className="btn btn-green" type="submit"
                  disabled={loading || !name.trim() || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}>
                  {loading ? <><div className="spinner" /> Saving…</> : <>🔒 Set Password</>}
                </button>
              </form>

              <div className="divider" />
              <div className="footer-link">
                Already have a password?{" "}
                <a href="#" onClick={e => { e.preventDefault(); switchMode("login"); }}>Sign in here</a>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}