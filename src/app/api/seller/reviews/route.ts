import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";
import { withRole } from "@/lib/auth";

// GET — List approved reviews for seller products (for manual replies)
export const GET = withRole(["seller"], async (req: NextRequest, { user }) => {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const limitRaw = parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

  const products = await Product.find({ sellerId: user.userId, isActive: true })
    .select("_id name category")
    .sort({ createdAt: -1 })
    .lean();

  if (products.length === 0) {
    return NextResponse.json({ products: [], reviews: [] });
  }

  const ownedProductIds = products.map((p) => p._id);

  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
    }

    const isOwned = ownedProductIds.some((id) => id.toString() === productId);
    if (!isOwned) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
  }

  const reviewQuery: Record<string, unknown> = {
    moderationStatus: { $in: ["approved", "auto_approved"] },
    productId: productId
      ? new mongoose.Types.ObjectId(productId)
      : { $in: ownedProductIds },
  };

  const reviews = await Review.find(reviewQuery)
    .populate("productId", "name category")
    .populate("customerId", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    products: products.map((p) => ({
      _id: p._id,
      name: p.name,
      category: p.category,
    })),
    reviews: reviews.map((r) => ({
      _id: r._id,
      text: r.text,
      rating: r.rating,
      tags: r.tags || [],
      overallSentiment: r.overallSentiment || "",
      autoResponse: r.autoResponse || "",
      autoResponseAt: r.autoResponseAt || null,
      autoResponseSentAt: r.autoResponseSentAt || null,
      createdAt: r.createdAt,
      product: {
        _id: (r.productId as { _id: mongoose.Types.ObjectId })._id,
        name: (r.productId as { name?: string }).name || "Product",
        category: (r.productId as { category?: string }).category || "unknown",
      },
      customerName: (r.customerId as { name?: string })?.name || "Anonymous",
    })),
  });
});
