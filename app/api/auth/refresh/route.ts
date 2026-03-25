// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import User from "@/models/User";
import { signAccessToken } from "@/lib/jwt";
import connectDB from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refreshToken")?.value;
  if (!refreshToken) return NextResponse.json({}, { status: 401 });

  try {
    await connectDB();
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      email: string;
    };

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken)
      return NextResponse.json({}, { status: 403 });

    const newAccess = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    const res = NextResponse.json({ message: "Access token refreshed" });
    res.cookies.set("accessToken", newAccess, {
      httpOnly: true,
      secure: true,
      sameSite: "lax", // ✅ FIXED: was "none"
      path: "/",
      maxAge: 900,
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({}, { status: 403 });
  }
}