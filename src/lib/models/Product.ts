import mongoose, { Schema, Document, Model } from "mongoose";

// ── Interface ────────────────────────────────────────────────────────────────

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: "electronics" | "food" | "clothing";
  price: number;
  imageUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const ProductSchema = new Schema<IProduct>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["electronics", "food", "clothing"],
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Model ────────────────────────────────────────────────────────────────────

const Product: Model<IProduct> =
  mongoose.models.Product ||
  mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
