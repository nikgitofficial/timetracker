// app/api/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Employee from "@/models/Employee";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

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

// GET — list all employees for this owner
export async function GET() {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const employees = await Employee.find({ ownerEmail }).sort({ createdAt: -1 });
  return NextResponse.json({ employees });
}

// POST — create new employee
export async function POST(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const body = await req.json();
  const { employeeName, email, role, campaign, status, birthdate, notes } = body;

  if (!employeeName?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });

  try {
    const employee = await Employee.create({
      ownerEmail,
      employeeName: employeeName.trim(),
      email: email.trim().toLowerCase(),
      role: role || "Agent",
      campaign: campaign || "",
      status: status || "active",
      birthdate: birthdate || "",
      notes: notes || "",
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000)
      return NextResponse.json({ error: "Employee with this email already exists in your roster" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}

// PUT — update employee
export async function PUT(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Prevent hijacking
  delete updates.ownerEmail;
  delete updates.email; // email is immutable after creation

  const employee = await Employee.findOneAndUpdate(
    { _id: id, ownerEmail },
    { $set: updates },
    { new: true }
  );
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ employee });
}

// DELETE — remove employee
export async function DELETE(req: NextRequest) {
  const ownerEmail = await getOwnerEmail();
  if (!ownerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await Employee.findOneAndDelete({ _id: id, ownerEmail });
  return NextResponse.json({ message: "Employee removed" });
}