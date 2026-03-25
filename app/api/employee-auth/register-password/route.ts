// app/api/employee-auth/register-password/route.ts
//
// Allows an employee to SET or CHANGE their private password.
// Identity is verified by name lookup (no email needed on the form).
// - First time: name match is enough to set a password.
// - Change:     must provide current password to set a new one.

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";
import bcrypt from "bcryptjs";

const MIN_PW_LEN = 6;

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { name, currentPassword, newPassword, confirmPassword } = await req.json();

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!newPassword || newPassword.length < MIN_PW_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PW_LEN} characters.` },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const normalizedName = name.trim();

    // ── Find employee by name ─────────────────────────────────────────────────
    const employee = await Employee.findOne({
      employeeName: {
        $regex: new RegExp(
          `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "No employee found with that name." },
        { status: 404 }
      );
    }
    if (employee.status === "inactive") {
      return NextResponse.json(
        { error: "Your account is inactive. Please contact your manager." },
        { status: 403 }
      );
    }

    // ── Verify identity ───────────────────────────────────────────────────────
    if (employee.passwordHash) {
      // Already has a password — must provide it to change
      if (!currentPassword?.trim()) {
        return NextResponse.json(
          { error: "Please enter your current password to set a new one." },
          { status: 401 }
        );
      }
      const valid = await bcrypt.compare(currentPassword, employee.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
      }
    }
    // First time — name match is sufficient

    // ── Hash and save ─────────────────────────────────────────────────────────
    employee.passwordHash = await bcrypt.hash(newPassword, 12);
    await employee.save();

    return NextResponse.json({
      message: "Password set successfully. You can now sign in with your new password.",
    });
  } catch (err) {
    console.error("register-password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}