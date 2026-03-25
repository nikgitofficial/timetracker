import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import OTP from "@/models/OTP";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  await connectDB();

  const { email, otp, newPassword } = await req.json();
  if (!email || !otp || !newPassword)
    return NextResponse.json({ error: "All fields required" }, { status: 400 });

  const otpEntry = await OTP.findOne({ email, otp });
  if (!otpEntry || otpEntry.expiresAt < new Date())
    return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });

  const user = await User.findOne({ email });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  await OTP.deleteMany({ email });

  return NextResponse.json({ message: "Password reset successfully" });
}
