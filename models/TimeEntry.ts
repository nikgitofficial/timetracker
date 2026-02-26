// models/TimeEntry.ts
import mongoose, { Schema, models, model } from "mongoose";

const BreakSessionSchema = new Schema(
  {
    breakIn: { type: Date, required: true },
    breakOut: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // minutes
  },
  { _id: true }
);

const SelfieSchema = new Schema(
  {
    action: { type: String, required: true }, // "check-in", "break-in", etc.
    url: { type: String, required: true },
    takenAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TimeEntrySchema = new Schema(
  {
    employeeName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },

    // 🍽️ Regular breaks (lunch, etc.)
    breaks: { type: [BreakSessionSchema], default: [] },
    totalBreak: { type: Number, default: 0 }, // minutes

    // 🚽 Bio breaks (CR, water, quick personal)
    bioBreaks: { type: [BreakSessionSchema], default: [] },
    totalBioBreak: { type: Number, default: 0 }, // minutes

    totalWorked: { type: Number, default: 0 }, // (checkOut - checkIn) - totalBreak - totalBioBreak
    status: {
      type: String,
      enum: ["checked-in", "on-break", "on-bio-break", "returned", "checked-out"],
      default: "checked-in",
    },

    // 📸 Selfies per action
    selfies: { type: [SelfieSchema], default: [] },

    // 📹 Daily.co video room for live camera monitoring
    dailyRoomName: { type: String, default: null },
  },
  { timestamps: true }
);

export default models.TimeEntry || model("TimeEntry", TimeEntrySchema);