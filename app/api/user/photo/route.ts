import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { verifyToken } from "@/lib/jwt";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // Verify access token
    const token = req.cookies.get("accessToken")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let user;
    try {
      user = verifyToken(token); // should return { userId, email, name }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });

    // Upload file to Vercel Blob with a unique name
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true, // avoid collisions
      token: process.env.BLOB_READ_WRITE_TOKEN, // ✅ fixed typo (was BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN)
    });

    // Save URL to user's photo
    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      { photo: blob.url },
      { new: true }
    );

    // Return the URL (frontend uses ?t=timestamp for instant refresh)
    return NextResponse.json({ photo: updatedUser?.photo });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}