// app/api/time/signal/route.ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// ── Types ─────────────────────────────────────────────────────────────────────
type SignalMessage = {
  type: "offer" | "answer" | "ice-candidate" | "register" | "request-stream" | "employee-list";
  from: string;
  to?: string;
  payload?: any;
  employeeName?: string;
  entryId?: string;
};

// Updated: ownerEmail stored per admin connection
type Subscriber = {
  id: string;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  isAdmin: boolean;
  ownerEmail?: string;
};

// ── In-memory stores ──────────────────────────────────────────────────────────
const clients = new Map<string, Subscriber>();

const activeEmployees = new Map<string, {
  email: string;
  employeeName: string;
  entryId: string;
  connectedAt: string;
}>();

const pendingMessages = new Map<string, object[]>();
const PENDING_CAP = 30;
const BUFFERABLE_TYPES = new Set(["offer", "answer", "ice-candidate", "request-stream"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Given an admin email, return the set of employee emails they own
async function getOwnedEmails(adminEmail: string): Promise<Set<string>> {
  try {
    await connectDB();
    const emps = await Employee.find({ ownerEmail: adminEmail }).select("email");
    return new Set(emps.map((e: any) => e.email as string));
  } catch {
    return new Set();
  }
}

// Given an employee email, return the set of admin emails who own them
async function getAdminEmailsForEmployee(employeeEmail: string): Promise<Set<string>> {
  try {
    await connectDB();
    const emps = await Employee.find({ email: employeeEmail }).select("ownerEmail");
    return new Set(emps.map((e: any) => e.ownerEmail as string));
  } catch {
    return new Set();
  }
}

// Decode admin email from JWT cookie
async function getAdminEmailFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    return decoded.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function sendToClient(clientId: string, data: object) {
  const client = clients.get(clientId);

  if (!client) {
    const d = data as any;
    if (BUFFERABLE_TYPES.has(d.type)) {
      const pending = pendingMessages.get(clientId) ?? [];
      pending.push(data);
      pendingMessages.set(clientId, pending.slice(-PENDING_CAP));
    }
    return;
  }

  try {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    client.controller.enqueue(client.encoder.encode(msg));
  } catch {
    clients.delete(clientId);
  }
}

export function broadcastSignal(message: SignalMessage) {
  if (message.to) {
    sendToClient(message.to, message);
  } else {
    clients.forEach((_, id) => sendToClient(id, message));
  }
}

export const dynamic = "force-dynamic";

// ── GET — open SSE stream ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const role = searchParams.get("role");

  if (!clientId) return new Response("clientId required", { status: 400 });

  // Admins must be authenticated
  let ownerEmail: string | undefined;
  if (role === "admin") {
    const adminEmail = await getAdminEmailFromCookie();
    if (!adminEmail) return new Response("Unauthorized", { status: 401 });
    ownerEmail = adminEmail;
  }

  const encoder = new TextEncoder();
  const isAdmin = role === "admin";

  const stream = new ReadableStream({
    start(controller) {
      // Register client with ownerEmail for admins
      clients.set(clientId, {
        id: clientId,
        controller,
        encoder,
        isAdmin,
        ownerEmail,
      });

      // Drain buffered messages for this client
      const pending = pendingMessages.get(clientId) ?? [];
      if (pending.length > 0) {
        pendingMessages.delete(clientId);
        for (const msg of pending) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
          } catch {
            break;
          }
        }
      }

      // Send filtered employee list to admin on connect
      if (isAdmin && ownerEmail) {
        // Use async IIFE since start() can't be async
        (async () => {
          try {
            const ownedEmails = await getOwnedEmails(ownerEmail!);
            const empList = Array.from(activeEmployees.values()).filter((emp) =>
              ownedEmails.has(emp.email)
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "employee-list", payload: empList })}\n\n`
              )
            );
          } catch {}
        })();
      }

      // Heartbeat every 25s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clients.delete(clientId);

        if (!isAdmin && activeEmployees.has(clientId)) {
          activeEmployees.delete(clientId);
          pendingMessages.delete(clientId);

          // Only notify admins who own this employee
          clients.forEach((client) => {
            if (client.isAdmin && client.ownerEmail) {
              // Fire-and-forget ownership check
              getAdminEmailsForEmployee(clientId).then((ownerSet) => {
                if (ownerSet.has(client.ownerEmail!)) {
                  sendToClient(client.id, {
                    type: "employee-disconnected",
                    from: clientId,
                  });
                }
              });
            }
          });
        }

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

// ── POST — receive and route a signaling message ──────────────────────────────
export async function POST(req: NextRequest) {
  const message: SignalMessage = await req.json();

  // Employee registration
  if (message.type === "register" && message.employeeName && message.entryId) {
    activeEmployees.set(message.from, {
      email: message.from,
      employeeName: message.employeeName,
      entryId: message.entryId,
      connectedAt: new Date().toISOString(),
    });

    // Only notify admins who own this employee
    const ownerAdmins = await getAdminEmailsForEmployee(message.from);

    clients.forEach((client) => {
      if (
        client.isAdmin &&
        client.ownerEmail &&
        ownerAdmins.has(client.ownerEmail)
      ) {
        sendToClient(client.id, {
          type: "employee-connected",
          from: message.from,
          employeeName: message.employeeName,
          entryId: message.entryId,
        });
      }
    });
  }

  // Route signal to specific target
  broadcastSignal(message);

  return new Response("ok");
}