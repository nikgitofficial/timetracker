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

interface EmployeeProfile {
  employeeName: string;
  email: string;
  profilePic: string;
  role: "OM" | "TL" | "Agent" | "Other";
  campaign: string;
  status: "active" | "on-leave" | "absent" | "inactive";
}

const ROLE_COLOR: Record<string, string> = {
  OM: "#7c3aed", TL: "#1d4ed8", Agent: "#15803d", Other: "#6b7280",
};
const ROLE_BG: Record<string, string> = {
  OM: "rgba(124,58,237,0.15)", TL: "rgba(29,78,216,0.15)", Agent: "rgba(21,128,61,0.15)", Other: "rgba(107,114,128,0.12)",
};

function formatTime(isoString: string | null): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatMinutes(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const actionLabels: Record<string, string> = {
  "check-in": "Check-In", "break-in": "Break", "break-out": "Return",
  "bio-break-in": "Bio Break", "bio-break-out": "End Bio", "check-out": "Check-Out",
};

export default function TimeClockPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [actionModal, setActionModal] = useState<{ action: Action; image: string; message: string } | null>(null);

  // ── EMPLOYEE PROFILE STATE ──────────────────────────────────────
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [employeeChoices, setEmployeeChoices] = useState<EmployeeProfile[]>([]); // ✅ multiple matches
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── DATE PICKER ─────────────────────────────────────────────────
  const today = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isHistorical, setIsHistorical] = useState(false);
  const [historicalEntry, setHistoricalEntry] = useState<TimeEntry | null>(null);
  const [fetchingHistorical, setFetchingHistorical] = useState(false);
  const [historicalMessage, setHistoricalMessage] = useState<string | null>(null);

  // ── LIGHTBOX ─────────────────────────────────────────────────────
  const [lightbox, setLightbox] = useState<{ selfies: SelfieEntry[]; index: number } | null>(null);

  // ── CAMERA ───────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const actionContent = {
    "check-in":     { images: ["/images/checkin1.jpg",  "/images/checkin2.jpg"],  messages: ["Welcome! Let's make today productive guys alright rock in roll baby! 💪", "Good to see you! Waka na late hehehehe! 🚀"] },
    "break-in":     { images: ["/images/break1.jpg",    "/images/break2.jpg"],    messages: ["Time to recharge! eat well langga! ☕", "Take a breather, you've earned it! ayawg OB ha! 🌟"] },
    "break-out":    { images: ["/images/return1.jpg",   "/images/return2.jpg"],   messages: ["Back to action! Let's finish strong baby! 💯", "Refreshed and ready! Let's go langga! ⚡"] },
    "bio-break-in": { images: ["/images/break1.jpg",    "/images/break2.jpg"],    messages: ["Quick bio break! Don't be too long ha! 🚻", "Nature calls! Back in a bit! 💨"] },
    "bio-break-out":{ images: ["/images/return1.jpg",   "/images/return2.jpg"],   messages: ["Back to the grind! 💪", "Fresh and ready to go langga! ✅"] },
    "check-out":    { images: ["/images/checkout1.jpg", "/images/checkout2.jpg"], messages: ["Great work today! good night po langga 🌙", "You've earned your rest. See you tomorrow langga! 👋"] },
  };

  const getActionContent = (action: Action) => {
    const c = actionContent[action];
    const i = Math.floor(Math.random() * 2);
    return { image: c.images[i], message: c.messages[i] };
  };

  useEffect(() => {
    setCurrentTime(new Date());
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(t); }
  }, [message]);

  useEffect(() => {
    setIsHistorical(selectedDate !== today);
    setHistoricalEntry(null);
    setHistoricalMessage(null);
  }, [selectedDate, today]);

  useEffect(() => {
    if (actionModal) {
      setCapturedPhoto(null); setCameraError(null); setCameraReady(false);
      setPhotoUploaded(false); setCountdown(null);
      startCamera();
    } else { stopCamera(); }
    return () => { stopCamera(); if (countdownRef.current) clearInterval(countdownRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionModal]);

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

  // ── EMPLOYEE LOOKUP ──────────────────────────────────────────────
  const lookupEmployee = useCallback(async (emailVal: string) => {
    const val = emailVal.trim().toLowerCase();
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setEmployeeProfile(null);
      setEmployeeChoices([]);
      setLookupDone(false);
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/employees/lookup?email=${encodeURIComponent(val)}`);
      const data = await res.json();

      if (data.employees && data.employees.length > 1) {
        // ✅ Multiple matches — show name picker
        setEmployeeChoices(data.employees);
        setEmployeeProfile(null);
        setName("");
        setLookupDone(true);
      } else if (data.employee) {
        // Single match — auto-fill as before
        setEmployeeProfile(data.employee);
        setEmployeeChoices([]);
        setName(data.employee.employeeName);
        setLookupDone(true);
      } else {
        setEmployeeProfile(null);
        setEmployeeChoices([]);
        setLookupDone(true);
      }
    } catch {
      setEmployeeProfile(null);
      setEmployeeChoices([]);
      setLookupDone(false);
    } finally {
      setLookingUp(false);
    }
  }, []);

  // ✅ Called when user picks their name from the list
  const handleSelectProfile = (profile: EmployeeProfile) => {
    setEmployeeProfile(profile);
    setEmployeeChoices([]);
    setName(profile.employeeName);
    fetchStatus(email, profile.employeeName);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setEmailError("");
    setEmployeeProfile(null);
    setEmployeeChoices([]);
    setLookupDone(false);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => lookupEmployee(val), 750);
  };

  // ── CAMERA FUNCTIONS ─────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); setCameraReady(true); startCountdown(); };
      }
    } catch { setCameraError("Camera access denied or unavailable."); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraReady(false);
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const startCountdown = () => {
    setCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1; setCountdown(count);
      if (count <= 0) { clearInterval(countdownRef.current!); countdownRef.current = null; setCountdown(null); capturePhoto(); }
    }, 1000);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height); ctx.restore();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl); stopCamera(); uploadPhoto(dataUrl);
  };

  const uploadPhoto = async (dataUrl: string) => {
    if (!actionModal) return;
    setUploadingPhoto(true);
    try {
      const res = await fetch(dataUrl); const blob = await res.blob();
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("file", file); fd.append("email", email.trim().toLowerCase());
      fd.append("employeeName", name.trim()); fd.append("action", actionModal.action);
      const uploadRes = await fetch("/api/time/selfie", { method: "POST", body: fd });
      const data = await uploadRes.json();
      if (uploadRes.ok) { setPhotoUploaded(true); if (data.entry) setEntry(data.entry); }
    } catch { /* silent */ }
    finally { setUploadingPhoto(false); }
  };

  const retakePhoto = () => { setCapturedPhoto(null); setPhotoUploaded(false); startCamera(); };
  const closeModal = () => { stopCamera(); if (countdownRef.current) clearInterval(countdownRef.current); setActionModal(null); };

  // ── FETCH STATUS ─────────────────────────────────────────────────
  const fetchStatus = useCallback(async (e: string, n: string) => {
    if (!e.trim() || !n.trim()) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/time/punch?email=${encodeURIComponent(e.trim().toLowerCase())}&name=${encodeURIComponent(n.trim())}`);
      const data = await res.json();
      setEntry(data.entry || null);
    } catch { /* silent */ }
    finally { setFetching(false); }
  }, []);

  const fetchHistoricalRecord = useCallback(async (date: string) => {
    if (!email.trim() || !name.trim()) { setMessage({ text: "Please enter your email and name first", type: "error" }); return; }
    if (!validateEmail(email)) { setMessage({ text: "Please enter a valid email first", type: "error" }); return; }
    setFetchingHistorical(true); setHistoricalEntry(null); setHistoricalMessage(null);
    try {
      const res = await fetch(`/api/time/myrecord?email=${encodeURIComponent(email.trim().toLowerCase())}&name=${encodeURIComponent(name.trim())}&date=${date}`);
      const data = await res.json();
      if (data.entry) setHistoricalEntry(data.entry);
      else setHistoricalMessage(`No record found for ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
    } catch { setHistoricalMessage("Failed to fetch record. Please try again."); }
    finally { setFetchingHistorical(false); }
  }, [email, name]);

  const validateEmail = (val: string) => {
    if (!val) { setEmailError("Email is required"); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setEmailError("Enter a valid email address"); return false; }
    setEmailError(""); return true;
  };

  const handleEmailBlur = () => {
    if (validateEmail(email)) {
      lookupEmployee(email);
      if (name.trim()) fetchStatus(email, name);
    }
  };

  const handleNameBlur = () => {
    if (name.trim() && validateEmail(email)) fetchStatus(email, name);
  };

  const handleCheckStatus = () => {
    if (!name.trim()) { setMessage({ text: "Please enter your name first", type: "error" }); return; }
    if (!validateEmail(email)) { setMessage({ text: "Please enter a valid email first", type: "error" }); return; }
    if (isHistorical) fetchHistoricalRecord(selectedDate);
    else fetchStatus(email, name);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value); setHistoricalEntry(null); setHistoricalMessage(null);
  };

  // ── PUNCH ACTION ─────────────────────────────────────────────────
  const handleAction = async (action: Action) => {
    if (!name.trim()) { setMessage({ text: "Please enter your name", type: "error" }); return; }
    if (!validateEmail(email)) { setMessage({ text: "Please enter a valid email", type: "error" }); return; }

    if (!employeeProfile) {
      setMessage({ text: "⛔ Your email is not in the employee roster. Please contact your admin.", type: "error" });
      return;
    }
    if (employeeProfile.status !== "active") {
      setMessage({ text: `⛔ Your status is "${employeeProfile.status.replace("-", " ")}". Only active employees can clock in.`, type: "error" });
      return;
    }
    if (employeeProfile.employeeName.trim().toLowerCase() !== name.trim().toLowerCase()) {
      setMessage({ text: `⛔ Name mismatch. Please use your registered name: "${employeeProfile.employeeName}"`, type: "error" });
      return;
    }

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
    } catch { setMessage({ text: "Network error, please try again", type: "error" }); }
    finally { setLoading(false); }
  };

  // ── DERIVED ──────────────────────────────────────────────────────
  const status: Status = entry?.status ?? null;
  const liveWorkedMins = entry && currentTime
    ? (() => {
        if (!entry.checkIn) return 0;
        if (entry.totalWorked > 0) return entry.totalWorked;
        const spanMins = Math.round((currentTime.getTime() - new Date(entry.checkIn).getTime()) / 60000);
        return Math.max(0, spanMins - (entry.totalBreak || 0) - (entry.totalBioBreak || 0));
      })()
    : 0;

  const isAllowed = !!employeeProfile && employeeProfile.status === "active";

  const buttons: { action: Action; label: string; emoji: string; color: string; disabled: boolean }[] = [
    { action: "check-in",     label: "CHECK IN",  emoji: "🟢", color: "btn-checkin",    disabled: status !== null },
    { action: "break-in",     label: "BREAK",     emoji: "☕", color: "btn-break",      disabled: status !== "checked-in" && status !== "returned" },
    { action: "break-out",    label: "RETURN",    emoji: "🔄", color: "btn-return",     disabled: status !== "on-break" },
    { action: "check-out",    label: "CHECK OUT", emoji: "🔴", color: "btn-checkout",   disabled: status === null || status === "on-break" || status === "on-bio-break" || status === "checked-out" },
  ];
  const bioButtons: { action: Action; label: string; emoji: string; color: string; disabled: boolean }[] = [
    { action: "bio-break-in",  label: "BIO BREAK", emoji: "🚻", color: "btn-bio",        disabled: status !== "checked-in" && status !== "returned" },
    { action: "bio-break-out", label: "END BIO",   emoji: "✅", color: "btn-bio-return", disabled: status !== "on-bio-break" },
  ];

  const statusLabels: Record<NonNullable<Status>, string> = {
    "checked-in": "🟢 WORKING", "on-break": "☕ ON BREAK", "on-bio-break": "🚻 BIO BREAK",
    returned: "🔄 RETURNED", "checked-out": "🔴 CHECKED OUT",
  };

  const todayDisplay = currentTime
    ? currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
  const liveClockDisplay = currentTime
    ? currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "--:--:--";

  // ── RENDER TIMELINE ──────────────────────────────────────────────
  const renderTimeline = (rec: TimeEntry, liveWorked?: number) => {
    const worked = liveWorked !== undefined ? liveWorked : rec.totalWorked;
    return (
      <div className="timeline">
        <div className="timeline-title">
          {rec.date === today ? "Today's Log" : `Record for ${new Date(rec.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`}
        </div>
        <div className="timeline-row"><span className="timeline-label">🟢 Check In</span><span className="timeline-value">{formatTime(rec.checkIn)}</span></div>
        {rec.breaks?.length > 0 && rec.breaks.map((b, i) => (
          <div key={b._id || i} className="break-block">
            <div className="break-block-header">Break #{i + 1}</div>
            <div className="timeline-row timeline-row-indent"><span className="timeline-label">☕ Start</span><span className="timeline-value">{formatTime(b.breakIn)}</span></div>
            <div className="timeline-row timeline-row-indent"><span className="timeline-label">🔄 End</span><span className="timeline-value">{b.breakOut ? formatTime(b.breakOut) : <span className="live-tag">ON BREAK</span>}</span></div>
            {b.duration > 0 && <div className="timeline-row timeline-row-indent"><span className="timeline-label">⏱ Duration</span><span className="timeline-value accent-amber">{formatMinutes(b.duration)}</span></div>}
          </div>
        ))}
        {rec.bioBreaks?.length > 0 && rec.bioBreaks.map((b, i) => (
          <div key={b._id || i} className="bio-block">
            <div className="bio-block-header">🚻 Bio Break #{i + 1}</div>
            <div className="timeline-row timeline-row-indent"><span className="timeline-label">Start</span><span className="timeline-value">{formatTime(b.breakIn)}</span></div>
            <div className="timeline-row timeline-row-indent"><span className="timeline-label">End</span><span className="timeline-value">{b.breakOut ? formatTime(b.breakOut) : <span className="live-tag-teal">BIO BREAK</span>}</span></div>
            {b.duration > 0 && <div className="timeline-row timeline-row-indent"><span className="timeline-label">⏱ Duration</span><span className="timeline-value accent-teal">{formatMinutes(b.duration)}</span></div>}
          </div>
        ))}
        <div className="timeline-row"><span className="timeline-label">🔴 Check Out</span><span className="timeline-value">{formatTime(rec.checkOut)}</span></div>
        <div className="summary-row">
          <div className="summary-chip"><div className="summary-chip-label">Hours Worked</div><div className="summary-chip-value">{worked > 0 ? formatMinutes(worked) : "—"}</div></div>
          <div className="summary-chip"><div className="summary-chip-label">Total Break</div><div className="summary-chip-value amber">{rec.totalBreak > 0 ? formatMinutes(rec.totalBreak) : "—"}</div></div>
          <div className="summary-chip"><div className="summary-chip-label">Bio Break</div><div className="summary-chip-value teal">{rec.totalBioBreak > 0 ? formatMinutes(rec.totalBioBreak) : "—"}</div></div>
          <div className="summary-chip"><div className="summary-chip-label">Breaks</div><div className="summary-chip-value blue">{rec.breaks?.length ?? 0}</div></div>
        </div>
        {rec.selfies && rec.selfies.length > 0 && (
          <div className="selfie-gallery">
            <div className="selfie-gallery-title">📸 {rec.date === today ? "Today's" : "Day's"} Selfies</div>
            <div className="selfie-grid">
              {rec.selfies.map((s, i) => (
                <div key={s._id} className="selfie-item" onClick={() => setLightbox({ selfies: rec.selfies!, index: i })}>
                  <img src={s.url} alt={s.action} />
                  <div className="selfie-badge">{actionLabels[s.action] ?? s.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="page">

        {/* ── HEADER ── */}
        <div className="header">
          <div className="company-badge"><span className="dot" />EMPLOYEE TIME CLOCK</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <img src="/images/logov3.png" alt="Logo" style={{ width: 64, height: 64, objectFit: "contain" }} />
            <h1><span>CRIS</span>TIME<span>TRACK</span></h1>
          </div>
          <div className="live-clock">{liveClockDisplay}</div>
          <div className="date-display">{todayDisplay}</div>
        </div>

        <div className="card">

          {/* ── EMPLOYEE PROFILE CARD ── */}
          {employeeProfile && (
            <div className="emp-profile-card">
              <div className="epc-avatar-wrap">
                <img
                  src={employeeProfile.profilePic ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(employeeProfile.employeeName)}&background=1a2744&color=00ff88&size=80`}
                  alt={employeeProfile.employeeName}
                  className="epc-avatar"
                />
                <div className={`epc-dot ${employeeProfile.status === "active" ? "epc-dot-active" : "epc-dot-inactive"}`} />
              </div>
              <div className="epc-info">
                <div className="epc-name">{employeeProfile.employeeName}</div>
                <div className="epc-email">{employeeProfile.email}</div>
                <div className="epc-badges">
                  <span className="epc-badge" style={{ color: ROLE_COLOR[employeeProfile.role], background: ROLE_BG[employeeProfile.role], borderColor: ROLE_COLOR[employeeProfile.role] }}>
                    {employeeProfile.role}
                  </span>
                  {employeeProfile.campaign && (
                    <span className="epc-badge" style={{ color: "#7eb8ff", background: "rgba(126,184,255,0.1)", borderColor: "#7eb8ff" }}>
                      {employeeProfile.campaign}
                    </span>
                  )}
                  <span className={`epc-badge epc-status-${employeeProfile.status}`}>
                    {employeeProfile.status.replace("-", " ")}
                  </span>
                </div>
                {/* ✅ Allow switching back to picker */}
                <button
                  onClick={() => { setEmployeeProfile(null); lookupEmployee(email); }}
                  style={{ marginTop: 8, fontSize: 10, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "'Share Tech Mono',monospace", letterSpacing: 1 }}
                >
                  ↩ Not you? Switch name
                </button>
              </div>
            </div>
          )}

          {/* ✅ NAME PICKER — shown when multiple employees share the same email */}
          {employeeChoices.length > 1 && !employeeProfile && (
            <div className="name-picker-section">
              <div className="name-picker-title">👤 Who are you?</div>
              <div className="name-picker-subtitle">Multiple accounts found for this email. Please select your name:</div>
              <div className="name-picker-list">
                {employeeChoices.map((ep, i) => (
                  <button
                    key={i}
                    className="name-picker-option"
                    onClick={() => handleSelectProfile(ep)}
                  >
                    <img
                      src={ep.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(ep.employeeName)}&background=1a2744&color=00ff88&size=48`}
                      alt={ep.employeeName}
                      className="name-picker-avatar"
                    />
                    <div className="name-picker-info">
                      <div className="name-picker-name">{ep.employeeName}</div>
                      <div className="name-picker-meta">
                        <span style={{ color: ROLE_COLOR[ep.role] }}>{ep.role}</span>
                        {ep.campaign && <span style={{ color: "#6b7280" }}> · {ep.campaign}</span>}
                        <span className={`name-picker-status name-picker-status-${ep.status}`}> · {ep.status.replace("-", " ")}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Not-in-roster warning */}
          {lookupDone && !employeeProfile && employeeChoices.length === 0 && !lookingUp && (
            <div className="emp-not-found-banner">
              🚫 This email is not registered in the employee roster. Please contact your admin.
            </div>
          )}

          {/* Status-blocked warning */}
          {employeeProfile && employeeProfile.status !== "active" && (
            <div className="emp-blocked-banner">
              ⚠️ Your status is <strong>{employeeProfile.status.replace("-", " ")}</strong>. Clock-in is disabled until you are set to Active by your admin.
            </div>
          )}

          {/* ── EMAIL FIELD ── */}
          <div className="field-label">Your Email</div>
          <div style={{ position: "relative" }}>
            <input
              className={`name-input${emailError ? " input-error" : ""}`}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              onKeyDown={e => e.key === "Enter" && handleEmailBlur()}
              autoComplete="email"
            />
            {lookingUp && (
              <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
                <span className="loading-spinner" style={{ color: "#00ff88" }} />
              </span>
            )}
          </div>
          {emailError && <p className="field-error">{emailError}</p>}

          {/* ── NAME FIELD ── */}
          <div className="field-label" style={{ marginTop: "16px" }}>
            Your Name
            {employeeProfile && <span style={{ marginLeft: 8, fontSize: 9, color: "#00ff88", letterSpacing: 1, fontFamily: "'Share Tech Mono',monospace" }}>✓ VERIFIED FROM ROSTER</span>}
          </div>
          <input
            className="name-input"
            type="text"
            placeholder={employeeChoices.length > 1 ? "← Select your name above first" : "Enter your full name…"}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => e.key === "Enter" && handleNameBlur()}
            autoComplete="name"
            readOnly={!!employeeProfile || employeeChoices.length > 1}
            style={(employeeProfile || employeeChoices.length > 1) ? { opacity: 0.65, cursor: "not-allowed" } : undefined}
          />

          {/* ── DATE PICKER ── */}
          <div className="date-picker-section">
            <div className="date-picker-label">
              <span className="date-picker-icon">📅</span>
              <span>VIEW DATE</span>
              {isHistorical && <span className="date-picker-historical-badge">HISTORICAL</span>}
            </div>
            <div className="date-picker-row">
              <input type="date" className="date-picker-input" value={selectedDate} max={today} onChange={handleDateChange} />
              {isHistorical && (
                <button className="date-picker-today-btn" onClick={() => { setSelectedDate(today); setHistoricalEntry(null); setHistoricalMessage(null); }}>TODAY</button>
              )}
            </div>
            {isHistorical && <div className="date-picker-hint">🕐 Viewing past record — punch actions are disabled</div>}
          </div>

          <button className="check-status-btn" onClick={handleCheckStatus} disabled={fetching || fetchingHistorical}>
            {(fetching || fetchingHistorical) ? <><span className="loading-spinner" /> CHECKING…</> : <>{isHistorical ? "📂 LOAD RECORD" : "🔍 CHECK MY STATUS"}</>}
          </button>

          {!isHistorical && (
            <div className="status-bar">
              {fetching
                ? <span className="status-text status-idle"><span className="loading-spinner" /> Fetching status…</span>
                : status
                ? <span className="status-text">{statusLabels[status]}</span>
                : <span className="status-text status-idle">{email.trim() && name.trim() ? "NO RECORD FOR TODAY — TAP CHECK MY STATUS" : "ENTER EMAIL & NAME TO BEGIN"}</span>}
            </div>
          )}
          {isHistorical && (
            <div className="status-bar status-bar-historical">
              {fetchingHistorical
                ? <span className="status-text status-idle"><span className="loading-spinner" /> Loading record…</span>
                : historicalEntry
                ? <span className="status-text status-historical-found">📋 RECORD FOUND · {historicalEntry.status?.replace(/-/g, " ").toUpperCase()}</span>
                : historicalMessage
                ? <span className="status-text status-historical-empty">📭 {historicalMessage}</span>
                : <span className="status-text status-idle">TAP LOAD RECORD TO VIEW</span>}
            </div>
          )}

          {!isHistorical && (
            <>
              <div className="buttons-grid">
                {buttons.map(({ action, label, emoji, color, disabled }) => (
                  <button key={action} className={color} disabled={disabled || loading || !isAllowed} onClick={() => handleAction(action)}>
                    <span className="btn-emoji">{loading && !disabled ? "⏳" : emoji}</span>
                    <span className="btn-text">{label}</span>
                  </button>
                ))}
              </div>
              <div className="bio-section-label">
                🚻 Bio Break <span style={{ color: "#2dd4bf", fontSize: 8 }}>(Malibang|Mangihi or Matug · WATER · QUICK PERSONAL)</span>
              </div>
              <div className="bio-grid">
                {bioButtons.map(({ action, label, emoji, color, disabled }) => (
                  <button key={action} className={color} disabled={disabled || loading || !isAllowed} onClick={() => handleAction(action)}>
                    <span className="btn-emoji">{loading && !disabled ? "⏳" : emoji}</span>
                    <span className="btn-text">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {message && (
            <div className={`toast ${message.type === "success" ? "toast-success" : "toast-error"}`}>{message.text}</div>
          )}

          {!isHistorical && entry && renderTimeline(entry, liveWorkedMins)}
          {isHistorical && historicalEntry && renderTimeline(historicalEntry)}
          {isHistorical && !historicalEntry && !fetchingHistorical && historicalMessage && (
            <div className="historical-empty">
              <div className="historical-empty-icon">📭</div>
              <div className="historical-empty-text">{historicalMessage}</div>
              <div className="historical-empty-sub">No attendance was recorded for this date.</div>
            </div>
          )}
        </div>

        {/* ── ACTION MODAL ── */}
        {actionModal && (
          <div className="action-modal-overlay" onClick={closeModal}>
            <div className={`action-modal${actionModal.action.includes("bio") ? " bio" : ""}`} onClick={e => e.stopPropagation()}>
              <img src={actionModal.image} alt={actionModal.action} className="action-modal-image" onError={e => { e.currentTarget.src = "/images/logov3.png"; }} />
              <div className="action-modal-content">
                <div className="action-modal-title">
                  {actionModal.action === "check-in"     && "✅ CHECKED IN!"}
                  {actionModal.action === "break-in"     && "☕ ON BREAK!"}
                  {actionModal.action === "break-out"    && "🔄 BACK TO WORK!"}
                  {actionModal.action === "bio-break-in" && "🚻 BIO BREAK!"}
                  {actionModal.action === "bio-break-out"&& "✅ BACK TO WORK!"}
                  {actionModal.action === "check-out"    && "👋 CHECKED OUT!"}
                </div>
                <div className="action-modal-message">{actionModal.message}</div>
                {employeeProfile && (
                  <div className="modal-emp-banner">
                    <img
                      src={employeeProfile.profilePic ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(employeeProfile.employeeName)}&background=1a2744&color=00ff88&size=40`}
                      alt={employeeProfile.employeeName}
                      className="modal-emp-avatar"
                    />
                    <div className="modal-emp-info">
                      <div className="modal-emp-name">{employeeProfile.employeeName}</div>
                      <div className="modal-emp-meta">
                        <span style={{ color: ROLE_COLOR[employeeProfile.role] }}>{employeeProfile.role}</span>
                        {employeeProfile.campaign && <span> · {employeeProfile.campaign}</span>}
                      </div>
                    </div>
                  </div>
                )}
                <div className="camera-section">
                  {!capturedPhoto && !cameraError && (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted />
                      {cameraReady && countdown !== null && (
                        <div className="camera-overlay"><div className="countdown-ring" key={countdown}>{countdown}</div></div>
                      )}
                      {!cameraReady && (
                        <div style={{ padding: "24px", textAlign: "center" }}>
                          <span className="loading-spinner" style={{ color: "#00ff88" }} />
                          <p style={{ marginTop: 8, fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: "#6b7280", letterSpacing: 1 }}>STARTING CAMERA…</p>
                        </div>
                      )}
                    </>
                  )}
                  {cameraError && (
                    <div className="camera-error-box">
                      <p className="camera-error-text">📵 {cameraError}</p>
                      <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: "#4b5563", marginTop: 6, letterSpacing: 1 }}>SELFIE SKIPPED</p>
                    </div>
                  )}
                  {capturedPhoto && <img src={capturedPhoto} alt="Your selfie" className="camera-captured-photo" />}
                  {(capturedPhoto || cameraReady) && (
                    <div className="camera-status-bar">
                      <span className={`camera-status-text ${uploadingPhoto ? "uploading" : photoUploaded ? "done" : ""}`}>
                        {uploadingPhoto ? "⏳ UPLOADING…" : photoUploaded ? "✅ SELFIE SAVED" : capturedPhoto ? "📸 CAPTURED" : countdown !== null ? `📷 AUTO IN ${countdown}s` : "📷 READY"}
                      </span>
                      {capturedPhoto && !uploadingPhoto && (
                        <div className="camera-btn-row"><button className="btn-retake btn-camera-action" onClick={retakePhoto}>🔄 RETAKE</button></div>
                      )}
                      {cameraReady && !capturedPhoto && (
                        <div className="camera-btn-row">
                          <button className="btn-manual-capture btn-camera-action" onClick={() => {
                            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
                            setCountdown(null); capturePhoto();
                          }}>📸 SNAP NOW</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button className="action-modal-close" onClick={closeModal}>✕ CLOSE</button>
              </div>
            </div>
          </div>
        )}

        {/* ── LIGHTBOX ── */}
        {lightbox && (
          <div className="selfie-lightbox-overlay" onClick={() => setLightbox(null)}>
            <div className="selfie-lightbox-inner" onClick={e => e.stopPropagation()}>
              <button className="selfie-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
              <img src={lightbox.selfies[lightbox.index].url} alt="selfie" className="selfie-lightbox-img" />
              <div className="selfie-lightbox-footer">
                <button className="selfie-lightbox-nav" disabled={lightbox.selfies.length <= 1} onClick={() => setLightbox(lb => lb ? { ...lb, index: (lb.index - 1 + lb.selfies.length) % lb.selfies.length } : lb)}>‹</button>
                <div className="selfie-lightbox-info">
                  <div className="selfie-lightbox-action">{actionLabels[lightbox.selfies[lightbox.index].action] ?? lightbox.selfies[lightbox.index].action}</div>
                  <div className="selfie-lightbox-time">{new Date(lightbox.selfies[lightbox.index].takenAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })} · {lightbox.index + 1} / {lightbox.selfies.length}</div>
                </div>
                <button className="selfie-lightbox-nav" disabled={lightbox.selfies.length <= 1} onClick={() => setLightbox(lb => lb ? { ...lb, index: (lb.index + 1) % lb.selfies.length } : lb)}>›</button>
              </div>
              {lightbox.selfies.length > 1 && (
                <div className="selfie-lightbox-dots">
                  {lightbox.selfies.map((_, i) => (
                    <button key={i} className={`selfie-lightbox-dot${i === lightbox.index ? " active" : ""}`} style={{ width: i === lightbox.index ? 18 : 6 }} onClick={() => setLightbox(lb => lb ? { ...lb, index: i } : lb)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="footer-link">
          Admin? <a href="/login">Login to view all records →</a>
          <p>Crafted by Nikko with coffee and love ☕</p>
          <p>A gift from nikko to nationgraph family</p>
          <p>Under OM mirah cluster lead by: TL Cris Arandilla</p>
        </div>
      </div>
    </>
  );
}