// middleware.ts — add /api/time/records and /dashboard/time to protected routes

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signAccessToken } from "@/lib/jwt";
import User from "@/models/User";
import connectDB from "@/lib/mongodb";

export async function middleware(req: NextRequest) {
  const accessToken = req.cookies.get("accessToken")?.value;
  const refreshToken = req.cookies.get("refreshToken")?.value;
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");

  if (!accessToken && !refreshToken) {
    if (isApiRoute)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    if (accessToken) {
      verifyToken(accessToken, false);
      return NextResponse.next();
    }
  } catch {
    if (!refreshToken) {
      if (isApiRoute)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      await connectDB();
      const decoded = verifyToken(refreshToken, true);
      const user = await User.findById(decoded.userId);

      if (!user || user.refreshToken !== refreshToken) {
        if (isApiRoute)
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.redirect(new URL("/login", req.url));
      }

      const newAccess = signAccessToken({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      });

      const response = NextResponse.next();
      const isProduction = process.env.NODE_ENV === "production";

      response.cookies.set("accessToken", newAccess, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 900,
      });

      return response;
    } catch {
      if (isApiRoute)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (isApiRoute)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/notes/:path*",
    // ✅ NEW: protect time records API (but NOT the public punch endpoint)
    "/api/time/records/:path*",
  ],
};