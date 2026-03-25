// app/api/time/selfie/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import TimeEntry from "@/models/TimeEntry";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const employeeName = (formData.get("employeeName") as string)?.trim();
    const action = formData.get("action") as string; // e.g. "check-in"

    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
    if (!email || !employeeName) return NextResponse.json({ error: "Email and name required" }, { status: 400 });

    // Upload to Vercel Blob
    const filename = `selfies/${email}-${action}-${Date.now()}.jpg`;
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Find the active/most recent TimeEntry for this employee today
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const entry = await TimeEntry.findOne({
      email,
      employeeName,
      checkIn: { $gte: oneDayAgo },
    }).sort({ checkIn: -1 });

    if (!entry) {
      return NextResponse.json({ error: "No time entry found" }, { status: 404 });
    }

    // Save selfie URL to entry — store per action as an array
    if (!entry.selfies) entry.selfies = [];
    entry.selfies.push({
      action,
      url: blob.url,
      takenAt: new Date(),
    });
    entry.markModified("selfies");
    await entry.save();

    return NextResponse.json({ selfieUrl: blob.url, entry });
  } catch (err) {
    console.error("Selfie upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}