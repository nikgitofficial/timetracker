// app/api/time/punch/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import TimeEntry from "@/models/TimeEntry";

type Action = "check-in" | "break-in" | "break-out" | "bio-break-in" | "bio-break-out" | "check-out";

function formatMinutes(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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

    // ── CHECK IN ─────────────────────────────────────────────────
    if (action === "check-in") {
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
        date: today,
        checkIn: now,
        breaks: [],
        bioBreaks: [],
        status: "checked-in",
      });

      return NextResponse.json({ message: `✅ ${name} checked in successfully`, entry, action: "check-in" });
    }

    // Find active shift for all other actions
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const entry = await TimeEntry.findOne({
      email: normalizedEmail,
      employeeName: name,
      status: { $ne: "checked-out" },
      checkIn: { $gte: oneDayAgo },
    }).sort({ checkIn: -1 });

    if (!entry) {
      return NextResponse.json({ error: "No active shift found. Please check in first." }, { status: 400 });
    }

    // ── BREAK IN (lunch / regular) ────────────────────────────────
    if (action === "break-in") {
      if (entry.status === "on-break") {
        return NextResponse.json({ error: "Already on a break" }, { status: 400 });
      }
      if (entry.status === "on-bio-break") {
        return NextResponse.json({ error: "Please end your bio break first" }, { status: 400 });
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

    // ── BREAK OUT ─────────────────────────────────────────────────
    if (action === "break-out") {
      if (entry.status !== "on-break") {
        return NextResponse.json({ error: "Not currently on a break" }, { status: 400 });
      }
      const openBreak = entry.breaks.slice().reverse().find(
        (b: { breakIn: Date; breakOut: Date | null; duration: number }) => !b.breakOut
      );
      if (!openBreak) {
        return NextResponse.json({ error: "No open break session found" }, { status: 400 });
      }
      const breakMins = Math.round((now.getTime() - new Date(openBreak.breakIn).getTime()) / 60000);
      openBreak.breakOut = now;
      openBreak.duration = breakMins;
      entry.totalBreak = entry.breaks.reduce(
        (sum: number, b: { duration: number }) => sum + (b.duration || 0), 0
      );
      entry.status = "returned";
      entry.markModified("breaks");
      await entry.save();
      return NextResponse.json({
        message: `🔄 Returned from break #${entry.breaks.length} — ${formatMinutes(breakMins)}`,
        entry,
        action: "break-out",
      });
    }

    // ── BIO BREAK IN (CR, water, quick personal) ──────────────────
    if (action === "bio-break-in") {
      if (entry.status === "on-bio-break") {
        return NextResponse.json({ error: "Already on a bio break" }, { status: 400 });
      }
      if (entry.status === "on-break") {
        return NextResponse.json({ error: "Please end your break first" }, { status: 400 });
      }
      if (!entry.bioBreaks) entry.bioBreaks = [];
      entry.bioBreaks.push({ breakIn: now, breakOut: null, duration: 0 });
      entry.status = "on-bio-break";
      entry.markModified("bioBreaks");
      await entry.save();
      return NextResponse.json({
        message: `🚻 Bio break #${entry.bioBreaks.length} started`,
        entry,
        action: "bio-break-in",
      });
    }

    // ── BIO BREAK OUT ─────────────────────────────────────────────
    if (action === "bio-break-out") {
      if (entry.status !== "on-bio-break") {
        return NextResponse.json({ error: "Not currently on a bio break" }, { status: 400 });
      }
      const openBio = entry.bioBreaks.slice().reverse().find(
        (b: { breakIn: Date; breakOut: Date | null; duration: number }) => !b.breakOut
      );
      if (!openBio) {
        return NextResponse.json({ error: "No open bio break session found" }, { status: 400 });
      }
      const bioMins = Math.round((now.getTime() - new Date(openBio.breakIn).getTime()) / 60000);
      openBio.breakOut = now;
      openBio.duration = bioMins;
      entry.totalBioBreak = entry.bioBreaks.reduce(
        (sum: number, b: { duration: number }) => sum + (b.duration || 0), 0
      );
      entry.status = "returned";
      entry.markModified("bioBreaks");
      await entry.save();
      return NextResponse.json({
        message: `✅ Back from bio break #${entry.bioBreaks.length} — ${formatMinutes(bioMins)}`,
        entry,
        action: "bio-break-out",
      });
    }

    // ── CHECK OUT ─────────────────────────────────────────────────
    if (action === "check-out") {
      if (entry.status === "on-break") {
        return NextResponse.json({ error: "Please end your break before checking out" }, { status: 400 });
      }
      if (entry.status === "on-bio-break") {
        return NextResponse.json({ error: "Please end your bio break before checking out" }, { status: 400 });
      }
      entry.checkOut = now;
      entry.status = "checked-out";
      entry.totalBreak = entry.breaks.reduce(
        (sum: number, b: { duration: number }) => sum + (b.duration || 0), 0
      );
      entry.totalBioBreak = (entry.bioBreaks || []).reduce(
        (sum: number, b: { duration: number }) => sum + (b.duration || 0), 0
      );
      if (entry.checkIn) {
        const spanMins = Math.round((now.getTime() - new Date(entry.checkIn).getTime()) / 60000);
        entry.totalWorked = Math.max(0, spanMins - entry.totalBreak - entry.totalBioBreak);
      }
      await entry.save();
      return NextResponse.json({
        message: `👋 ${name} checked out — worked ${formatMinutes(entry.totalWorked)}, ${entry.breaks.length} break(s) (${formatMinutes(entry.totalBreak)}), ${(entry.bioBreaks || []).length} bio break(s) (${formatMinutes(entry.totalBioBreak)})`,
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

// GET — fetch active shift by EMAIL + NAME
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const name = searchParams.get("name")?.trim();
    if (!email || !name) return NextResponse.json({ entry: null });

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