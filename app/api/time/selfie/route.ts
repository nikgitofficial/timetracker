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
    const action = formData.get("action") as string;
    // ✅ FIX 1: Accept entryId directly from frontend for exact match
    const entryId = formData.get("entryId") as string | null;

    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
    if (!email || !employeeName) return NextResponse.json({ error: "Email and name required" }, { status: 400 });

    // ✅ FIX 2: Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    // Upload to Vercel Blob
    const filename = `selfies/${email}-${action}-${Date.now()}.jpg`;
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

<<<<<<< HEAD
    // Find the active/most recent TimeEntry for this employee today
    // Retry up to 3 times with 500ms delay — handles race where punch
    // DB write hasn't committed yet when selfie upload arrives
    let entry = null;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (let attempt = 0; attempt < 3; attempt++) {
=======
    // ✅ FIX 3: Try entryId first (exact match), fallback to query
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let entry = null;

    if (entryId) {
      // Exact match — most reliable
      entry = await TimeEntry.findById(entryId);
    }

    if (!entry) {
      // ✅ FIX 4: Broader fallback — removed status filter that was too strict
>>>>>>> c0060f6 (fixing selfie route bugs issue)
      entry = await TimeEntry.findOne({
        email,
        employeeName,
        checkIn: { $gte: oneDayAgo },
      }).sort({ checkIn: -1 });
<<<<<<< HEAD

      if (entry) break;

      // Wait 500ms before retrying — punch may still be writing to DB
      await new Promise(r => setTimeout(r, 500));
=======
>>>>>>> c0060f6 (fixing selfie route bugs issue)
    }

    if (!entry) {
      return NextResponse.json({ error: "No time entry found" }, { status: 404 });
    }

    if (!entry.selfies) entry.selfies = [];

    // ✅ FIX 5: Prevent duplicate selfies for same action within 30 seconds
    const alreadyExists = entry.selfies.some(
      (s: { action: string; takenAt: Date }) =>
        s.action === action &&
        Date.now() - new Date(s.takenAt).getTime() < 30000
    );

    if (!alreadyExists) {
      entry.selfies.push({
        action,
        url: blob.url,
        takenAt: new Date(),
      });
      entry.markModified("selfies");
      await entry.save();
    }

    return NextResponse.json({ selfieUrl: blob.url, entry });
  } catch (err) {
    console.error("Selfie upload error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}