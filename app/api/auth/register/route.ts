import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { name, email, password } = await req.json();

    if (!name || !email || !password)
      return NextResponse.json({ error: "All fields required" }, { status: 400 });

    const userExists = await User.findOne({ email });
    if (userExists)
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword });

    // Create JWT tokens
    const payload = { userId: newUser._id.toString(), email: newUser.email, name: newUser.name };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    newUser.refreshToken = refreshToken;
    await newUser.save();

    const res = NextResponse.json({
      message: "User registered",
      user: { name: newUser.name, email: newUser.email },
    });

    // Set cookies
    res.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 900, // 15 minutes
    });

    res.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
