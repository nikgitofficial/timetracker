"use client";

import { useEffect, useRef, useCallback } from "react";

interface SilentCameraProps {
  entryId: string;
  employeeName: string;
  email: string;
  onRoomReady?: (roomName: string) => void;
  onError?: (err: string) => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export default function SilentCamera({
  entryId,
  employeeName,
  email,
  onRoomReady,
  onError,
}: SilentCameraProps) {
  const streamRef = useRef<MediaStream | null>(null);
  // FIX 1: Store peer state alongside the connection so we can check if it's
  // still usable before deciding to skip or replace it
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  // FIX 2: A single stable clientId derived from email — never changes, so
  // the SSE connection survives re-renders and React Strict Mode double-mounts
  const clientIdRef = useRef(`emp-${email}`);
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendSignal = useCallback(async (message: object) => {
    try {
      await fetch("/api/time/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch (err) {
      console.warn("SilentCamera signal error:", err);
    }
  }, []);

  const createPeerForAdmin = useCallback(async (adminId: string) => {
    if (!streamRef.current) return;

    // FIX 3: Check if existing peer is actually alive before skipping.
    // A "closed" or "failed" peer must be replaced, not reused.
    const existing = peersRef.current.get(adminId);
    if (existing) {
      const state = existing.connectionState;
      if (state === "connected" || state === "connecting") {
        return; // genuinely in-progress or live — skip
      }
      // Stale/dead peer — close it and make a new one
      existing.close();
      peersRef.current.delete(adminId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(adminId, pc);

    streamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, streamRef.current!);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({
          type: "ice-candidate",
          from: email,
          to: adminId,
          payload: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        peersRef.current.delete(adminId);
        pc.close();
        // FIX 4: If the admin reconnects they'll send another request-stream,
        // which will re-run this function cleanly — no manual retry needed here
      }
    };

    // FIX 5: Wrap offer/answer in try-catch so a signaling race doesn't
    // crash the whole camera — just clean up and let admin retry
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal({
        type: "offer",
        from: email,
        to: adminId,
        payload: offer,
        employeeName,
        entryId,
      });
    } catch (err) {
      console.warn("SilentCamera offer error:", err);
      peersRef.current.delete(adminId);
      pc.close();
    }
  }, [email, employeeName, entryId, sendSignal]);

  // FIX 6: Extracted connectSSE so we can call it for reconnects without
  // re-acquiring the camera (expensive + causes permission prompts)
  const connectSSE = useCallback(() => {
    if (destroyedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(
      `/api/time/signal?clientId=${encodeURIComponent(clientIdRef.current)}&role=employee`
    );
    esRef.current = es;

    es.onopen = () => {
      if (destroyedRef.current) return;
      sendSignal({
        type: "register",
        from: email,
        employeeName,
        entryId,
      });
      onRoomReady?.(entryId);
    };

    es.onmessage = async (e) => {
      if (destroyedRef.current) return;
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === "request-stream" && msg.to === email) {
          await createPeerForAdmin(msg.from);
        }

        if (msg.type === "answer" && msg.to === email) {
          const pc = peersRef.current.get(msg.from);
          // FIX 7: Guard signalingState before setRemoteDescription to avoid
          // "InvalidStateError: cannot set remote answer in state X" crashes
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          }
        }

        if (msg.type === "ice-candidate" && msg.to === email) {
          const pc = peersRef.current.get(msg.from);
          if (pc && pc.remoteDescription) {
            // FIX 8: Only add ICE if remote description is set — queuing
            // candidates on a peer that has no remote desc causes silent drops
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
          }
        }
      } catch (err) {
        console.warn("SilentCamera message error:", err);
      }
    };

    es.onerror = () => {
      if (destroyedRef.current) return;
      esRef.current?.close();
      esRef.current = null;
      // FIX 9: Back off 5s before reconnecting SSE — don't hammer the server
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (!destroyedRef.current) connectSSE();
      }, 5000);
    };
  }, [email, employeeName, entryId, sendSignal, createPeerForAdmin, onRoomReady]);

  useEffect(() => {
    destroyedRef.current = false;

    const start = async () => {
      try {
        // FIX 10: Reuse existing stream if tracks are still live — avoids
        // re-requesting camera permission on reconnects and Strict Mode remounts
        if (
          streamRef.current &&
          streamRef.current.getTracks().every((t) => t.readyState === "live")
        ) {
          connectSSE();
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (destroyedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        connectSSE();
      } catch (err: any) {
        if (!destroyedRef.current) {
          console.warn("SilentCamera start error:", err?.message);
          onError?.(err?.message || "Camera error");
        }
      }
    };

    start();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, [entryId, email, employeeName, connectSSE]);

  return null;
}