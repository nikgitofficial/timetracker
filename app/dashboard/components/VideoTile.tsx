"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface VideoTileProps {
  employeeEmail: string;
  employeeName: string;
  adminId: string; // must be STABLE across renders — pass a ref value, not inline
  onDisconnected?: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

// FIX 11: Tile-scoped ICE candidate queue — holds candidates that arrive
// before setRemoteDescription completes, then drains them after
class IceCandidateQueue {
  private queue: RTCIceCandidateInit[] = [];
  private pc: RTCPeerConnection | null = null;
  private ready = false;

  attach(pc: RTCPeerConnection) {
    this.pc = pc;
  }

  async add(candidate: RTCIceCandidateInit) {
    if (this.ready && this.pc) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      this.queue.push(candidate);
    }
  }

  async flush() {
    this.ready = true;
    if (!this.pc) return;
    for (const c of this.queue) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {}
    }
    this.queue = [];
  }

  reset() {
    this.queue = [];
    this.ready = false;
    this.pc = null;
  }
}

export default function VideoTile({
  employeeEmail,
  employeeName,
  adminId,
  onDisconnected,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const esRef = useRef<EventSource | null>(null);
  // FIX 12: Stable per-tile clientId — uses a ref so it never changes even if
  // the parent re-renders. adminId + email uniquely identifies this tile's SSE
  const clientIdRef = useRef(`${adminId}-${employeeEmail}`);
  const icqRef = useRef(new IceCandidateQueue());
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<"connecting" | "live" | "error" | "offline">("connecting");

  const sendSignal = useCallback(async (message: object) => {
    try {
      await fetch("/api/time/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch (err) {
      console.warn("VideoTile signal error:", err);
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (destroyedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const tileClientId = clientIdRef.current;
    const es = new EventSource(
      `/api/time/signal?clientId=${encodeURIComponent(tileClientId)}&role=admin`
    );
    esRef.current = es;

    es.onopen = () => {
      if (destroyedRef.current) return;
      // FIX 13: Re-request the stream every time SSE (re)connects — this
      // handles the case where the employee was already registered before
      // this admin tile came online
      sendSignal({
        type: "request-stream",
        from: tileClientId,
        to: employeeEmail,
      });
    };

    es.onmessage = async (e) => {
      if (destroyedRef.current) return;
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === "employee-disconnected" && msg.from === employeeEmail) {
          setStatus("offline");
          onDisconnected?.();
          return;
        }

        if (msg.type === "offer" && msg.from === employeeEmail) {
          // FIX 14: Close any old peer before creating a new one — avoids
          // accumulating ghost RTCPeerConnections that hold the track open
          // for exactly one negotiation cycle (causing the ~1s drop)
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
            icqRef.current.reset();
          }

          const pc = new RTCPeerConnection(ICE_SERVERS);
          pcRef.current = pc;
          icqRef.current.attach(pc);

          pc.ontrack = (event) => {
            if (videoRef.current && event.streams[0]) {
              // FIX 15: Set srcObject before calling play() and guard against
              // AbortError from rapid play/pause cycles
              videoRef.current.srcObject = event.streams[0];
              const playPromise = videoRef.current.play();
              playPromise
                ?.then(() => {
                  if (!destroyedRef.current) setStatus("live");
                })
                .catch((err) => {
                  // AbortError is benign — video element was removed before play resolved
                  if (err.name !== "AbortError" && !destroyedRef.current) {
                    setStatus("error");
                  }
                });
            }
          };

          pc.onicecandidate = (ev) => {
            if (ev.candidate) {
              sendSignal({
                type: "ice-candidate",
                from: tileClientId,
                to: employeeEmail,
                payload: ev.candidate,
              });
            }
          };

          pc.onconnectionstatechange = () => {
            if (destroyedRef.current) return;
            if (pc.connectionState === "connected") {
              setStatus("live");
            }
            if (
              pc.connectionState === "disconnected" ||
              pc.connectionState === "failed"
            ) {
              setStatus("offline");
              // FIX 16: On unexpected disconnect, re-request stream after a
              // short delay — the employee's SilentCamera will re-offer
              if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = setTimeout(() => {
                if (!destroyedRef.current) {
                  sendSignal({
                    type: "request-stream",
                    from: tileClientId,
                    to: employeeEmail,
                  });
                }
              }, 3000);
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          // FIX 17: Drain queued ICE candidates AFTER setRemoteDescription
          await icqRef.current.flush();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await sendSignal({
            type: "answer",
            from: tileClientId,
            to: employeeEmail,
            payload: answer,
          });
        }

        if (msg.type === "ice-candidate" && msg.from === employeeEmail) {
          // FIX 18: Use the queue instead of adding directly — handles out-of-order delivery
          await icqRef.current.add(msg.payload);
        }
      } catch (err) {
        console.warn("VideoTile signal error:", err);
      }
    };

    es.onerror = () => {
      if (destroyedRef.current) return;
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (!destroyedRef.current) connectSSE();
      }, 5000);
    };
  }, [employeeEmail, sendSignal, onDisconnected]);

  useEffect(() => {
    destroyedRef.current = false;
    connectSSE();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      icqRef.current.reset();
    };
  }, [employeeEmail, connectSSE]);

  return (
    <div
      className="vt-wrap"
      style={{
        borderColor:
          status === "live"
            ? "rgba(0,255,136,0.3)"
            : status === "offline"
            ? "rgba(248,113,113,0.3)"
            : "rgba(255,255,255,0.1)",
      }}
    >
      <div className="vt-video-area">
        {status === "connecting" && (
          <div className="vt-overlay">
            <div className="vt-spinner" />
            <div className="vt-overlay-text">Connecting to {employeeName}…</div>
          </div>
        )}
        {status === "error" && (
          <div className="vt-overlay">
            <div className="vt-overlay-text vt-overlay-text--err">❌ Camera error</div>
          </div>
        )}
        {status === "offline" && (
          <div className="vt-overlay">
            <div className="vt-overlay-text vt-overlay-text--dim">📴 Employee offline</div>
          </div>
        )}
        {status === "live" && <div className="vt-live-badge">● LIVE</div>}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: status === "live" ? "block" : "none",
            transform: "scaleX(-1)",
          }}
        />
      </div>
      <div
        className="vt-info"
        style={{ background: status === "live" ? "rgba(0,255,136,0.08)" : "rgba(0,0,0,0.3)" }}
      >
        <div className="vt-info-left">
          <div className="vt-name">{employeeName}</div>
          <div className="vt-email">{employeeEmail}</div>
        </div>
        <div className="vt-info-right">
          <div
            className="vt-action"
            style={{
              color:
                status === "live" ? "#00ff88" :
                status === "offline" ? "#f87171" : "#fbbf24",
            }}
          >
            {status === "live" ? "🟢 LIVE" :
             status === "offline" ? "🔴 OFFLINE" :
             status === "error" ? "❌ ERROR" : "⏳ CONNECTING"}
          </div>
        </div>
      </div>
    </div>
  );
}