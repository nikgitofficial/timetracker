// app/api/time/punch/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import TimeEntry from "@/models/TimeEntry";

type Action = "check-in" | "break-in" | "break-out" | "check-out";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { employeeName, email, action }: { employeeName: string; email: string; action: Action } =
      await req.json();

    if (!employeeName || !email || !action) {
      return NextResponse.json({ error: "Name, email and action are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const name = employeeName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // ── CHECK IN ──────────────────────────────────────────────
    if (action === "check-in") {
      // For check-in, look for ANY active shift in the last 24 hours
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const existingActiveShift = await TimeEntry.findOne({
        email: normalizedEmail,
        employeeName: name,
        status: { $ne: "checked-out" },
        checkIn: { $gte: oneDayAgo },
      });

      if (existingActiveShift) {
        return NextResponse.json(
          { error: "You have an active shift already. Please check out first." },
          { status: 400 }
        );
      }

      const entry = await TimeEntry.create({
        employeeName: name,
        email: normalizedEmail,
        date: today, // "shift start date" — the date they checked in
        checkIn: now,
        breaks: [],
        status: "checked-in",
      });

      return NextResponse.json({
        message: `✅ ${name} checked in successfully`,
        entry,
        action: "check-in",
      });
    }

    // ✅ For ALL other actions (break/checkout), find the ACTIVE shift (even if it started yesterday)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const entry = await TimeEntry.findOne({
      email: normalizedEmail,
      employeeName: name,
      status: { $ne: "checked-out" }, // Find active shift
      checkIn: { $gte: oneDayAgo },   // Within last 24 hours
    }).sort({ checkIn: -1 }); // Most recent first

    if (!entry) {
      return NextResponse.json(
        { error: "No active shift found. Please check in first." },
        { status: 400 }
      );
    }

    // ── BREAK IN ──────────────────────────────────────────────
    if (action === "break-in") {
      if (entry.status === "on-break") {
        return NextResponse.json({ error: "Already on break" }, { status: 400 });
      }
      entry.breaks.push({ breakIn: now, breakOut: null, duration: 0 });
      entry.status = "on-break";
      await entry.save();
      return NextResponse.json({
        message: `☕ Break #${entry.breaks.length} started`,
        entry,
        action: "break-in",
      });
    }

    // ── BREAK OUT ─────────────────────────────────────────────
    if (action === "break-out") {
      if (entry.status !== "on-break") {
        return NextResponse.json({ error: "Not currently on break" }, { status: 400 });
      }
      const openBreak = entry.breaks
        .slice()
        .reverse()
        .find((b: { breakIn: Date; breakOut: Date | null; duration: number }) => !b.breakOut);

      if (!openBreak) {
        return NextResponse.json({ error: "No open break session found" }, { status: 400 });
      }
      const breakMins = Math.round(
        (now.getTime() - new Date(openBreak.breakIn).getTime()) / 60000
      );
      openBreak.breakOut = now;
      openBreak.duration = breakMins;
      entry.totalBreak = entry.breaks.reduce(
        (sum: number, b: { duration: number }) => sum + (b.duration || 0), 0
      );
      entry.status = "returned";
      entry.markModified("breaks");
      await entry.save();
      return NextResponse.json({
        message: `🔄 Returned from break #${entry.breaks.length} — break was ${formatMinutes(breakMins)}`,
        entry,
        action: "break-out",
      });
    }

    // ── CHECK OUT ─────────────────────────────────────────────
    if (action === "check-out") {
      if (entry.status === "on-break") {
        return NextResponse.json({ error: "Please end your break before checking out" }, { status: 400 });
      }
      entry.checkOut = now;
      entry.status = "checked-out";
      entry.totalBreak = entry.breaks.reduce(
        (sum: number, b: { duration: number }) => sum + (b.duration || 0), 0
      );
      if (entry.checkIn) {
        const spanMins = Math.round(
          (now.getTime() - new Date(entry.checkIn).getTime()) / 60000
        );
        entry.totalWorked = Math.max(0, spanMins - entry.totalBreak);
      }
      await entry.save();
      return NextResponse.json({
        message: `👋 ${name} checked out — worked ${formatMinutes(entry.totalWorked)}, ${entry.breaks.length} break(s) totalling ${formatMinutes(entry.totalBreak)}`,
        entry,
        action: "check-out",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Time punch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET — fetch active shift by EMAIL + NAME (even if it started yesterday)
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const name = searchParams.get("name")?.trim();
    if (!email || !name) return NextResponse.json({ entry: null });

    // ✅ Find the most recent ACTIVE shift within last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const entry = await TimeEntry.findOne({
      email,
      employeeName: name,
      status: { $ne: "checked-out" },
      checkIn: { $gte: oneDayAgo },
    }).sort({ checkIn: -1 });

    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function formatMinutes(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}