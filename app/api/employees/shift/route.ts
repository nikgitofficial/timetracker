// app/api/employees/shift/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function getOwnerEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload.email || null;
  } catch {
    return null;
  }
}

// GET — fetch shift for one employee
export async function GET(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Employee ID required" }, { status: 400 });

    const emp = await Employee.findOne({ _id: id, ownerEmail }).select("shift employeeName email");
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ shift: emp.shift, employee: emp });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT — update shift for one employee
export async function PUT(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { employeeId, shift } = await req.json();

    if (!employeeId) return NextResponse.json({ error: "Employee ID required" }, { status: 400 });
    if (!shift?.startTime || !shift?.endTime)
      return NextResponse.json({ error: "Start and end time required" }, { status: 400 });
    if (!Array.isArray(shift.restDays))
      return NextResponse.json({ error: "restDays must be an array" }, { status: 400 });
    if (shift.restDays.length >= 7)
      return NextResponse.json({ error: "Employee must work at least one day" }, { status: 400 });

    const emp = await Employee.findOneAndUpdate(
      { _id: employeeId, ownerEmail },
      { $set: { shift } },
      { new: true }
    );
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ shift: emp.shift, employee: emp });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — bulk-update shift for multiple employees
export async function POST(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { employeeIds, shift } = await req.json();

    if (!Array.isArray(employeeIds) || employeeIds.length === 0)
      return NextResponse.json({ error: "Employee IDs required" }, { status: 400 });
    if (!shift?.startTime || !shift?.endTime)
      return NextResponse.json({ error: "Shift data required" }, { status: 400 });

    const result = await Employee.updateMany(
      { _id: { $in: employeeIds }, ownerEmail },
      { $set: { shift } }
    );

    return NextResponse.json({ updated: result.modifiedCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}