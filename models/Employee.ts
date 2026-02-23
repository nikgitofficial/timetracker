// models/Employee.ts
import mongoose, { Schema, models, model } from "mongoose";

const EmployeeSchema = new Schema(
  {
    ownerEmail: { type: String, required: true, trim: true, lowercase: true },
    employeeName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: {
      type: String,
      enum: ["OM", "TL", "Agent", "Other"],
      default: "Agent",
    },
    campaign: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["active", "on-leave", "absent", "inactive"],
      default: "active",
    },
    birthdate: { type: String, default: "" }, // "YYYY-MM-DD"
    profilePic: { type: String, default: "" }, // URL from Vercel Blob
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// Prevent duplicate employees per owner
EmployeeSchema.index({ ownerEmail: 1, email: 1 }, { unique: true });

export default models.Employee || model("Employee", EmployeeSchema);