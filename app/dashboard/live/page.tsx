"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── TYPES ── */
interface LiveEvent {
  id: string;
  employeeName: string;
  email: string;
  action: string;
  selfieUrl?: string;
  profilePic?: string;
  role?: string;
  campaign?: string;
  timestamp: string;
  status: string;
}

interface LiveEmployee {
  email: string;
  employeeName: string;
  entryId: string;
  connectedAt: string;
}

/* ── CONSTANTS ── */
const ACTION_META: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  "check-in":      { label: "Check-In",   emoji: "🟢", color: "#00ff88", bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.3)"  },
  "break-in":      { label: "Break",      emoji: "☕", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)"  },
  "break-out":     { label: "Return",     emoji: "🔄", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.3)"  },
  "bio-break-in":  { label: "Bio Break",  emoji: "🚻", color: "#2dd4bf", bg: "rgba(45,212,191,0.08)", border: "rgba(45,212,191,0.3)"  },
  "bio-break-out": { label: "End Bio",    emoji: "✅", color: "#a5b4fc", bg: "rgba(165,180,252,0.08)", border: "rgba(165,180,252,0.3)" },
  "check-out":     { label: "Check-Out",  emoji: "🔴", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" },
};

const STATUS_TO_ACTION: Record<string, string> = {
  "checked-in":   "check-in",
  "on-break":     "break-in",
  "on-bio-break": "bio-break-in",
  "returned":     "check-in",
  "checked-out":  "check-out",
};

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return fmt(iso);
}
function avatarUrl(name: string, pic?: string) {
  if (pic) return pic;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a2744&color=00ff88&size=96`;
}

/* ══════════════════════════════════════════════════════════════════
   VIDEO TILE — WebRTC live feed for one employee (admin only)
══════════════════════════════════════════════════════════════════ */
function VideoTile({
  employee,
  adminId,
  event,
  onDisconnected,
}: {
  employee: LiveEmployee;
  adminId: string;
  event?: LiveEvent;
  onDisconnected?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const [videoState, setVideoState] = useState<"connecting" | "live" | "error" | "offline">("connecting");
  const [ago, setAgo] = useState(event ? timeAgo(event.timestamp) : "");

  useEffect(() => {
    if (!event) return;
    const t = setInterval(() => setAgo(timeAgo(event.timestamp)), 5000);
    return () => clearInterval(t);
  }, [event?.timestamp]);

  const sendSignal = useCallback(async (message: object) => {
    try {
      await fetch("/api/time/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch (err) {
      console.warn("Signal send error:", err);
    }
  }, []);

  useEffect(() => {
    let destroyed = false;

    const connect = async () => {
      try {
        // Admin connects with auth (cookie handled automatically)
        const tileAdminId = `${adminId}-${employee.email}`;
        const es = new EventSource(
          `/api/time/signal?clientId=${encodeURIComponent(tileAdminId)}&role=admin`
        );
        esRef.current = es;

        es.onerror = () => {
          if (!destroyed) setVideoState("error");
        };

        // Request stream from this specific employee
        await sendSignal({
          type: "request-stream",
          from: tileAdminId,
          to: employee.email,
        });

        es.onmessage = async (e) => {
          if (destroyed) return;
          try {
            const msg = JSON.parse(e.data);

            // Employee disconnected
            if (msg.type === "employee-disconnected" && msg.from === employee.email) {
              setVideoState("offline");
              onDisconnected?.();
              return;
            }

            // Got WebRTC offer from employee
            if (msg.type === "offer" && msg.from === employee.email) {
              const pc = new RTCPeerConnection(ICE_SERVERS);
              pcRef.current = pc;

              // Show video when track arrives
              pc.ontrack = (ev) => {
                if (videoRef.current && ev.streams[0]) {
                  videoRef.current.srcObject = ev.streams[0];
                  videoRef.current.play()
                    .then(() => { if (!destroyed) setVideoState("live"); })
                    .catch(() => { if (!destroyed) setVideoState("error"); });
                }
              };

              // Send ICE candidates to employee
              pc.onicecandidate = (ev) => {
                if (ev.candidate) {
                  sendSignal({
                    type: "ice-candidate",
                    from: tileAdminId,
                    to: employee.email,
                    payload: ev.candidate,
                  });
                }
              };

              pc.onconnectionstatechange = () => {
                if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                  if (!destroyed) setVideoState("offline");
                }
              };

              await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              await sendSignal({
                type: "answer",
                from: tileAdminId,
                to: employee.email,
                payload: answer,
              });
            }

            // ICE candidate from employee
            if (msg.type === "ice-candidate" && msg.from === employee.email) {
              if (pcRef.current) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
              }
            }
          } catch (err) {
            console.warn("VideoTile signal error:", err);
          }
        };
      } catch {
        if (!destroyed) setVideoState("error");
      }
    };

    connect();

    return () => {
      destroyed = true;
      esRef.current?.close();
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [employee.email, adminId]);

  const meta = event
    ? ACTION_META[event.action] ?? ACTION_META["check-in"]
    : ACTION_META["check-in"];

  return (
    <div
      className="vt-wrap"
      style={{
        borderColor:
          videoState === "live" ? meta.border :
          videoState === "offline" ? "rgba(248,113,113,0.3)" :
          "rgba(255,255,255,0.08)",
      }}
    >
      {/* Video area */}
      <div className="vt-video-area">
        {/* Overlays */}
        {videoState === "connecting" && (
          <div className="vt-overlay">
            <div className="vt-spinner" />
            <div className="vt-overlay-text">Connecting camera…</div>
          </div>
        )}
        {videoState === "offline" && (
          <div className="vt-overlay">
            <img
              src={avatarUrl(employee.employeeName, event?.profilePic)}
              alt={employee.employeeName}
              className="vt-avatar"
            />
            <div className="vt-overlay-text vt-overlay-text--err">📴 Employee offline</div>
          </div>
        )}
        {videoState === "error" && (
          <div className="vt-overlay">
            <img
              src={avatarUrl(employee.employeeName, event?.profilePic)}
              alt={employee.employeeName}
              className="vt-avatar"
            />
            <div className="vt-overlay-text vt-overlay-text--err">Camera unavailable</div>
          </div>
        )}

        {/* Live badge */}
        {videoState === "live" && (
          <div className="vt-live-badge">● LIVE</div>
        )}

        {/* Status dot */}
        <div className="vt-status-dot" style={{ background: meta.color }}>
          {meta.emoji}
        </div>

        {/* Actual video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)", // mirror
            display: videoState === "live" ? "block" : "none",
          }}
        />
      </div>

      {/* Info bar */}
      <div className="vt-info" style={{ background: meta.bg }}>
        <div className="vt-info-left">
          <div className="vt-name">{employee.employeeName}</div>
          <div className="vt-email">{employee.email}</div>
        </div>
        <div className="vt-info-right">
          <div
            className="vt-action"
            style={{
              color:
                videoState === "live" ? meta.color :
                videoState === "offline" ? "#f87171" :
                "#fbbf24",
            }}
          >
            {videoState === "live" ? `${meta.emoji} ${meta.label}` :
             videoState === "offline" ? "🔴 OFFLINE" :
             videoState === "error" ? "❌ ERROR" :
             "⏳ CONNECTING"}
          </div>
          {ago && <div className="vt-ago">{ago}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── TICKER ITEM ── */
function TickerItem({ event }: { event: LiveEvent }) {
  const meta = ACTION_META[event.action] ?? { emoji: "📌", label: event.action, color: "#9ca3af" };
  return (
    <span className="lm-ticker-item">
      <span className="lm-ticker-emoji">{meta.emoji}</span>
      <span className="lm-ticker-name">{event.employeeName}</span>
      <span className="lm-ticker-action" style={{ color: meta.color }}>{meta.label}</span>
      <span className="lm-ticker-time">{timeAgo(event.timestamp)}</span>
      <span className="lm-ticker-sep">·</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function LiveMonitor() {
  // ── Punch events (for cards view + ticker) ──
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // ── WebRTC live employees (for video view) ──
  const [liveEmployees, setLiveEmployees] = useState<Map<string, LiveEmployee>>(new Map());
  const signalEsRef = useRef<EventSource | null>(null);

  // ── Stable admin ID for this session ──
  const adminIdRef = useRef(`admin-${Math.random().toString(36).slice(2, 9)}`);

  // ── UI state ──
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [viewMode, setViewMode] = useState<"video" | "cards">("video");
  const [soundEnabled, setSoundEnabled] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_EVENTS = 100;

  // ── Sound ping ──
  const playPing = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, [soundEnabled]);

  // ── Punch events SSE (for cards + ticker) ──
  const connect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setReconnecting(true);
    const es = new EventSource("/api/time/live");
    esRef.current = es;
    es.onopen = () => { setConnected(true); setReconnecting(false); };
    es.onmessage = (e) => {
      try {
        const event: LiveEvent = JSON.parse(e.data);
        setEvents(prev => {
          const deduped = prev.filter(p => p.id !== event.id);
          if (event.status === "checked-out") {
            setTimeout(() => {
              setEvents(cur => cur.filter(c => c.id !== event.id));
            }, 10000);
          }
          return [event, ...deduped].slice(0, MAX_EVENTS);
        });
        setNewIds(prev => {
          const next = new Set(prev);
          next.add(event.id);
          setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(event.id); return n; }), 3000);
          return next;
        });
        playPing();
      } catch {}
    };
    es.onerror = () => {
      setConnected(false); es.close(); esRef.current = null;
      setReconnecting(true);
      reconnectTimer.current = setTimeout(connect, 4000);
    };
  }, [playPing]);

  // ── Signal SSE (for WebRTC employee list) ──
  const connectSignal = useCallback(() => {
    if (signalEsRef.current) { signalEsRef.current.close(); signalEsRef.current = null; }

    const adminId = adminIdRef.current;
    const es = new EventSource(
      `/api/time/signal?clientId=${encodeURIComponent(adminId)}&role=admin`
    );
    signalEsRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        // Initial list of active employees with cameras
        if (msg.type === "employee-list") {
          const map = new Map<string, LiveEmployee>();
          (msg.payload as LiveEmployee[]).forEach((emp) => {
            map.set(emp.email, emp);
          });
          setLiveEmployees(map);
        }

        // New employee connected camera
        if (msg.type === "employee-connected") {
          setLiveEmployees(prev => {
            const next = new Map(prev);
            next.set(msg.from, {
              email: msg.from,
              employeeName: msg.employeeName,
              entryId: msg.entryId,
              connectedAt: new Date().toISOString(),
            });
            return next;
          });
        }

        // Employee disconnected camera
        if (msg.type === "employee-disconnected") {
          setLiveEmployees(prev => {
            const next = new Map(prev);
            next.delete(msg.from);
            return next;
          });
        }
      } catch {}
    };

    es.onerror = () => {
      signalEsRef.current?.close();
      signalEsRef.current = null;
      // Reconnect signal after 5s
      setTimeout(connectSignal, 5000);
    };
  }, []);

  // ── Load active employees + connect SSE streams ──
  useEffect(() => {
    const loadActive = async () => {
      try {
        const res = await fetch("/api/time/records?status=active&limit=100", { credentials: "include" });
        const data = await res.json();
        const active: LiveEvent[] = (data.records || []).map((r: any) => ({
          id: r._id,
          employeeName: r.employeeName,
          email: r.email,
          action: STATUS_TO_ACTION[r.status] ?? "check-in",
          selfieUrl: r.selfies?.slice(-1)[0]?.url,
          profilePic: r.profilePic,
          role: r.role,
          campaign: r.campaign,
          timestamp: r.checkIn,
          status: r.status,
        }));
        setEvents(active);
      } catch {}
      finally { setLoadingInitial(false); }
    };

    loadActive();
    connect();
    connectSignal();

    return () => {
      esRef.current?.close();
      signalEsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect, connectSignal]);

  // ── Filtered events ──
  const filtered = events.filter(e => {
    if (filterAction !== "all" && e.action !== filterAction) return false;
    if (filterSearch &&
      !e.employeeName.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !e.email.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  // ── Filtered live employees ──
  const filteredLive = Array.from(liveEmployees.values()).filter(emp => {
    if (filterSearch &&
      !emp.employeeName.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !emp.email.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  // ── Stats ──
  const activeWorking = events.filter(e => e.status === "checked-in" || e.status === "returned").length;
  const onBreak       = events.filter(e => e.status === "on-break" || e.status === "on-bio-break").length;
  const checkedOut    = events.filter(e => e.status === "checked-out").length;
  const withCamera    = liveEmployees.size;

  return (
    <div className="lm-wrap">
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div className="lm-header">
        <div className="lm-header-left">
          <div className="lm-title">
            <span className={`lm-live-dot${connected ? " lm-live-dot--on" : ""}`} />
            LIVE MONITOR
          </div>
          <div className="lm-subtitle">
            {events.length} active · {withCamera} cameras live
          </div>
        </div>
        <div className="lm-header-right">
          <div className="lm-stat-chips">
            <span className="lm-chip lm-chip--green">🟢 {activeWorking} Working</span>
            <span className="lm-chip lm-chip--amber">☕ {onBreak} Break</span>
            <span className="lm-chip lm-chip--red">🔴 {checkedOut} Out</span>
            <span className="lm-chip lm-chip--purple">📹 {withCamera} Cam</span>
          </div>

          {/* View mode toggle */}
          <div className="lm-view-toggle">
            <button
              className={`lm-view-btn${viewMode === "video" ? " active" : ""}`}
              onClick={() => setViewMode("video")}
            >📹 Video</button>
            <button
              className={`lm-view-btn${viewMode === "cards" ? " active" : ""}`}
              onClick={() => setViewMode("cards")}
            >🃏 Cards</button>
          </div>

          <button
            className={`lm-sound-btn${soundEnabled ? " lm-sound-btn--on" : ""}`}
            onClick={() => setSoundEnabled(s => !s)}
          >
            {soundEnabled ? "🔔" : "🔕"} {soundEnabled ? "Sound On" : "Sound Off"}
          </button>
          <div className={`lm-conn-badge${connected ? " lm-conn-badge--on" : reconnecting ? " lm-conn-badge--reconn" : ""}`}>
            {connected ? "● LIVE" : reconnecting ? "◌ CONNECTING…" : "✕ OFFLINE"}
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      {events.length > 0 && (
        <div className="lm-ticker-wrap">
          <span className="lm-ticker-label">LIVE</span>
          <div className="lm-ticker-track">
            <div className="lm-ticker-inner">
              {[...events, ...events].map((e, i) => (
                <TickerItem key={`${e.id}-${i}`} event={e} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FILTERS ── */}
      <div className="lm-filters">
        <input
          className="lm-search"
          placeholder="🔍 Search name or email…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
        />
        <div className="lm-filter-pills">
          <button
            className={`lm-filter-pill${filterAction === "all" ? " active" : ""}`}
            onClick={() => setFilterAction("all")}
          >All</button>
          {Object.entries(ACTION_META).map(([key, meta]) => (
            <button key={key}
              className={`lm-filter-pill${filterAction === key ? " active" : ""}`}
              style={filterAction === key ? { borderColor: meta.color, color: meta.color, background: meta.bg } : {}}
              onClick={() => setFilterAction(key)}
            >{meta.emoji} {meta.label}</button>
          ))}
        </div>
        {(filterAction !== "all" || filterSearch) && (
          <button
            className="lm-clear-filter"
            onClick={() => { setFilterAction("all"); setFilterSearch(""); }}
          >✕ Clear</button>
        )}
      </div>

      {/* ── LOADING ── */}
      {loadingInitial && (
        <div className="lm-empty">
          <div className="lm-empty-icon"><span className="lm-empty-pulse active">◎</span></div>
          <div className="lm-empty-title">Loading active employees…</div>
          <div className="lm-empty-sub">Fetching current shifts</div>
        </div>
      )}

      {/* ── EMPTY ── */}
      {!loadingInitial && events.length === 0 && (
        <div className="lm-empty">
          <div className="lm-empty-icon">
            <span className={`lm-empty-pulse${connected ? " active" : ""}`}>◎</span>
          </div>
          <div className="lm-empty-title">No active employees right now</div>
          <div className="lm-empty-sub">
            Cards and cameras will appear here as employees check in.
          </div>
        </div>
      )}

      {/* ══ VIDEO GRID — WebRTC live feeds ══ */}
      {!loadingInitial && viewMode === "video" && (
        <>
          {filteredLive.length > 0 ? (
            <div className="vt-grid">
              {filteredLive.map(emp => (
                <VideoTile
                  key={emp.email}
                  employee={emp}
                  adminId={adminIdRef.current}
                  event={events.find(e => e.email === emp.email)}
                  onDisconnected={() => {
                    setLiveEmployees(prev => {
                      const next = new Map(prev);
                      next.delete(emp.email);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          ) : (
            !loadingInitial && events.length > 0 && (
              <div className="lm-empty">
                <div className="lm-empty-icon">📹</div>
                <div className="lm-empty-title">No camera feeds yet</div>
                <div className="lm-empty-sub">
                  Live video will appear here as employees clock in and grant camera access.
                  <br />Switch to 🃏 Cards view to see punch activity.
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ══ CARDS GRID — punch activity view ══ */}
      {!loadingInitial && filtered.length > 0 && viewMode === "cards" && (
        <div className="lm-grid">
          {filtered.map(event => {
            const meta = ACTION_META[event.action] ?? ACTION_META["check-in"];
            const isLive = liveEmployees.has(event.email);
            return (
              <div
                key={event.id}
                className={`lm-card${newIds.has(event.id) ? " lm-card--new" : ""}`}
                style={{ borderColor: meta.border, background: meta.bg }}
              >
                <div className="lm-card-photo-wrap">
                  <img
                    src={event.selfieUrl || avatarUrl(event.employeeName, event.profilePic)}
                    alt={event.employeeName}
                    className="lm-card-photo"
                  />
                  {event.selfieUrl && (
                    <div className="lm-card-photo-badge">📸 SELFIE</div>
                  )}
                  {isLive && (
                    <div className="lm-card-cam-badge">📹 CAM LIVE</div>
                  )}
                  <div className="lm-card-action-dot" style={{ background: meta.color }}>
                    {meta.emoji}
                  </div>
                </div>
                <div className="lm-card-info">
                  <div className="lm-card-name">{event.employeeName}</div>
                  <div className="lm-card-email">{event.email}</div>
                  <div className="lm-card-action" style={{ color: meta.color }}>
                    <span>{meta.emoji}</span>
                    <span className="lm-card-action-label">{meta.label}</span>
                  </div>
                  <div className="lm-card-time">{fmt(event.timestamp)}</div>
                </div>
                <div className="lm-card-status" style={{ background: meta.border }}>
                  {event.status.replace(/-/g, " ").toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loadingInitial && events.length > 0 && filtered.length === 0 && viewMode === "cards" && (
        <div className="lm-empty">
          <div className="lm-empty-title">No matching employees</div>
          <div className="lm-empty-sub">Try adjusting your filters</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500&display=swap');

.lm-wrap { font-family: 'Barlow', sans-serif; color: #e8eaf0; min-height: 100%; padding: 24px 20px 80px; }

/* Header */
.lm-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.lm-title { display: flex; align-items: center; gap: 10px; font-family: 'Barlow Condensed', sans-serif; font-size: clamp(22px, 4vw, 30px); font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #fff; }
.lm-subtitle { font-family: 'Share Tech Mono', monospace; font-size: 10px; letter-spacing: 2px; color: #4b5563; text-transform: uppercase; margin-top: 3px; }
.lm-live-dot { width: 10px; height: 10px; border-radius: 50%; background: #374151; flex-shrink: 0; transition: background 0.3s; }
.lm-live-dot--on { background: #00ff88; box-shadow: 0 0 10px rgba(0,255,136,0.6); animation: lm-pulse 1.8s infinite; }
@keyframes lm-pulse { 0%,100% { box-shadow: 0 0 6px rgba(0,255,136,0.5); } 50% { box-shadow: 0 0 20px rgba(0,255,136,0.9); } }
.lm-header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lm-stat-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.lm-chip { font-family: 'Share Tech Mono', monospace; font-size: 10px; letter-spacing: 1px; padding: 4px 10px; border-radius: 20px; border: 1px solid; }
.lm-chip--green  { color: #00ff88; border-color: rgba(0,255,136,0.3);   background: rgba(0,255,136,0.06); }
.lm-chip--amber  { color: #fbbf24; border-color: rgba(251,191,36,0.3);  background: rgba(251,191,36,0.06); }
.lm-chip--red    { color: #f87171; border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.06); }
.lm-chip--blue   { color: #60a5fa; border-color: rgba(96,165,250,0.3);  background: rgba(96,165,250,0.06); }
.lm-chip--purple { color: #c084fc; border-color: rgba(192,132,252,0.3); background: rgba(192,132,252,0.06); }

/* View toggle */
.lm-view-toggle { display: flex; gap: 2px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 3px; }
.lm-view-btn { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 4px; border: none; background: transparent; color: #6b7280; cursor: pointer; transition: all 0.15s; text-transform: uppercase; white-space: nowrap; }
.lm-view-btn.active { background: rgba(0,255,136,0.15); color: #00ff88; }

.lm-sound-btn { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 1px; padding: 5px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #4b5563; cursor: pointer; transition: all 0.15s; text-transform: uppercase; }
.lm-sound-btn--on { color: #fbbf24; border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.07); }
.lm-conn-badge { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 2px; padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(248,113,113,0.3); background: rgba(248,113,113,0.07); color: #f87171; text-transform: uppercase; white-space: nowrap; }
.lm-conn-badge--on { border-color: rgba(0,255,136,0.3); background: rgba(0,255,136,0.07); color: #00ff88; }
.lm-conn-badge--reconn { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.07); color: #fbbf24; animation: lm-reconn 1s infinite; }
@keyframes lm-reconn { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* Ticker */
.lm-ticker-wrap { display: flex; align-items: center; gap: 10px; overflow: hidden; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
.lm-ticker-label { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 2px; color: #00ff88; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.25); padding: 2px 7px; border-radius: 3px; flex-shrink: 0; }
.lm-ticker-track { flex: 1; overflow: hidden; }
.lm-ticker-inner { display: flex; white-space: nowrap; animation: lm-ticker 40s linear infinite; }
@keyframes lm-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.lm-ticker-item { display: inline-flex; align-items: center; gap: 5px; padding: 0 16px; }
.lm-ticker-emoji { font-size: 12px; }
.lm-ticker-name { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; color: #e2e8f0; }
.lm-ticker-action { font-family: 'Share Tech Mono', monospace; font-size: 10px; letter-spacing: 1px; }
.lm-ticker-time { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #4b5563; }
.lm-ticker-sep { color: #374151; }

/* Filters */
.lm-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.lm-search { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 14px; font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #e2e8f0; outline: none; min-width: 200px; transition: border-color 0.15s; }
.lm-search::placeholder { color: #374151; }
.lm-search:focus { border-color: rgba(0,255,136,0.35); }
.lm-filter-pills { display: flex; flex-wrap: wrap; gap: 5px; }
.lm-filter-pill { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 0.8px; padding: 5px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #6b7280; cursor: pointer; transition: all 0.15s; text-transform: uppercase; white-space: nowrap; }
.lm-filter-pill.active { border-color: rgba(0,255,136,0.4); color: #00ff88; background: rgba(0,255,136,0.08); }
.lm-clear-filter { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 1px; padding: 5px 10px; border-radius: 5px; border: 1px solid rgba(248,113,113,0.25); background: rgba(248,113,113,0.06); color: #f87171; cursor: pointer; transition: all 0.15s; text-transform: uppercase; }

/* ── VIDEO TILE GRID ── */
.vt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

/* ── VIDEO TILE ── */
.vt-wrap { border-radius: 10px; border: 1px solid; overflow: hidden; background: #0a0e14; transition: transform 0.2s, box-shadow 0.2s; }
.vt-wrap:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
.vt-video-area { position: relative; aspect-ratio: 16/9; background: #060a10; overflow: hidden; }
.vt-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: #060a10; z-index: 2; }
.vt-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.1); }
.vt-spinner { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #00ff88; border-radius: 50%; animation: vt-spin 0.8s linear infinite; }
@keyframes vt-spin { to { transform: rotate(360deg); } }
.vt-overlay-text { font-family: 'Share Tech Mono', monospace; font-size: 9px; letter-spacing: 1.5px; color: #4b5563; text-transform: uppercase; }
.vt-overlay-text--dim { color: #374151; }
.vt-overlay-text--err { color: #f87171; }
.vt-live-badge { position: absolute; top: 8px; left: 8px; font-family: 'Share Tech Mono', monospace; font-size: 8px; letter-spacing: 1.5px; background: rgba(0,0,0,0.75); color: #00ff88; padding: 3px 8px; border-radius: 3px; border: 1px solid rgba(0,255,136,0.35); backdrop-filter: blur(4px); animation: lm-live-blink 2s infinite; z-index: 3; }
@keyframes lm-live-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.vt-status-dot { position: absolute; bottom: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; backdrop-filter: blur(6px); background: rgba(0,0,0,0.5); z-index: 3; }
.vt-info { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; gap: 8px; }
.vt-info-left { flex: 1; min-width: 0; }
.vt-name { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt-email { font-family: 'Share Tech Mono', monospace; font-size: 8px; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vt-info-right { text-align: right; flex-shrink: 0; }
.vt-action { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.vt-ago { font-family: 'Share Tech Mono', monospace; font-size: 8px; color: #374151; margin-top: 1px; }

/* Cards grid */
.lm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.lm-card { border-radius: 10px; border: 1px solid; overflow: hidden; position: relative; transition: transform 0.2s, box-shadow 0.2s; }
.lm-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.lm-card--new { animation: lm-card-pop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
@keyframes lm-card-pop { 0% { opacity: 0; transform: scale(0.88) translateY(-8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
.lm-card-photo-wrap { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #0a0e14; }
.lm-card-photo { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
.lm-card:hover .lm-card-photo { transform: scale(1.04); }
.lm-card-photo-badge { position: absolute; top: 6px; left: 6px; font-family: 'Share Tech Mono', monospace; font-size: 8px; letter-spacing: 1.5px; background: rgba(0,0,0,0.7); color: #00ff88; padding: 3px 7px; border-radius: 3px; border: 1px solid rgba(0,255,136,0.3); backdrop-filter: blur(4px); }
.lm-card-cam-badge { position: absolute; top: 6px; right: 6px; font-family: 'Share Tech Mono', monospace; font-size: 8px; letter-spacing: 1px; background: rgba(192,132,252,0.2); color: #c084fc; padding: 3px 7px; border-radius: 3px; border: 1px solid rgba(192,132,252,0.3); }
.lm-card-action-dot { position: absolute; bottom: 6px; right: 6px; width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 12px; backdrop-filter: blur(6px); background: rgba(0,0,0,0.5); }
.lm-card-info { padding: 10px 12px 8px; }
.lm-card-name { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 1px; }
.lm-card-email { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; }
.lm-card-action { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; }
.lm-card-action-label { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.lm-card-time { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #9ca3af; }
.lm-card-status { font-family: 'Share Tech Mono', monospace; font-size: 8px; letter-spacing: 2px; text-align: center; padding: 4px; color: rgba(255,255,255,0.4); text-transform: uppercase; }

/* Empty */
.lm-empty { text-align: center; padding: 80px 24px; }
.lm-empty-icon { font-size: 56px; margin-bottom: 16px; line-height: 1; }
.lm-empty-pulse { display: inline-block; color: #374151; font-size: 56px; transition: color 0.3s; }
.lm-empty-pulse.active { color: #00ff88; animation: lm-empty-ring 2s ease-in-out infinite; }
@keyframes lm-empty-ring { 0%,100% { text-shadow: none; } 50% { text-shadow: 0 0 24px rgba(0,255,136,0.6); } }
.lm-empty-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
.lm-empty-sub { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #374151; letter-spacing: 1px; max-width: 360px; margin: 0 auto; line-height: 1.6; }

@media (max-width: 640px) {
  .vt-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .lm-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .lm-filters { flex-direction: column; align-items: flex-start; }
  .lm-search { width: 100%; }
}
`;