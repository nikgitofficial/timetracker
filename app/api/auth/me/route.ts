// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signAccessToken } from "@/lib/jwt";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  await connectDB();

  const accessToken = req.cookies.get("accessToken")?.value;
  const refreshToken = req.cookies.get("refreshToken")?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({}, { status: 401 });
  }

  try {
    if (accessToken) {
      const decoded = verifyToken(accessToken);
      const userFromDB = await User.findById(decoded.userId);
      if (!userFromDB) return NextResponse.json({}, { status: 401 });

      return NextResponse.json({
        user: {
          email: userFromDB.email,
          name: userFromDB.name,
          photoUrl: userFromDB.photo || "",
          _id: userFromDB._id.toString(),
        },
      });
    }
  } catch {
    if (!refreshToken) return NextResponse.json({}, { status: 401 });

    try {
      const decoded = verifyToken(refreshToken);
      const userFromDB = await User.findById(decoded.userId);
      if (!userFromDB || userFromDB.refreshToken !== refreshToken) {
        return NextResponse.json({}, { status: 401 });
      }

      const newAccessToken = signAccessToken({
        userId: userFromDB._id.toString(),
        email: userFromDB.email,
        name: userFromDB.name,
      });

      const res = NextResponse.json({
        user: {
          email: userFromDB.email,
          name: userFromDB.name,
          photoUrl: userFromDB.photo || "",
          _id: userFromDB._id.toString(),
        },
      });

      res.cookies.set("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax", // ✅ FIXED: was "none"
        path: "/",
        maxAge: 900,
      });

      return res;
    } catch {
      return NextResponse.json({}, { status: 401 });
    }
  }

  return NextResponse.json({}, { status: 401 });
}