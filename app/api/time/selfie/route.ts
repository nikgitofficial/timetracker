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
    // ── FIX: the client now sends the entry _id from the punch response,
    //    so we can look it up directly instead of searching by email/name/date.
    //    This eliminates the race condition where a brand-new check-in entry
    //    hasn't fully committed to MongoDB yet when the selfie upload arrives. ──
    const entryId = (formData.get("entryId") as string | null)?.trim() || null;

    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
    if (!email || !employeeName) return NextResponse.json({ error: "Email and name required" }, { status: 400 });

    // Upload to Vercel Blob
    const filename = `selfies/${email}-${action}-${Date.now()}.jpg`;
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    let entry = null;

    if (entryId) {
      // ── FAST PATH: direct _id lookup — no race condition possible ──
      // The punch API already created/updated this exact document, and its
      // _id was stored in the client's entryIdRef before the modal opened.
      entry = await TimeEntry.findById(entryId);
    }

    if (!entry) {
      // ── FALLBACK: search by email/name for older clients or missing entryId ──
      // Retry up to 3 times with 500ms delay in case DB write is still in flight.
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (let attempt = 0; attempt < 3; attempt++) {
        entry = await TimeEntry.findOne({
          email,
          employeeName,
          checkIn: { $gte: oneDayAgo },
        }).sort({ checkIn: -1 });

        if (entry) break;

        // Wait 500ms before retrying
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!entry) {
      return NextResponse.json({ error: "No time entry found" }, { status: 404 });
    }

    // Save selfie URL to entry
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