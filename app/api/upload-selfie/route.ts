// app/api/time/upload-selfie/route.ts
// Receives a raw JPEG blob from the client, uploads to Vercel Blob, returns the public URL.
// The BLOB_READ_WRITE_TOKEN env var is used automatically by @vercel/blob.

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json({ error: "filename query param required" }, { status: 400 });
    }

    const body = req.body;
    if (!body) {
      return NextResponse.json({ error: "No body" }, { status: 400 });
    }

    const blob = await put(filename, body, {
      access: "public",
      contentType: "image/jpeg",
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Selfie upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}