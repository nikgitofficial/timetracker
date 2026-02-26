// app/api/time/daily/route.ts
// Creates and manages Daily.co video rooms tied to employee shifts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const DAILY_API_KEY = process.env.DAILY_API_KEY!;
const DAILY_BASE = "https://api.daily.co/v1";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function dailyFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${DAILY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daily API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── POST /api/time/daily
// Called by the employee time clock right after check-in
// Body: { email, employeeName, entryId }
// Returns: { roomUrl, token } — employee uses these to join silently
export async function POST(req: NextRequest) {
  try {
    const { email, employeeName, entryId } = await req.json();
    if (!email || !entryId) {
      return NextResponse.json({ error: "email and entryId required" }, { status: 400 });
    }

    // Room name is based on entryId so it's unique per shift
    const roomName = `shift-${entryId}`;

    // Create room — expires after 12 hours (max shift length)
    const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

    let room;
    try {
      // Try to get existing room first
      room = await dailyFetch(`/rooms/${roomName}`);
    } catch {
      // Create new room
      room = await dailyFetch("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp: expiry,
            max_participants: 2, // employee + admin viewer
            enable_chat: false,
            enable_screenshare: false,
            start_video_off: false,
            start_audio_off: true, // no audio — video only
            

            owner_only_broadcast: false,
          },
        }),
      });
    }

    // Create a meeting token for the employee (participant)
    const employeeToken = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: employeeName || email,
          user_id: email,
          exp: expiry,
          is_owner: false,
          start_video_off: false,
          start_audio_off: true,
          
        },
      }),
    });

    // Create a viewer token for admin (owner)
    const adminToken = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: "admin",
          exp: expiry,
          is_owner: true,
          start_video_off: true,  // admin joins with cam off
          start_audio_off: true,
        },
      }),
    });

    return NextResponse.json({
      roomUrl: room.url,
      roomName,
      employeeToken: employeeToken.token,
      adminToken: adminToken.token,
      expiresAt: expiry,
    });
  } catch (err) {
    console.error("Daily room creation error:", err);
    return NextResponse.json({ error: "Failed to create video room" }, { status: 500 });
  }
}

// ── GET /api/time/daily?roomName=shift-xxx
// Returns an admin viewer token for a specific room
// Protected — admin only
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const roomName = searchParams.get("roomName");
  if (!roomName) return NextResponse.json({ error: "roomName required" }, { status: 400 });

  try {
    const expiry = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // 2h admin token
    const adminToken = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: "admin",
          exp: expiry,
          is_owner: true,
          start_video_off: true,
          start_audio_off: true,
        },
      }),
    });
    return NextResponse.json({ token: adminToken.token });
  } catch (err) {
    return NextResponse.json({ error: "Failed to get admin token" }, { status: 500 });
  }
}

// ── DELETE /api/time/daily
// Called on check-out to destroy the room
// Body: { roomName }
export async function DELETE(req: NextRequest) {
  try {
    const { roomName } = await req.json();
    if (!roomName) return NextResponse.json({ error: "roomName required" }, { status: 400 });

    await dailyFetch(`/rooms/${roomName}`, { method: "DELETE" });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Daily room delete error:", err);
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}