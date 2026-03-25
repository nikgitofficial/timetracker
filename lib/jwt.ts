import jwt from "jsonwebtoken";

export type JWTPayload = {
  userId: string;
  email: string;
  name: string;
};

export function signAccessToken(payload: JWTPayload) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "15m" });
}

export function signRefreshToken(payload: JWTPayload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d" });
}

export function verifyToken(token: string, isRefresh = false) {
  const secret = isRefresh ? process.env.JWT_REFRESH_SECRET! : process.env.JWT_SECRET!;
  return jwt.verify(token, secret) as JWTPayload;
}
