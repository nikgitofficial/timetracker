"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import "./TimeClock.css";

type Action = "check-in" | "break-in" | "break-out" | "bio-break-in" | "bio-break-out" | "check-out";
type Status = "checked-in" | "on-break" | "on-bio-break" | "returned" | "checked-out" | null;

interface BreakSession {
  _id: string;
  breakIn: string;
  breakOut: string | null;
  duration: number;
}

interface SelfieEntry {
  _id: string;
  action: string;
  url: string;
  takenAt: string;
}

interface TimeEntry {
  _id: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  breaks: BreakSession[];
  bioBreaks: BreakSession[];
  totalWorked: number;
  totalBreak: number;
  totalBioBreak: number;
  status: Status;
  selfies?: SelfieEntry[];
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
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const actionLabels: Record<string, string> = {
  "check-in": "Check-In",
  "break-in": "Break",
  "break-out": "Return",
  "bio-break-in": "Bio Break",
  "bio-break-out": "End Bio",
  "check-out": "Check-Out",
};

export default function TimeClockPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [actionModal, setActionModal] = useState<{ action: Action; image: string; message: string } | null>(null);

  // ── LIGHTBOX STATE ── (ADDED)
  const [lightbox, setLightbox] = useState<{ selfies: SelfieEntry[]; index: number } | null>(null);

  // ── CAMERA STATE ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null); // base64 data URL
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const actionContent = {
    "check-in": {
      images: ["/images/checkin1.jpg", "/images/checkin2.jpg"],
      messages: [
        "Welcome! Let's make today productive guys alright rock in roll baby! 💪",
        "Good to see you!Waka na late hehehehe! 🚀",
      ],
    },
    "break-in": {
      images: ["/images/break1.jpg", "/images/break2.jpg"],
      messages: [
        "Time to recharge!eat well langga! ☕",
        "Take a breather, you've earned it! ayawg OB ha! 🌟",
      ],
    },
    "break-out": {
      images: ["/images/return1.jpg", "/images/return2.jpg"],
      messages: [
        "Back to action! Let's finish strong baby! 💯",
        "Refreshed and ready! Let's go lannga ! ⚡",
      ],
    },
    "bio-break-in": {
      images: ["/images/break1.jpg", "/images/break2.jpg"],
      messages: [
        "Quick bio break! Don't be too long ha! 🚻",
        "Nature calls! Back in a work! 💨",
      ],
    },
    "bio-break-out": {
      images: ["/images/return1.jpg", "/images/return2.jpg"],
      messages: [
        "Back to the grind! 💪",
        "Fresh and ready to go langga! ✅",
      ],
    },
    "check-out": {
      images: ["/images/checkout1.jpg", "/images/checkout2.jpg"],
      messages: [
        "Great work today! Time to rest!good night po lannga 🌙",
        "You've earned your rest. See you tomorrow lannga!goodnight and sleep well po 👋",
      ],
    },
  };

  const getActionContent = (action: Action) => {
    const content = actionContent[action];
    const randomIndex = Math.floor(Math.random() * 2);
    return { image: content.images[randomIndex], message: content.messages[randomIndex] };
  };

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-clear message
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // ── START CAMERA when modal opens ──
  useEffect(() => {
    if (actionModal) {
      setCapturedPhoto(null);
      setCameraError(null);
      setCameraReady(false);
      setPhotoUploaded(false);
      setCountdown(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionModal]);

  // ── LIGHTBOX KEYBOARD NAV ── (ADDED)
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.selfies.length) % lb.selfies.length } : lb);
      if (e.key === "ArrowRight") setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.selfies.length } : lb);
      if (e.key === "Escape")     setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
          // Auto-countdown starts after camera is ready
          startCountdown();
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access denied or unavailable.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = () => {
    setCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        capturePhoto();
      }
    }, 1000);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror the image (selfie style)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
    // Auto-upload
    uploadPhoto(dataUrl);
  };

  const uploadPhoto = async (dataUrl: string) => {
    if (!actionModal) return;
    setUploadingPhoto(true);
    try {
      // Convert base64 to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", email.trim().toLowerCase());
      formData.append("employeeName", name.trim());
      formData.append("action", actionModal.action);

      const uploadRes = await fetch("/api/time/selfie", {
        method: "POST",
        body: formData,
      });
      const data = await uploadRes.json();
      if (uploadRes.ok) {
        setPhotoUploaded(true);
        // Update local entry with new selfie
        if (data.entry) setEntry(data.entry);
      } else {
        console.error("Selfie upload failed:", data.error);
      }
    } catch (err) {
      console.error("Selfie upload error:", err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoUploaded(false);
    startCamera();
  };

  const closeModal = () => {
    stopCamera();
    if (countdownRef.current) clearInterval(countdownRef.current);
    setActionModal(null);
  };

  // Fetch today's status
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
        const { image, message: msg } = getActionContent(action);
        setActionModal({ action, image, message: msg });
      }
    } catch {
      setMessage({ text: "Network error, please try again", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const status: Status = entry?.status ?? null;

  const liveWorkedMins = entry
    ? (() => {
        if (!entry.checkIn) return 0;
        if (entry.totalWorked > 0) return entry.totalWorked;
        const spanMins = Math.round((currentTime.getTime() - new Date(entry.checkIn).getTime()) / 60000);
        return Math.max(0, spanMins - (entry.totalBreak || 0) - (entry.totalBioBreak || 0));
      })()
    : 0;

  const buttons: { action: Action; label: string; emoji: string; color: string; disabled: boolean }[] = [
    { action: "check-in", label: "CHECK IN", emoji: "🟢", color: "btn-checkin", disabled: status !== null },
    { action: "break-in", label: "BREAK", emoji: "☕", color: "btn-break", disabled: status !== "checked-in" && status !== "returned" },
    { action: "break-out", label: "RETURN", emoji: "🔄", color: "btn-return", disabled: status !== "on-break" },
    { action: "bio-break-in", label: "BIO BREAK", emoji: "🚻", color: "btn-bio", disabled: status !== "checked-in" && status !== "returned" },
    { action: "bio-break-out", label: "END BIO", emoji: "✅", color: "btn-bio-return", disabled: status !== "on-bio-break" },
    { action: "check-out", label: "CHECK OUT", emoji: "🔴", color: "btn-checkout", disabled: status === null || status === "on-break" || status === "on-bio-break" || status === "checked-out" },
  ];

  const statusLabels: Record<NonNullable<Status>, string> = {
    "checked-in": "🟢 WORKING",
    "on-break": "☕ ON BREAK",
    "on-bio-break": "🚻 BIO BREAK",
    returned: "🔄 RETURNED",
    "checked-out": "🔴 CHECKED OUT",
  };

  const today = currentTime.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="page">
        <div className="header">
          <div className="company-badge">
            <span className="dot" />
            EMPLOYEE TIME CLOCK
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <img src="/images/logov3.png" alt="Logo" style={{ width: 64, height: 64, objectFit: "contain" }} />
            <h1><span>CRIS</span>TIME<span>TRACK</span></h1>
            
          </div>
          
          <div className="live-clock">
            {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </div>
          <div className="date-display">{today}</div>
        </div>
      
        <div className="card">
          {/* Email */}
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

          {/* Name */}
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
            {fetching ? <><span className="loading-spinner" /> CHECKING...</> : <>🔍 CHECK MY STATUS</>}
          </button>

          <div className="status-bar">
            {fetching ? (
              <span className="status-text status-idle"><span className="loading-spinner" /> Fetching your status...</span>
            ) : status ? (
              <span className="status-text">{statusLabels[status]}</span>
            ) : (
              <span className="status-text status-idle">
                {email.trim() && name.trim() ? "NO RECORD FOR TODAY — TAP CHECK MY STATUS" : "ENTER EMAIL & NAME TO BEGIN"}
              </span>
            )}
          </div>

          {/* Main 4 buttons */}
          <div className="buttons-grid">
            {buttons.filter(b => ["check-in", "break-in", "break-out", "check-out"].includes(b.action)).map(({ action, label, emoji, color, disabled }) => (
              <button key={action} className={color} disabled={disabled || loading} onClick={() => handleAction(action)}>
                <span className="btn-emoji">{loading && !disabled ? "⏳" : emoji}</span>
                <span className="btn-text">{label}</span>
              </button>
            ))}
          </div>

          {/* Bio break */}
          <div className="bio-section-label">
            🚻 Bio Break <span style={{ color: "#2dd4bf", fontSize: 8 }}>(Malibang|Mangihi or Matug · WATER · QUICK PERSONAL)</span>
          </div>
          <div className="bio-grid">
            {buttons.filter(b => ["bio-break-in", "bio-break-out"].includes(b.action)).map(({ action, label, emoji, color, disabled }) => (
              <button key={action} className={color} disabled={disabled || loading} onClick={() => handleAction(action)}>
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

              {entry.breaks?.length > 0 && entry.breaks.map((b, i) => (
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
              ))}

              {entry.bioBreaks?.length > 0 && entry.bioBreaks.map((b, i) => (
                <div key={b._id || i} className="bio-block">
                  <div className="bio-block-header">🚻 Bio Break #{i + 1}</div>
                  <div className="timeline-row timeline-row-indent">
                    <span className="timeline-label">Start</span>
                    <span className="timeline-value">{formatTime(b.breakIn)}</span>
                  </div>
                  <div className="timeline-row timeline-row-indent">
                    <span className="timeline-label">End</span>
                    <span className="timeline-value">
                      {b.breakOut ? formatTime(b.breakOut) : <span className="live-tag-teal">BIO BREAK</span>}
                    </span>
                  </div>
                  {b.duration > 0 && (
                    <div className="timeline-row timeline-row-indent">
                      <span className="timeline-label">⏱ Duration</span>
                      <span className="timeline-value accent-teal">{formatMinutes(b.duration)}</span>
                    </div>
                  )}
                </div>
              ))}

              <div className="timeline-row">
                <span className="timeline-label">🔴 Check Out</span>
                <span className="timeline-value">{formatTime(entry.checkOut)}</span>
              </div>

              <div className="summary-row">
                <div className="summary-chip">
                  <div className="summary-chip-label">Hours Worked</div>
                  <div className="summary-chip-value">{liveWorkedMins > 0 ? formatMinutes(liveWorkedMins) : "—"}</div>
                </div>
                <div className="summary-chip">
                  <div className="summary-chip-label">Total Break</div>
                  <div className="summary-chip-value amber">{entry.totalBreak > 0 ? formatMinutes(entry.totalBreak) : "—"}</div>
                </div>
                <div className="summary-chip">
                  <div className="summary-chip-label">Bio Break</div>
                  <div className="summary-chip-value teal">{entry.totalBioBreak > 0 ? formatMinutes(entry.totalBioBreak) : "—"}</div>
                </div>
                <div className="summary-chip">
                  <div className="summary-chip-label">Breaks Taken</div>
                  <div className="summary-chip-value blue">{entry.breaks?.length ?? 0}</div>
                </div>
              </div>

              {/* ── SELFIE GALLERY ── */}
              {entry.selfies && entry.selfies.length > 0 && (
                <div className="selfie-gallery">
                  <div className="selfie-gallery-title">📸 Today&apos;s Selfies</div>
                  <div className="selfie-grid">
                    {/* UPDATED: added index + onClick to open lightbox */}
                    {entry.selfies.map((s, i) => (
                      <div
                        key={s._id}
                        className="selfie-item"
                        onClick={() => setLightbox({ selfies: entry.selfies!, index: i })}
                      >
                        <img src={s.url} alt={s.action} />
                        <div className="selfie-badge">{actionLabels[s.action] ?? s.action}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ACTION MODAL with Camera ── */}
        {actionModal && (
          <div className="action-modal-overlay" onClick={closeModal}>
            <div
              className={`action-modal${actionModal.action.includes("bio") ? " bio" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={actionModal.image}
                alt={actionModal.action}
                className="action-modal-image"
                onError={(e) => { e.currentTarget.src = "/images/logov3.png"; }}
              />

              <div className="action-modal-content">
                <div className="action-modal-title">
                  {actionModal.action === "check-in" && "✅ CHECKED IN!"}
                  {actionModal.action === "break-in" && "☕ ON BREAK!"}
                  {actionModal.action === "break-out" && "🔄 BACK TO WORK!"}
                  {actionModal.action === "bio-break-in" && "🚻 BIO BREAK!"}
                  {actionModal.action === "bio-break-out" && "✅ BACK TO WORK!"}
                  {actionModal.action === "check-out" && "👋 CHECKED OUT!"}
                </div>

                <div className="action-modal-message">{actionModal.message}</div>

                {/* ── CAMERA / SELFIE SECTION ── */}
                <div className="camera-section">
                  {!capturedPhoto && !cameraError && (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted />
                      {cameraReady && countdown !== null && (
                        <div className="camera-overlay">
                          <div className="countdown-ring" key={countdown}>{countdown}</div>
                        </div>
                      )}
                      {!cameraReady && (
                        <div style={{ padding: "24px", textAlign: "center" }}>
                          <span className="loading-spinner" style={{ color: "#00ff88" }} />
                          <p style={{ marginTop: 8, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#6b7280", letterSpacing: 1 }}>
                            STARTING CAMERA...
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {cameraError && (
                    <div className="camera-error-box">
                      <p className="camera-error-text">📵 {cameraError}</p>
                      <p style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#4b5563", marginTop: 6, letterSpacing: 1 }}>
                        SELFIE SKIPPED
                      </p>
                    </div>
                  )}

                  {capturedPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capturedPhoto} alt="Your selfie" className="camera-captured-photo" />
                  )}

                  {(capturedPhoto || cameraReady) && (
                    <div className="camera-status-bar">
                      <span className={`camera-status-text ${uploadingPhoto ? "uploading" : photoUploaded ? "done" : ""}`}>
                        {uploadingPhoto
                          ? "⏳ UPLOADING..."
                          : photoUploaded
                            ? "✅ SELFIE SAVED"
                            : capturedPhoto
                              ? "📸 CAPTURED"
                              : countdown !== null
                                ? `📷 AUTO IN ${countdown}s`
                                : "📷 READY"}
                      </span>
                      {capturedPhoto && !uploadingPhoto && (
                        <div className="camera-btn-row">
                          <button className="btn-retake btn-camera-action" onClick={retakePhoto}>
                            🔄 RETAKE
                          </button>
                        </div>
                      )}
                      {cameraReady && !capturedPhoto && (
                        <div className="camera-btn-row">
                          <button className="btn-manual-capture btn-camera-action" onClick={() => {
                            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
                            setCountdown(null);
                            capturePhoto();
                          }}>
                            📸 SNAP NOW
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button className="action-modal-close" onClick={closeModal}>
                  ✕ CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SELFIE LIGHTBOX ── (ADDED) */}
        {lightbox && (
          <div className="selfie-lightbox-overlay" onClick={() => setLightbox(null)}>
            <div className="selfie-lightbox-inner" onClick={e => e.stopPropagation()}>
              <button className="selfie-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
              <img
                src={lightbox.selfies[lightbox.index].url}
                alt="selfie"
                className="selfie-lightbox-img"
              />
              <div className="selfie-lightbox-footer">
                <button
                  className="selfie-lightbox-nav"
                  disabled={lightbox.selfies.length <= 1}
                  onClick={() => setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.selfies.length) % lb.selfies.length } : lb)}
                >‹</button>
                <div className="selfie-lightbox-info">
                  <div className="selfie-lightbox-action">
                    {actionLabels[lightbox.selfies[lightbox.index].action] ?? lightbox.selfies[lightbox.index].action}
                  </div>
                  <div className="selfie-lightbox-time">
                    {new Date(lightbox.selfies[lightbox.index].takenAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    &nbsp;·&nbsp;{lightbox.index + 1} / {lightbox.selfies.length}
                  </div>
                </div>
                <button
                  className="selfie-lightbox-nav"
                  disabled={lightbox.selfies.length <= 1}
                  onClick={() => setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.selfies.length } : lb)}
                >›</button>
              </div>
              {lightbox.selfies.length > 1 && (
                <div className="selfie-lightbox-dots">
                  {lightbox.selfies.map((_, i) => (
                    <button
                      key={i}
                      className={`selfie-lightbox-dot${i === lightbox.index ? " active" : ""}`}
                      style={{ width: i === lightbox.index ? 18 : 6 }}
                      onClick={() => setLightbox(lb => lb ? { ...lb, index: i } : lb)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="footer-link">
          Admin?{" "}
          <a href="/login">Login to view all records →</a>
          <p>Crafted by Nikko with coffee and love ☕</p>
          <p>A gift from nikko to nationgraph family</p>
          <p>Under OM mirah cluster lead by:TL Cris Arandilla</p>
        </div>
      </div>
    </>
  );
}