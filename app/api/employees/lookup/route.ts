

// app/api/employees/lookup/route.ts
// PUBLIC endpoint — used by time clock to validate employee by email
// Returns: employeeName, email, profilePic, role, campaign, status
// Does NOT expose ownerEmail or internal IDs
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) return NextResponse.json({ employee: null });

    const employee = await Employee.findOne({ email }).select(
      "employeeName email profilePic role campaign status -_id"
    );

    if (!employee) return NextResponse.json({ employee: null });

    return NextResponse.json({ employee });
  } catch (err) {
    console.error("Employee lookup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}