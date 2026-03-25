// app/api/time/myrecord/route.ts
// Public endpoint — employees look up their own record by date
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import TimeEntry from "@/models/TimeEntry";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const name = searchParams.get("name")?.trim();
    const date = searchParams.get("date"); // "YYYY-MM-DD"

    if (!email || !name || !date) {
      return NextResponse.json({ error: "email, name, and date are required" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
    }

    const entry = await TimeEntry.findOne({
      email,
      employeeName: name,
      date,
    }).sort({ checkIn: -1 });

    return NextResponse.json({ entry: entry ?? null });
  } catch (err) {
    console.error("My record fetch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}