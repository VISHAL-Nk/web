import mongoose, { Schema, Document, Model } from "mongoose";

// ── Interface ────────────────────────────────────────────────────────────────

export interface IAlert extends Document {
  _id: mongoose.Types.ObjectId;
  recipientId?: mongoose.Types.ObjectId;
  recipientRole: "seller" | "admin";
  type:
    | "flagged_review"
    | "review_bomb"
    | "trend_alert"
    | "account_manipulation";
  title: string;
  message: string;
  relatedProductId?: mongoose.Types.ObjectId;
  relatedReviewIds: mongoose.Types.ObjectId[];
  isRead: boolean;
  createdAt: Date;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const AlertSchema = new Schema<IAlert>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    recipientRole: {
      type: String,
      enum: ["seller", "admin"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "flagged_review",
        "review_bomb",
        "trend_alert",
        "account_manipulation",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedProductId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    relatedReviewIds: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

AlertSchema.index({ recipientRole: 1, isRead: 1, createdAt: -1 });
AlertSchema.index({ recipientId: 1, isRead: 1 });

// ── Model ────────────────────────────────────────────────────────────────────

const Alert: Model<IAlert> =
  mongoose.models.Alert || mongoose.model<IAlert>("Alert", AlertSchema);

export default Alert;
