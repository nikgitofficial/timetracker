// app/api/employees/photo/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { put } from "@vercel/blob";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function getOwnerEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload.email || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const employeeId = formData.get("employeeId") as string;

    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
    if (!employeeId) return NextResponse.json({ error: "Employee ID required" }, { status: 400 });

    // Verify ownership
    const employee = await Employee.findOne({ _id: employeeId, ownerEmail });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const ext = file.type.includes("png") ? "png" : "jpg";
    const filename = `employee-pics/${ownerEmail.replace("@", "_")}-${employeeId}-${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    employee.profilePic = blob.url;
    await employee.save();

    return NextResponse.json({ profilePic: blob.url, employee });
  } catch (err) {
    console.error("Employee photo upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}