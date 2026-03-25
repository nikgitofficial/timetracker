// app/api/employee-auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { name, password } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const normalizedName = name.trim();

    // Look up by name only
    const employee = await Employee.findOne({
      employeeName: {
        $regex: new RegExp(
          `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    }).select("employeeName email role campaign status profilePic shift birthdate notes passwordHash _id");

    if (!employee) {
      return NextResponse.json(
        { error: "No employee found with that name. Please contact your manager." },
        { status: 401 }
      );
    }

    if (employee.status === "inactive") {
      return NextResponse.json(
        { error: "Your account is inactive. Please contact your manager." },
        { status: 403 }
      );
    }

    // ── Auth check ──────────────────────────────────────────────────────────
    if (employee.passwordHash) {
      // Has a custom password — must provide it
      if (!password?.trim()) {
        return NextResponse.json(
          { error: "This account has a password. Please enter your password.", needsPassword: true },
          { status: 401 }
        );
      }
      const valid = await bcrypt.compare(password, employee.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Incorrect password.", needsPassword: true },
          { status: 401 }
        );
      }
    } else {
      // No password set yet — name match alone is enough (legacy)
      // Encourage them to set a password for privacy
    }

    return NextResponse.json({
      message: "Login successful",
      hasPassword: !!employee.passwordHash,
      employee: {
        _id:          employee._id.toString(),
        employeeName: employee.employeeName,
        email:        employee.email,
        role:         employee.role,
        campaign:     employee.campaign,
        status:       employee.status,
        profilePic:   employee.profilePic,
        shift:        employee.shift,
        birthdate:    employee.birthdate,
        notes:        employee.notes,
      },
    });
  } catch (err) {
    console.error("Employee login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}