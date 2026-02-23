// app/api/employees/lookup/route.ts
// PUBLIC endpoint — used by time clock to validate employee by email
// Returns ALL employees matching this email (across all owners) so the user can pick their name
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) return NextResponse.json({ employee: null, employees: [] });

    // ✅ Find ALL employees with this email across all owners
    const employees = await Employee.find({ email }).select(
      "employeeName email profilePic role campaign status -_id"
    );

    if (!employees || employees.length === 0) {
      return NextResponse.json({ employee: null, employees: [] });
    }

    // If only one match, return it directly (backward compatible)
    if (employees.length === 1) {
      return NextResponse.json({ employee: employees[0], employees });
    }

    // Multiple matches — return all, let frontend show picker
    return NextResponse.json({ employee: null, employees });
  } catch (err) {
    console.error("Employee lookup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}