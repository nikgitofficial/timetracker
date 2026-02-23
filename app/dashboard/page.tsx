"use client";

import { useEffect, useState } from "react";
import { HiHome, HiUser, HiCog, HiX, HiChevronRight, HiChevronLeft, HiLogout } from "react-icons/hi";

import DashboardHome from "./components/DashboardHome";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import Employees from "./components/Employees";


type User = {
  email: string;
  name: string;
  _id?: string;
  photoUrl?: string;
};

type Page = "dashboard" | "profile" | "settings" | "employees";

export default function DashboardSPA() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [loggingOut, setLoggingOut] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const fetchUser = async () => {
    try {
      let res = await fetch("/api/auth/me", { credentials: "include" });

      if (res.status === 401) {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (refreshRes.ok) {
          res = await fetch("/api/auth/me", { credentials: "include" });
        } else {
          setUser(null);
          return;
        }
      }

      if (!res.ok) { setUser(null); return; }

      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // proceed with logout regardless
    } finally {
      setLoggingOut(false);
      setUser(null);
      window.location.href = "/login";
    }
  };

  if (loading) {
    return (
      <div style={{
        background: "#f7f6f3", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "16px"
      }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#1a1916", opacity: 0.2,
              animation: `bounce 0.8s ${i * 0.15}s infinite`
            }} />
          ))}
        </div>
        <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.2} 40%{transform:scale(1);opacity:0.8} }`}</style>
        <span style={{ fontFamily: "'DM Mono', monospace", color: "#9ca3af", letterSpacing: "2px", fontSize: "10px", textTransform: "uppercase" }}>
          Loading
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ background: "#f7f6f3", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          background: "#fff", border: "1.5px solid #e4e2dd", borderRadius: "12px",
          padding: "40px 48px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.06)"
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: "18px", color: "#1a1916", marginBottom: "8px" }}>
            Access Restricted
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#9ca3af", fontSize: "12px", marginBottom: "20px" }}>
            You need to be logged in to continue
          </div>
          <a href="/login" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "#1a1916", color: "#fff", textDecoration: "none",
            padding: "10px 24px", borderRadius: "6px",
            fontFamily: "'DM Mono', monospace", fontSize: "12px",
            letterSpacing: "1px", textTransform: "uppercase"
          }}>
            Login →
          </a>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Home", icon: <HiHome size={17} />, key: "dashboard" },
    { name: "Profile", icon: <HiUser size={17} />, key: "profile" },
    { name: "Settings", icon: <HiCog size={17} />, key: "settings" },
    { name: "Employees", icon: <HiCog size={17} />, key: "employees" },
  ];

  const handlePhotoUpload = async (file: File) => {
    if (!file || !user._id) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/user/photo", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (res.ok && data.photo) {
        const updatedUrl = `${data.photo}?t=${Date.now()}`;
        setUser((prev) => (prev ? { ...prev, photoUrl: updatedUrl } : prev));
        setSnackbar({ open: true, message: "Profile picture updated successfully" });
        setTimeout(() => setSnackbar({ open: false, message: "" }), 3000);
      } else {
        alert(data.error || "Failed to upload profile picture");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload profile picture");
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard": return <DashboardHome user={user} />;
      case "profile": return <Profile user={user} onPhotoUpload={handlePhotoUpload} />;
      case "settings": return <Settings user={user} />;
      case "employees": return <Employees user={user} />;
      default: return null;
    }
  };

  const PAGE_LABELS: Record<Page, string> = {
    dashboard: "Records",
    profile: "Profile",
    settings: "Settings",
    employees: "Employees",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap');

        :root {
          --bg: #f7f6f3;
          --surface: #ffffff;
          --surface-alt: #f2f1ee;
          --border: #e4e2dd;
          --border-strong: #ccc9c2;
          --text: #1a1916;
          --text-muted: #7c7970;
          --text-light: #a8a49d;
          --accent: #1a1916;
          --sidebar-w: 240px;
          --topbar-h: 56px;
          --footer-h: 60px;
          --radius: 10px;
          --radius-sm: 6px;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --shadow-lg: 0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Cabinet Grotesk', sans-serif;
          -webkit-font-smoothing: antialiased;
          height: 100%;
        }

        /* ── LAYOUT ── */
        .spa-layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--bg);
        }

        /* ── SIDEBAR ── */
        .sidebar {
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1.5px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          inset-y: 0;
          left: 0;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: var(--shadow-lg);
        }

        .sidebar.open { transform: translateX(0); }

        @media (min-width: 768px) {
          .sidebar {
            transform: translateX(0);
            position: relative;
            flex-shrink: 0;
            box-shadow: none;
          }
        }

        /* ── SIDEBAR HEADER ── */
        .sidebar-header {
          padding: 20px 16px 18px;
          border-bottom: 1.5px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 900;
          font-size: 15px;
          color: var(--text);
          letter-spacing: -0.5px;
          align-self: flex-start;
        }

        .sidebar-logo-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.15);
        }

        .sidebar-logo img {
          width: 26px;
          height: 26px;
          object-fit: contain;
        }

        .avatar-wrap {
          position: relative;
          align-self: center;
        }

        .avatar-img {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 2px solid var(--border);
          object-fit: cover;
          display: block;
          transition: border-color 0.2s;
        }

        .avatar-wrap:hover .avatar-img { border-color: var(--border-strong); }

        .avatar-upload-label {
          position: absolute;
          bottom: -1px;
          right: -1px;
          background: var(--text);
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
          border: 2px solid var(--surface);
        }

        .avatar-upload-label:hover { background: #333; transform: scale(1.1); }
        .avatar-upload-label svg { color: #fff; }

        .sidebar-user-info {
          text-align: center;
          width: 100%;
        }

        .sidebar-username {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.2px;
        }

        .sidebar-useremail {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 8px;
        }

        /* ── SIDEBAR NAV ── */
        .sidebar-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
        }

        .nav-section-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-light);
          padding: 6px 10px 4px;
          margin-top: 4px;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          border-radius: var(--radius-sm);
          border: 1.5px solid transparent;
          background: transparent;
          color: var(--text-muted);
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
          width: 100%;
          text-align: left;
        }

        .nav-btn:hover {
          background: var(--surface-alt);
          color: var(--text);
        }

        .nav-btn.active {
          background: var(--surface-alt);
          border-color: var(--border);
          color: var(--text);
          font-weight: 700;
        }

        .nav-btn.active .nav-icon { color: var(--text); }
        .nav-icon { color: var(--text-light); flex-shrink: 0; transition: color 0.12s; }
        .nav-btn:hover .nav-icon { color: var(--text-muted); }

        .nav-active-bar {
          width: 3px; height: 14px;
          border-radius: 2px;
          background: var(--text);
          margin-left: auto;
          flex-shrink: 0;
        }

        /* ── SIDEBAR FOOTER ── */
        .sidebar-footer {
          padding: 12px 10px;
          border-top: 1.5px solid var(--border);
        }

        /* ── LOGOUT BUTTON ── */
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          border-radius: var(--radius-sm);
          border: 1.5px solid transparent;
          background: transparent;
          color: var(--text-muted);
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
          width: 100%;
          text-align: left;
        }

        .logout-btn:hover {
          background: #fff1f1;
          border-color: #fecaca;
          color: #dc2626;
        }

        .logout-btn:hover .logout-icon { color: #dc2626; }
        .logout-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .logout-icon {
          color: var(--text-light);
          flex-shrink: 0;
          transition: color 0.12s;
        }

        /* ── TOPBAR ── */
        .topbar {
          background: var(--surface);
          border-bottom: 1.5px solid var(--border);
          height: var(--topbar-h);
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 40;
          box-shadow: var(--shadow);
        }

        @media (min-width: 768px) {
          .topbar { left: var(--sidebar-w); }
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .topbar-mobile-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-weight: 900;
          font-size: 14px;
          color: var(--text);
        }

        .topbar-mobile-logo img { width: 22px; height: 22px; object-fit: contain; }

        @media (min-width: 768px) {
          .topbar-mobile-logo { display: none; }
        }

        .topbar-divider {
          width: 1px;
          height: 18px;
          background: var(--border);
        }

        .topbar-page {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .topbar-greeting {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.3px;
          display: none;
        }

        @media (min-width: 480px) {
          .topbar-greeting { display: block; }
        }

        .topbar-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1.5px solid var(--border);
          object-fit: cover;
          cursor: pointer;
          transition: border-color 0.15s;
        }

        .topbar-avatar:hover { border-color: var(--border-strong); }

        /* ── MAIN ── */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        @media (min-width: 768px) {
          .main-area { margin-left: var(--sidebar-w); }
        }

        .main-content {
          flex: 1;
          overflow-y: auto;
          padding-top: var(--topbar-h);
          padding-bottom: var(--footer-h);
          background: var(--bg);
        }

        @media (min-width: 768px) {
          .main-content { padding-bottom: 0; }
        }

        /* ── MOBILE TOGGLE ── */
        .sidebar-toggle {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          z-index: 60;
          background: var(--text);
          color: #fff;
          border: none;
          width: 20px;
          height: 44px;
          border-radius: 0 6px 6px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 2px 0 8px rgba(0,0,0,0.12);
        }

        .sidebar-toggle:hover { background: #333; }

        @media (min-width: 768px) {
          .sidebar-toggle { display: none; }
        }

        /* ── OVERLAY ── */
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,25,22,0.3);
          z-index: 45;
          backdrop-filter: blur(3px);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ── MOBILE FOOTER NAV ── */
        .mobile-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: var(--surface);
          border-top: 1.5px solid var(--border);
          display: flex;
          justify-content: space-around;
          align-items: center;
          height: var(--footer-h);
          box-shadow: 0 -4px 16px rgba(0,0,0,0.05);
        }

        @media (min-width: 768px) {
          .mobile-footer { display: none; }
        }

        .footer-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: transparent;
          border: none;
          color: var(--text-light);
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          cursor: pointer;
          padding: 6px 20px;
          border-radius: var(--radius-sm);
          transition: color 0.12s;
          position: relative;
        }

        .footer-btn.active {
          color: var(--text);
        }

        .footer-btn.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          background: var(--text);
          border-radius: 0 0 3px 3px;
        }

        .footer-btn:hover { color: var(--text-muted); }
        .footer-btn svg { transition: transform 0.12s; }
        .footer-btn.active svg { transform: scale(1.05); }

        /* ── SNACKBAR ── */
        .snackbar {
          position: fixed;
          top: calc(var(--topbar-h) + 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 70;
          background: var(--text);
          color: #fff;
          padding: 10px 16px 10px 20px;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-lg);
          animation: slideDown 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          white-space: nowrap;
        }

        .snackbar-check {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: rgba(34,197,94,0.2);
          border: 1px solid rgba(34,197,94,0.4);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 10px;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.96); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        .snackbar-close {
          background: rgba(255,255,255,0.12);
          border: none;
          border-radius: 4px;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          padding: 2px 4px;
          display: flex;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .snackbar-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
      `}</style>

      <div className="spa-layout">

        {/* ── SIDEBAR ── */}
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <img src="/images/logov3.png" alt="Logo" />
            <span style={{ color: "#22c55e" }}>CRIS</span>  TIME<span style={{ color: "#22c55e" }}>TRACK</span>
              <div className="sidebar-logo-dot" />
            </div>

            <div className="avatar-wrap">
              <img
                src={user.photoUrl || "https://via.placeholder.com/150"}
                alt="Profile"
                className="avatar-img"
              />
              <label className="avatar-upload-label" title="Change photo">
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={(e) => e.target.files && handlePhotoUpload(e.target.files[0])}
                />
                <HiUser size={10} />
              </label>
            </div>

            <div className="sidebar-user-info">
              <div className="sidebar-username">{user.name}</div>
              <div className="sidebar-useremail">{user.email}</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-label">Navigation</div>
            {navItems.map((item) => {
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  className={`nav-btn${isActive ? " active" : ""}`}
                  onClick={() => {
                    setActivePage(item.key as Page);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.name}
                  {isActive && <span className="nav-active-bar" />}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button
              className="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out"
            >
              <span className="logout-icon">
                <HiLogout size={17} />
              </span>
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </aside>

        {/* Mobile toggle */}
        <button
          className="sidebar-toggle"
          style={{ left: sidebarOpen ? "240px" : "0" }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <HiChevronLeft size={14} /> : <HiChevronRight size={14} />}
        </button>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── MAIN ── */}
        <div className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              {/* Mobile: show logo */}
              <div className="topbar-mobile-logo">
                <img src="/images/logov3.png" alt="Logo" />
                TIME<span style={{ color: "#22c55e" }}>TRACK</span>
              </div>
              <div className="topbar-divider" />
              <span className="topbar-page">{PAGE_LABELS[activePage]}</span>
            </div>
            <div className="topbar-right">
              <span className="topbar-greeting">Hi, {user.name}</span>
              <img
                src={user.photoUrl || "https://via.placeholder.com/150"}
                alt="Profile"
                className="topbar-avatar"
                onClick={() => setActivePage("profile")}
                title="Go to profile"
              />
            </div>
          </header>

          <main className="main-content">
            {renderPage()}
          </main>
        </div>

        {/* Mobile footer nav */}
        <footer className="mobile-footer">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`footer-btn${activePage === item.key ? " active" : ""}`}
              onClick={() => setActivePage(item.key as Page)}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          ))}
        </footer>

        {/* Snackbar */}
        {snackbar.open && (
          <div className="snackbar">
            <div className="snackbar-check">✓</div>
            <span>{snackbar.message}</span>
            <button className="snackbar-close" onClick={() => setSnackbar({ open: false, message: "" })}>
              <HiX size={13} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}