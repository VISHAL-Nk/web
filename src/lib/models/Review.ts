import mongoose, { Schema, Document, Model } from "mongoose";

// ── Sub-document: Feature-level sentiment ────────────────────────────────────

export interface IFeatureSentiment {
  attribute: string;
  sentiment: "positive" | "negative" | "neutral" | "ambiguous";
  confidence: number;
  evidenceSnippet: string;
}

const FeatureSentimentSchema = new Schema<IFeatureSentiment>(
  {
    attribute: { type: String, required: true },
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral", "ambiguous"],
      required: true,
    },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    evidenceSnippet: { type: String, default: "" },
  },
  { _id: false }
);

// ── Main Review interface ────────────────────────────────────────────────────

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;

  // Raw & processed text
  text: string;
  cleanedText: string;
  rating: number;
  imageUrl?: string;
  detectedLanguage: string;

  // AI analysis results
  overallSentiment: string;
  sentimentConfidence: number;
  imageClassification: string;
  trustScore: number;

  // Flags
  isFlagged: boolean;
  flagReasons: string[];
  isSpam: boolean;
  isDuplicate: boolean;
  duplicateOf?: mongoose.Types.ObjectId;
  similarReviews: mongoose.Types.ObjectId[];
  isReviewBomb: boolean;
  bombType: string;

  // Moderation
  moderationStatus: "pending" | "approved" | "rejected" | "auto_approved";
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  moderationNote: string;
  autoApproveAt?: Date;

  // Tags & auto-response
  tags: string[];
  autoResponse: string;
  autoResponseAt?: Date;
  autoResponseSentAt?: Date;

  // Feature sentiments
  featureSentiments: IFeatureSentiment[];

  // Reasoning
  reasoning: string;

  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Raw & processed text
    text: { type: String, required: true },
    cleanedText: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    imageUrl: { type: String },
    detectedLanguage: { type: String, default: "en" },

    // AI analysis results
    overallSentiment: { type: String, default: "" },
    sentimentConfidence: { type: Number, default: 0, min: 0, max: 1 },
    imageClassification: { type: String, default: "no_image" },
    trustScore: { type: Number, default: 1, min: 0, max: 1 },

    // Flags
    isFlagged: { type: Boolean, default: false },
    flagReasons: [{ type: String }],
    isSpam: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "Review" },
    similarReviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    isReviewBomb: { type: Boolean, default: false },
    bombType: { type: String, default: "none" },

    // Moderation
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "auto_approved"],
      default: "pending",
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: { type: Date },
    moderationNote: { type: String, default: "" },
    autoApproveAt: { type: Date },

    // Tags & auto-response
    tags: [{ type: String }],
    autoResponse: { type: String, default: "" },
    autoResponseAt: { type: Date },
    autoResponseSentAt: { type: Date },

    // Feature sentiments (embedded sub-documents)
    featureSentiments: [FeatureSentimentSchema],

    // Reasoning
    reasoning: { type: String, default: "" },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────

ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ customerId: 1 });
ReviewSchema.index({ isFlagged: 1, moderationStatus: 1 });
ReviewSchema.index({ productId: 1, isFlagged: 1 });
ReviewSchema.index({ tags: 1 });
// Compound index to enforce one review per customer per product
ReviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });

// ── Model ────────────────────────────────────────────────────────────────────

const Review: Model<IReview> =
  mongoose.models.Review ||
  mongoose.model<IReview>("Review", ReviewSchema);

export default Review;
