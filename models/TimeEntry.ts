import mongoose, { Schema, models, model } from "mongoose";

// Each individual break session
const BreakSessionSchema = new Schema(
  {
    breakIn: { type: Date, required: true },  // when break started
    breakOut: { type: Date, default: null },  // when break ended (null = still on break)
    duration: { type: Number, default: 0 },   // minutes, filled when breakOut is set
  },
  { _id: true }
);

const TimeEntrySchema = new Schema(
  {
    employeeName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true }, // ✅ ties record to employee email
    date: { type: String, required: true }, // "YYYY-MM-DD"
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    breaks: { type: [BreakSessionSchema], default: [] }, // supports multiple break sessions
    totalBreak: { type: Number, default: 0 },  // total minutes across ALL break sessions
    totalWorked: { type: Number, default: 0 }, // (checkOut - checkIn) - totalBreak, in minutes
    status: {
      type: String,
      enum: ["checked-in", "on-break", "returned", "checked-out"],
      default: "checked-in",
    },
  },
  { timestamps: true }
);

export default models.TimeEntry || model("TimeEntry", TimeEntrySchema);