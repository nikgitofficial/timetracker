// ========================================
// 1. app/api/auth/login/route.ts
// ========================================
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    console.log("=== LOGIN START ===");
    await connectDB();
    const { email, password } = await req.json();

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const payload = { userId: user._id.toString(), email: user.email, name: user.name };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshToken = refreshToken;
    await user.save();

    const res = NextResponse.json({ 
      message: "Login success",
      user: { email: user.email, name: user.name, _id: user._id.toString() }
    });

    // ⭐ CRITICAL: Use "lax" not "none"
    const isProduction = process.env.NODE_ENV === "production";
    
    res.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax", // Changed from "none"
      path: "/",
      maxAge: 900,
    });

    res.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax", // Changed from "none"
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    console.log("Cookies set:", { isProduction });
    console.log("=== LOGIN END ===");
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

