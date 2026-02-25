// app/api/employee-auth/login/route.ts
// Employee login: username = their name, password = their email
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { name, email } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    // Match by name (case-insensitive) AND email
    const employee = await Employee.findOne({
      email: normalizedEmail,
      employeeName: { $regex: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).select("employeeName email role campaign status profilePic shift birthdate notes _id");

    if (!employee) {
      return NextResponse.json(
        { error: "No employee found with that name and email. Please contact your manager." },
        { status: 401 }
      );
    }

    if (employee.status === "inactive") {
      return NextResponse.json(
        { error: "Your account is inactive. Please contact your manager." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      message: "Login successful",
      employee: {
        _id: employee._id.toString(),
        employeeName: employee.employeeName,
        email: employee.email,
        role: employee.role,
        campaign: employee.campaign,
        status: employee.status,
        profilePic: employee.profilePic,
        shift: employee.shift,
        birthdate: employee.birthdate,
        notes: employee.notes,
      },
    });
  } catch (err) {
    console.error("Employee login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}