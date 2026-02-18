"use client";

import { useRef } from "react";
import { HiCamera, HiMail, HiUser, HiIdentification } from "react-icons/hi";

type User = {
  name: string;
  email: string;
  photoUrl?: string;
};

export default function Profile({
  user,
  onPhotoUpload,
}: {
  user: User;
  onPhotoUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <style>{`
        .profile-wrap {
          padding: 32px 28px;
          max-width: 620px;
        }

        .profile-header {
          margin-bottom: 28px;
        }

        .profile-title {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 22px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -0.5px;
        }

        .profile-subtitle {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-top: 3px;
        }

        /* ── AVATAR CARD ── */
        .profile-avatar-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          padding: 32px 28px;
          display: flex;
          align-items: center;
          gap: 28px;
          margin-bottom: 16px;
          position: relative;
          overflow: hidden;
        }

        .profile-avatar-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
        }

        @media (max-width: 480px) {
          .profile-avatar-card {
            flex-direction: column;
            text-align: center;
            padding: 28px 20px;
          }
          .profile-wrap {
            padding: 20px 16px;
          }
        }

        /* ── AVATAR ── */
        .avatar-container {
          position: relative;
          flex-shrink: 0;
        }

        .profile-avatar {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: 2.5px solid var(--border);
          object-fit: cover;
          display: block;
          transition: border-color 0.2s;
        }

        .avatar-fallback {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: 2.5px solid var(--border);
          background: var(--surface-alt);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 26px;
          font-weight: 900;
          color: var(--text-muted);
          letter-spacing: -1px;
          flex-shrink: 0;
        }

        .avatar-upload-btn {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--text);
          border: 2.5px solid var(--surface);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
          color: #fff;
        }

        .avatar-upload-btn:hover {
          background: #333;
          transform: scale(1.1);
        }

        /* ── USER META ── */
        .profile-meta {}

        .profile-name {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 20px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -0.4px;
          line-height: 1.2;
        }

        .profile-email {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
          letter-spacing: 0.2px;
        }

        .profile-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          padding: 4px 10px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 20px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #16a34a;
          font-weight: 500;
        }

        .badge-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
        }

        /* ── INFO CARDS ── */
        .profile-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 480px) {
          .profile-info-grid {
            grid-template-columns: 1fr;
          }
        }

        .info-card {
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .info-card-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: var(--surface-alt);
          border: 1.5px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
          margin-top: 1px;
        }

        .info-card-body {}

        .info-card-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-light);
          margin-bottom: 4px;
        }

        .info-card-value {
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          word-break: break-all;
        }

        /* ── UPLOAD HINT ── */
        .upload-hint {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: var(--text-light);
          letter-spacing: 0.3px;
          margin-top: 10px;
        }
      `}</style>

      <div className="profile-wrap">
        <div className="profile-header">
          <div className="profile-title">Profile</div>
          <div className="profile-subtitle">Your personal information</div>
        </div>

        {/* ── AVATAR CARD ── */}
        <div className="profile-avatar-card">
          <div className="avatar-container">
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt="Profile"
                className="profile-avatar"
              />
            ) : (
              <div className="avatar-fallback">{initials}</div>
            )}
            <button
              className="avatar-upload-btn"
              title="Change photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <HiCamera size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPhotoUpload(file);
              }}
            />
          </div>

          <div className="profile-meta">
            <div className="profile-name">{user.name}</div>
            <div className="profile-email">{user.email}</div>
            <div className="profile-badge">
              <span className="badge-dot" />
              Active
            </div>
            <div className="upload-hint">Click the camera icon to update your photo</div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="profile-info-grid">
          <div className="info-card">
            <div className="info-card-icon"><HiUser size={15} /></div>
            <div className="info-card-body">
              <div className="info-card-label">Full Name</div>
              <div className="info-card-value">{user.name}</div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon"><HiMail size={15} /></div>
            <div className="info-card-body">
              <div className="info-card-label">Email Address</div>
              <div className="info-card-value">{user.email}</div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon"><HiIdentification size={15} /></div>
            <div className="info-card-body">
              <div className="info-card-label">Display Name</div>
              <div className="info-card-value">{user.name.split(" ")[0]}</div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon">
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "-0.5px"
              }}>
                {initials}
              </span>
            </div>
            <div className="info-card-body">
              <div className="info-card-label">Initials</div>
              <div className="info-card-value">{initials}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}