import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  photo: { type: String, default: "" },
  refreshToken: { type: String },
  
});

export default models.User || model("User", UserSchema);
