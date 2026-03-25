// app/api/time/records/route.ts
// Protected - only accessible when authenticated (middleware handles /api/time/records)
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import TimeEntry from "@/models/TimeEntry";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const employeeName = searchParams.get("name");
    const emailFilter = searchParams.get("email");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const query: Record<string, unknown> = {};

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) (query.date as Record<string, string>).$gte = dateFrom;
      if (dateTo) (query.date as Record<string, string>).$lte = dateTo;
    }

    // Always filter by email (the team/company email that owns these records)
    // Optionally also filter by name to narrow down to a specific employee
    if (emailFilter) {
      query.email = { $regex: emailFilter.trim(), $options: "i" };
    }
    if (employeeName) {
      // ✅ Name filter works ON TOP of email — shows just e.g. "John" under company@email.com
      query.employeeName = { $regex: employeeName, $options: "i" };
    }

    const total = await TimeEntry.countDocuments(query);
    const records = await TimeEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Records fetch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE a record by ID (admin only)
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await TimeEntry.findByIdAndDelete(id);
    return NextResponse.json({ message: "Record deleted" });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}