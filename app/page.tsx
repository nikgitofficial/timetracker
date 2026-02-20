"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
          96% { opacity: 0.92; }
          97% { opacity: 1; }
          98% { opacity: 0.95; }
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

        .status-bar {
          margin-top: 20px;
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

        .bio-section-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #374151;
          margin: 16px 0 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bio-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .bio-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
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
        button .btn-text { font-size: 13px; letter-spacing: 2px; }
        button:active:not(:disabled) { transform: scale(0.97); }

        button::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.15s;
        }

        button:hover:not(:disabled)::after { background: rgba(255,255,255,0.06); }

        .btn-checkin { background: rgba(0,200,80,0.15); border: 1px solid rgba(0,255,100,0.3); color: #00ff88; }
        .btn-checkin:not(:disabled):hover { box-shadow: 0 0 20px rgba(0,255,136,0.2); }
        .btn-break { background: rgba(250,180,0,0.12); border: 1px solid rgba(250,180,0,0.3); color: #fbbf24; }
        .btn-break:not(:disabled):hover { box-shadow: 0 0 20px rgba(251,191,36,0.2); }
        .btn-return { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; }
        .btn-return:not(:disabled):hover { box-shadow: 0 0 20px rgba(96,165,250,0.2); }
        .btn-bio { background: rgba(20,184,166,0.15); border: 1px solid rgba(20,184,166,0.35); color: #2dd4bf; }
        .btn-bio:not(:disabled):hover { box-shadow: 0 0 20px rgba(20,184,166,0.2); }
        .btn-bio-return { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.35); color: #a5b4fc; }
        .btn-bio-return:not(:disabled):hover { box-shadow: 0 0 20px rgba(99,102,241,0.2); }
        .btn-checkout { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
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

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .toast-success { background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.25); color: #00ff88; }
        .toast-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #f87171; }

        .timeline { margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px; }

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

        .summary-row { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

        .summary-chip {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 10px 8px;
          text-align: center;
          min-width: 70px;
        }

        .summary-chip-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 8px;
          letter-spacing: 1.5px;
          color: #4b5563;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .summary-chip-value {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #00ff88;
        }

        .summary-chip-value.amber { color: #fbbf24; }
        .summary-chip-value.teal  { color: #2dd4bf; }
        .summary-chip-value.blue  { color: #60a5fa; }

        .break-block { margin: 6px 0; border-left: 2px solid rgba(251,191,36,0.3); padding-left: 10px; }
        .break-block-header {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #fbbf24;
          padding: 6px 0 2px;
          opacity: 0.8;
        }

        .bio-block { margin: 6px 0; border-left: 2px solid rgba(45,212,191,0.3); padding-left: 10px; }
        .bio-block-header {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #2dd4bf;
          padding: 6px 0 2px;
          opacity: 0.8;
        }

        .timeline-row-indent { padding-left: 4px; }
        .accent-amber { color: #fbbf24 !important; }
        .accent-teal  { color: #2dd4bf !important; }

        .live-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          color: #fbbf24;
          animation: pulse 1.5s infinite;
        }

        .live-tag-teal {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          color: #2dd4bf;
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

        /* ── SELFIE GALLERY in timeline ── */
        .selfie-gallery {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .selfie-gallery-title {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #374151;
          margin-bottom: 12px;
        }

        .selfie-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
        }

        .selfie-item {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.3);
          aspect-ratio: 4/3;
        }

        .selfie-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.3s ease;
        }

        .selfie-item:hover img { transform: scale(1.05); }

        .selfie-badge {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 4px 6px;
          background: rgba(0,0,0,0.75);
          font-family: 'Share Tech Mono', monospace;
          font-size: 8px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #00ff88;
          text-align: center;
          backdrop-filter: blur(4px);
        }

        /* ── ACTION MODAL ── */
        .action-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 14, 20, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .action-modal {
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(0,255,136,0.3);
          border-radius: 16px;
          padding: 0;
          max-width: 500px;
          width: 90%;
          overflow: hidden;
          animation: slideUp 0.4s ease;
          box-shadow: 0 20px 60px rgba(0,255,136,0.2);
          max-height: 92vh;
          overflow-y: auto;
        }

        .action-modal.bio {
          border-color: rgba(45,212,191,0.4);
          box-shadow: 0 20px 60px rgba(45,212,191,0.15);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .action-modal-image {
          width: 100%;
          height: 240px;
          object-fit: cover;
          display: block;
          border-bottom: 2px solid rgba(0,255,136,0.3);
        }

        .action-modal.bio .action-modal-image { border-bottom-color: rgba(45,212,191,0.4); }

        .action-modal-content {
          padding: 24px 28px 28px;
          text-align: center;
        }

        .action-modal-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #00ff88;
          margin-bottom: 8px;
          text-shadow: 0 0 20px rgba(0,255,136,0.4);
        }

        .action-modal.bio .action-modal-title {
          color: #2dd4bf;
          text-shadow: 0 0 20px rgba(45,212,191,0.4);
        }

        .action-modal-message {
          font-family: 'Barlow', sans-serif;
          font-size: 17px;
          color: #d1d5db;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        /* ── CAMERA SECTION inside modal ── */
        .camera-section {
          margin-bottom: 20px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          background: #000;
          position: relative;
        }

        .camera-section video {
          width: 100%;
          display: block;
          transform: scaleX(-1); /* mirror */
          border-radius: 0;
          max-height: 220px;
          object-fit: cover;
        }

        .camera-section canvas { display: none; }

        .camera-captured-photo {
          width: 100%;
          display: block;
          max-height: 220px;
          object-fit: cover;
          border-radius: 0;
        }

        .camera-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .countdown-ring {
          width: 80px;
          height: 80px;
          background: rgba(0,0,0,0.6);
          border-radius: 50%;
          border: 3px solid #00ff88;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 40px;
          font-weight: 800;
          color: #00ff88;
          text-shadow: 0 0 20px rgba(0,255,136,0.6);
          animation: countPulse 1s ease-in-out;
        }

        @keyframes countPulse {
          0% { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }

        .camera-status-bar {
          padding: 8px 12px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .camera-status-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #00ff88;
        }

        .camera-status-text.uploading { color: #fbbf24; }
        .camera-status-text.done { color: #00ff88; }
        .camera-status-text.error { color: #f87171; }

        .camera-error-box {
          padding: 20px;
          text-align: center;
          background: rgba(239,68,68,0.06);
        }

        .camera-error-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          color: #f87171;
          letter-spacing: 1px;
        }

        .camera-btn-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          justify-content: center;
        }

        .btn-camera-action {
          padding: 8px 16px !important;
          font-size: 11px !important;
          letter-spacing: 1.5px !important;
          border-radius: 6px !important;
          flex-direction: row !important;
          gap: 6px !important;
        }

        .btn-retake {
          background: rgba(251,191,36,0.12);
          border: 1px solid rgba(251,191,36,0.3);
          color: #fbbf24;
        }

        .btn-manual-capture {
          background: rgba(0,200,80,0.15);
          border: 1px solid rgba(0,255,100,0.3);
          color: #00ff88;
        }

        .action-modal-close {
          width: 100%;
          padding: 12px;
          background: rgba(0,255,136,0.1);
          border: 1px solid rgba(0,255,136,0.3);
          border-radius: 8px;
          color: #00ff88;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          flex-direction: row !important;
          justify-content: center !important;
          gap: 8px !important;
        }

        .action-modal.bio .action-modal-close {
          background: rgba(45,212,191,0.1);
          border-color: rgba(45,212,191,0.3);
          color: #2dd4bf;
        }

        .action-modal-close:hover {
          background: rgba(0,255,136,0.2);
          box-shadow: 0 0 16px rgba(0,255,136,0.3);
        }

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
          .buttons-grid, .bio-grid { gap: 8px; }
          button { padding: 14px 6px; }
          .live-clock { letter-spacing: 2px; }
          .action-modal-image { height: 180px; }
          .action-modal-content { padding: 18px 16px 20px; }
          .action-modal-title { font-size: 22px; }
          .action-modal-message { font-size: 15px; }
          .selfie-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
        }
      `}</style>

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
                    {entry.selfies.map((s) => (
                      <div key={s._id} className="selfie-item">
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