import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export const authMiddleware = (req: NextRequest) => {
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const user = verifyToken(token);
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
};
