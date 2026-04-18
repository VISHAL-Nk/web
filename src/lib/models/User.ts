import mongoose, { Schema, Document, Model } from "mongoose";

// ── Interface ────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: "customer" | "seller" | "admin";
  createdAt: Date;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "seller", "admin"],
      default: "customer",
    },
  },
  { timestamps: true }
);

// ── Model ────────────────────────────────────────────────────────────────────

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
