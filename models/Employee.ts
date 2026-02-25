// models/Employee.ts
import { Schema, models, model } from "mongoose";

const ShiftSchema = new Schema(
  {
    label:         { type: String, default: "Regular" },
    startTime:     { type: String, default: "09:00" },
    endTime:       { type: String, default: "18:00" },
    graceMinutes:  { type: Number, default: 15 },
    restDays: {
      type: [String],
      default: ["Saturday", "Sunday"],
      enum: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    },
    effectiveFrom: { type: String, default: "" },
  },
  { _id: false }
);

const EmployeeSchema = new Schema(
  {
    ownerEmail:   { type: String, required: true, trim: true, lowercase: true },
    employeeName: { type: String, required: true, trim: true },
    email:        { type: String, required: true, trim: true, lowercase: true },
    role: {
      type: String,
      enum: ["OM", "TL", "Agent", "Other"],
      default: "Agent",
    },
    campaign:   { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["active", "on-leave", "absent", "inactive"],
      default: "active",
    },
    birthdate:  { type: String, default: "" },
    profilePic: { type: String, default: "" },
    notes:      { type: String, default: "" },
    shift:      { type: ShiftSchema, default: undefined },
    // ✅ Custom password hash — null means not yet registered (falls back to email auth)
    passwordHash: { type: String, default: null },
  },
  { timestamps: true }
);

EmployeeSchema.index({ ownerEmail: 1, email: 1, employeeName: 1 }, { unique: true });

if (models.Employee) delete (models as Record<string, unknown>).Employee;

export default model("Employee", EmployeeSchema);