// middleware.ts
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
      response.cookies.set("accessToken", newAccess, {
        httpOnly: true,
        secure: true,
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
    "/api/time/records/:path*",
    "/api/employees/:path*", // ✅ ADDED
  ],
};