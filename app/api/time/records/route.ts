// app/api/time/records/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/mongodb";
import TimeEntry from "@/models/TimeEntry";
import Employee from "@/models/Employee";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function getAdminEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const dateFrom     = searchParams.get("from");
    const dateTo       = searchParams.get("to");
    const employeeName = searchParams.get("name");
    const emailFilter  = searchParams.get("email");
    const statusFilter = searchParams.get("status");
    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // ── Step 1: Get only emails belonging to this admin ──
    const ownedEmployees = await Employee.find({ ownerEmail: adminEmail }).select("email");
    const ownedEmails = ownedEmployees.map((e: any) => e.email as string);

    // Admin has no employees yet
    if (ownedEmails.length === 0) {
      return NextResponse.json({ records: [], total: 0, page, totalPages: 0 });
    }

    // ── Step 2: Scope ALL queries to owned emails only ──
    const query: Record<string, unknown> = {
      email: { $in: ownedEmails },
    };

    if (statusFilter === "active") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.status = { $ne: "checked-out" };
      query.checkIn = { $gte: oneDayAgo };
    } else {
      if (dateFrom || dateTo) {
        query.date = {};
        if (dateFrom) (query.date as Record<string, string>).$gte = dateFrom;
        if (dateTo)   (query.date as Record<string, string>).$lte = dateTo;
      }
    }

    // Narrow within owned emails only
    if (emailFilter) {
      const narrowed = ownedEmails.filter((e) =>
        e.includes(emailFilter.trim().toLowerCase())
      );
      query.email = { $in: narrowed.length > 0 ? narrowed : ["__no_match__"] };
    }

    if (employeeName) {
      query.employeeName = { $regex: employeeName, $options: "i" };
    }

    const total   = await TimeEntry.countDocuments(query);
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

export async function DELETE(req: NextRequest) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify this record belongs to one of this admin's employees
    const record = await TimeEntry.findById(id);
    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const owned = await Employee.findOne({ ownerEmail: adminEmail, email: record.email });
    if (!owned) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    await TimeEntry.findByIdAndDelete(id);
    return NextResponse.json({ message: "Record deleted" });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}