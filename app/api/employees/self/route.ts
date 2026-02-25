// app/api/employees/self/route.ts
// Employee self-service endpoint — authenticated via employeeSession cookie/header
// Allows updating: birthdate, notes, profilePic only
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";
import { put } from "@vercel/blob";

export async function PUT(req: NextRequest) {
  try {
    await connectDB();

    // Employee session is stored in the request header (sent from frontend)
    const sessionHeader = req.headers.get("x-employee-session");
    if (!sessionHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let session: { email: string; employeeName: string } | null = null;
    try { session = JSON.parse(sessionHeader); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

    if (!session?.email || !session?.employeeName)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Only these fields are self-editable
    const allowed: Record<string, unknown> = {};
    if (typeof body.birthdate === "string") allowed.birthdate = body.birthdate.trim();
    if (typeof body.notes    === "string") allowed.notes     = body.notes.trim();

    if (Object.keys(allowed).length === 0)
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    const employee = await Employee.findOneAndUpdate(
      { email: session.email, employeeName: session.employeeName },
      { $set: allowed },
      { new: true }
    ).select("-passwordHash -ownerEmail");

    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    return NextResponse.json({ employee });
  } catch (err) {
    console.error("Self-update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Photo upload — employee uploads their own profile pic
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const sessionHeader = req.headers.get("x-employee-session");
    if (!sessionHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let session: { email: string; employeeName: string } | null = null;
    try { session = JSON.parse(sessionHeader); } catch { return NextResponse.json({ error: "Invalid session" }, { status: 401 }); }

    if (!session?.email || !session?.employeeName)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    // Validate file
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });

    const employee = await Employee.findOne({ email: session.email, employeeName: session.employeeName });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const ext = file.type.includes("png") ? "png" : "jpg";
    const filename = `employee-pics/self-${session.email.replace("@", "_")}-${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    employee.profilePic = blob.url;
    await employee.save();

    return NextResponse.json({ profilePic: blob.url });
  } catch (err) {
    console.error("Self photo upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}