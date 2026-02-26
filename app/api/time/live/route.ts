// app/api/time/live/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

type LiveEvent = {
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
  dailyRoomName?: string;
};

type Subscriber = {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  ownerEmail: string; // every subscriber now has an ownerEmail
};

const subscribers = new Map<string, Subscriber>();

// Called by punch + selfie routes to broadcast
// Now filters per subscriber — each admin only gets their own employees' events
export async function broadcastPunchEvent(event: LiveEvent) {
  // Look up which admin owns this employee
  let ownerEmails: Set<string>;
  try {
    await connectDB();
    const emps = await Employee.find({ email: event.email }).select("ownerEmail");
    ownerEmails = new Set(emps.map((e: any) => e.ownerEmail as string));
  } catch {
    ownerEmails = new Set();
  }

  // Only send to admins who own this employee
  subscribers.forEach((sub, subId) => {
    if (!ownerEmails.has(sub.ownerEmail)) return;
    try {
      sub.controller.enqueue(
        sub.encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
      );
    } catch {
      subscribers.delete(subId);
    }
  });
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Auth check — get admin email from JWT
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return new Response("Unauthorized", { status: 401 });

  let ownerEmail: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    ownerEmail = decoded.email?.toLowerCase();
    if (!ownerEmail) throw new Error("No email in token");
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const subId = `${ownerEmail}-${Date.now()}`;

  const stream = new ReadableStream({
    start(controller) {
      subscribers.set(subId, { controller, encoder, ownerEmail });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscribers.delete(subId);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}