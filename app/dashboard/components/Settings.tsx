"use client";

import { useState } from "react";
import { HiUser, HiLockClosed, HiBell, HiShieldCheck, HiChevronRight, HiCheck, HiEye, HiEyeOff } from "react-icons/hi";

type Props = {
  user: {
    email: string;
    name: string;
  };
};

type Section = "account" | "password" | "notifications" | "privacy";

export default function SettingsPage({ user }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("account");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    weeklyReport: false,
    projectAlerts: true,
    teamActivity: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    activityVisible: false,
    emailVisible: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    { key: "account", label: "Account", icon: <HiUser size={15} /> },
    { key: "password", label: "Password", icon: <HiLockClosed size={15} /> },
    { key: "notifications", label: "Notifications", icon: <HiBell size={15} /> },
    { key: "privacy", label: "Privacy", icon: <HiShieldCheck size={15} /> },
  ] as const;

  return (
    <>
      <style>{`
        .settings-wrap {
          padding: 32px 28px;
          max-width: 780px;
        }

        .settings-header {
          margin-bottom: 28px;
        }

        .settings-title {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 22px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -0.5px;
        }

        .settings-subtitle {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-top: 3px;
        }

        /* ── TWO-COLUMN LAYOUT ── */
        .settings-body {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 20px;
          align-items: start;
        }

        @media (max-width: 560px) {
          .settings-body {
            grid-template-columns: 1fr;
          }
          .settings-wrap {
            padding: 20px 16px;
          }
        }

        /* ── LEFT NAV ── */
        .settings-nav {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .settings-nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 14px;
          width: 100%;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s;
          text-align: left;
          border-bottom: 1.5px solid var(--border);
        }

        .settings-nav-item:last-child {
          border-bottom: none;
        }

        .settings-nav-item:hover {
          background: var(--surface-alt);
          color: var(--text);
        }

        .settings-nav-item.active {
          background: var(--surface-alt);
          color: var(--text);
          font-weight: 700;
        }

        .settings-nav-icon {
          color: var(--text-light);
          flex-shrink: 0;
          transition: color 0.12s;
        }

        .settings-nav-item.active .settings-nav-icon,
        .settings-nav-item:hover .settings-nav-icon {
          color: var(--text-muted);
        }

        .settings-nav-chevron {
          margin-left: auto;
          color: var(--text-light);
          opacity: 0;
          transition: opacity 0.12s;
        }

        .settings-nav-item.active .settings-nav-chevron,
        .settings-nav-item:hover .settings-nav-chevron {
          opacity: 1;
        }

        /* ── PANEL ── */
        .settings-panel {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .panel-header {
          padding: 18px 22px 16px;
          border-bottom: 1.5px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .panel-header-icon {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-sm);
          background: var(--surface-alt);
          border: 1.5px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .panel-title {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }

        .panel-desc {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          margin-top: 1px;
          letter-spacing: 0.3px;
        }

        .panel-body {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* ── FIELD ── */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 500;
        }

        .field-value {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 14px;
          color: var(--text);
          font-weight: 500;
          padding: 9px 13px;
          background: var(--surface-alt);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
        }

        .field-input {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 14px;
          color: var(--text);
          padding: 9px 13px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }

        .field-input:focus {
          border-color: var(--border-strong);
        }

        .field-input::placeholder {
          color: var(--text-light);
        }

        .field-input-wrap {
          position: relative;
        }

        .field-input-wrap .field-input {
          padding-right: 40px;
        }

        .pw-toggle {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          display: flex;
          padding: 2px;
          transition: color 0.12s;
        }

        .pw-toggle:hover { color: var(--text-muted); }

        /* ── DIVIDER ── */
        .field-divider {
          height: 1px;
          background: var(--border);
          margin: 2px 0;
        }

        /* ── TOGGLE ROW ── */
        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1.5px solid var(--border);
        }

        .toggle-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .toggle-row:first-child {
          padding-top: 0;
        }

        .toggle-info {}

        .toggle-label {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .toggle-hint {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          margin-top: 2px;
          letter-spacing: 0.2px;
        }

        /* ── SWITCH ── */
        .switch {
          position: relative;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }

        .switch-track {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          background: var(--border-strong);
          cursor: pointer;
          transition: background 0.2s;
          border: 1.5px solid transparent;
        }

        .switch input:checked + .switch-track {
          background: #1a1916;
        }

        .switch-track::after {
          content: '';
          position: absolute;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #fff;
          top: 50%;
          left: 2px;
          transform: translateY(-50%);
          transition: left 0.2s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .switch input:checked + .switch-track::after {
          left: 18px;
        }

        /* ── SAVE BTN ── */
        .panel-footer {
          padding: 14px 22px;
          border-top: 1.5px solid var(--border);
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .save-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          background: var(--text);
          color: #fff;
          border: none;
          border-radius: var(--radius-sm);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }

        .save-btn:hover { background: #333; }
        .save-btn:active { transform: scale(0.97); }

        .save-btn.saved {
          background: #16a34a;
        }

        .save-hint {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 0.3px;
        }
      `}</style>

      <div className="settings-wrap">
        <div className="settings-header">
          <div className="settings-title">Settings</div>
          <div className="settings-subtitle">Manage your account preferences</div>
        </div>

        <div className="settings-body">
          {/* ── LEFT NAV ── */}
          <nav className="settings-nav">
            {sections.map((s) => (
              <button
                key={s.key}
                className={`settings-nav-item${activeSection === s.key ? " active" : ""}`}
                onClick={() => setActiveSection(s.key)}
              >
                <span className="settings-nav-icon">{s.icon}</span>
                {s.label}
                <span className="settings-nav-chevron"><HiChevronRight size={12} /></span>
              </button>
            ))}
          </nav>

          {/* ── PANEL ── */}
          <div className="settings-panel">
            {activeSection === "account" && (
              <>
                <div className="panel-header">
                  <div className="panel-header-icon"><HiUser size={15} /></div>
                  <div>
                    <div className="panel-title">Account Information</div>
                    <div className="panel-desc">Your name and email address</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="field-group">
                    <div className="field-label">Full Name</div>
                    <div className="field-value">{user.name}</div>
                  </div>
                  <div className="field-group">
                    <div className="field-label">Email Address</div>
                    <div className="field-value">{user.email}</div>
                  </div>
                  <div className="field-group">
                    <div className="field-label">Member Since</div>
                    <div className="field-value" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                </div>
                <div className="panel-footer">
                  <span className="save-hint">Contact support to update account details</span>
                </div>
              </>
            )}

            {activeSection === "password" && (
              <>
                <div className="panel-header">
                  <div className="panel-header-icon"><HiLockClosed size={15} /></div>
                  <div>
                    <div className="panel-title">Change Password</div>
                    <div className="panel-desc">Update your account password</div>
                  </div>
                </div>
                <div className="panel-body">
                  <div className="field-group">
                    <div className="field-label">Current Password</div>
                    <div className="field-input-wrap">
                      <input
                        className="field-input"
                        type={showCurrentPw ? "text" : "password"}
                        placeholder="Enter current password"
                      />
                      <button className="pw-toggle" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                        {showCurrentPw ? <HiEyeOff size={15} /> : <HiEye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className="field-divider" />
                  <div className="field-group">
                    <div className="field-label">New Password</div>
                    <div className="field-input-wrap">
                      <input
                        className="field-input"
                        type={showNewPw ? "text" : "password"}
                        placeholder="Enter new password"
                      />
                      <button className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
                        {showNewPw ? <HiEyeOff size={15} /> : <HiEye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className="field-group">
                    <div className="field-label">Confirm New Password</div>
                    <div className="field-input-wrap">
                      <input
                        className="field-input"
                        type={showConfirmPw ? "text" : "password"}
                        placeholder="Confirm new password"
                      />
                      <button className="pw-toggle" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                        {showConfirmPw ? <HiEyeOff size={15} /> : <HiEye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="panel-footer">
                  <button className={`save-btn${saved ? " saved" : ""}`} onClick={handleSave}>
                    {saved ? <><HiCheck size={13} /> Saved</> : "Update Password"}
                  </button>
                </div>
              </>
            )}

            {activeSection === "notifications" && (
              <>
                <div className="panel-header">
                  <div className="panel-header-icon"><HiBell size={15} /></div>
                  <div>
                    <div className="panel-title">Notifications</div>
                    <div className="panel-desc">Choose what you want to be notified about</div>
                  </div>
                </div>
                <div className="panel-body" style={{ gap: 0 }}>
                  {[
                    { key: "emailUpdates", label: "Email Updates", hint: "Product news and announcements" },
                    { key: "weeklyReport", label: "Weekly Report", hint: "Summary of your time tracked" },
                    { key: "projectAlerts", label: "Project Alerts", hint: "Deadlines and project milestones" },
                    { key: "teamActivity", label: "Team Activity", hint: "When teammates log time" },
                  ].map(({ key, label, hint }) => (
                    <div className="toggle-row" key={key}>
                      <div className="toggle-info">
                        <div className="toggle-label">{label}</div>
                        <div className="toggle-hint">{hint}</div>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={notifications[key as keyof typeof notifications]}
                          onChange={() =>
                            setNotifications((prev) => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))
                          }
                        />
                        <span className="switch-track" />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="panel-footer">
                  <button className={`save-btn${saved ? " saved" : ""}`} onClick={handleSave}>
                    {saved ? <><HiCheck size={13} /> Saved</> : "Save Preferences"}
                  </button>
                </div>
              </>
            )}

            {activeSection === "privacy" && (
              <>
                <div className="panel-header">
                  <div className="panel-header-icon"><HiShieldCheck size={15} /></div>
                  <div>
                    <div className="panel-title">Privacy</div>
                    <div className="panel-desc">Control what others can see about you</div>
                  </div>
                </div>
                <div className="panel-body" style={{ gap: 0 }}>
                  {[
                    { key: "profileVisible", label: "Public Profile", hint: "Your profile is visible to team members" },
                    { key: "activityVisible", label: "Activity Visibility", hint: "Show your recent activity to others" },
                    { key: "emailVisible", label: "Email Visibility", hint: "Display your email on your profile" },
                  ].map(({ key, label, hint }) => (
                    <div className="toggle-row" key={key}>
                      <div className="toggle-info">
                        <div className="toggle-label">{label}</div>
                        <div className="toggle-hint">{hint}</div>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={privacy[key as keyof typeof privacy]}
                          onChange={() =>
                            setPrivacy((prev) => ({ ...prev, [key]: !prev[key as keyof typeof privacy] }))
                          }
                        />
                        <span className="switch-track" />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="panel-footer">
                  <button className={`save-btn${saved ? " saved" : ""}`} onClick={handleSave}>
                    {saved ? <><HiCheck size={13} /> Saved</> : "Save Preferences"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}