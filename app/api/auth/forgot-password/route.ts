import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import OTP from "@/models/OTP";
import sendEmail from "@/lib/sendEmail";

export async function POST(req: NextRequest) {
  await connectDB();

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = await User.findOne({ email });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.deleteMany({ email }); // remove old OTPs
  await OTP.create({ email, otp: otpCode, expiresAt });

  await sendEmail(email, "Password Reset OTP", otpCode);
  return NextResponse.json({ message: "OTP sent to your email" });
}
