import mongoose, { Schema, Document, Model } from "mongoose";

// ── Interface ────────────────────────────────────────────────────────────────

export interface ITrend extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  feature: string;
  direction: "rising_complaint" | "rising_praise" | "sudden_drop";
  severity: "isolated" | "emerging" | "systemic";
  currentRatio: number;
  previousRatio: number;
  changePct: number;
  windowDescription: string;
  exampleReviews: string[];
  isAlertSent: boolean;
  createdAt: Date;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const TrendSchema = new Schema<ITrend>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    feature: { type: String, required: true },
    direction: {
      type: String,
      enum: ["rising_complaint", "rising_praise", "sudden_drop"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["isolated", "emerging", "systemic"],
      required: true,
    },
    currentRatio: { type: Number, required: true },
    previousRatio: { type: Number, required: true },
    changePct: { type: Number, required: true },
    windowDescription: { type: String, required: true },
    exampleReviews: [{ type: String }],
    isAlertSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Model ────────────────────────────────────────────────────────────────────

const Trend: Model<ITrend> =
  mongoose.models.Trend || mongoose.model<ITrend>("Trend", TrendSchema);

export default Trend;
