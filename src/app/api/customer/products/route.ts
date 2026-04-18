import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";

// GET — List all active products for customers (public-ish, but auth required)
export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  // Build query
  const query: Record<string, unknown> = { isActive: true };
  if (category && category !== "all") {
    query.category = category;
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const products = await Product.find(query).sort({ createdAt: -1 }).lean();

  // Get review stats
  const productIds = products.map((p) => p._id);
  const stats = await Review.aggregate([
    {
      $match: {
        productId: { $in: productIds },
        $or: [
          { isFlagged: false, moderationStatus: "approved" },
          { moderationStatus: "auto_approved" },
        ],
      },
    },
    {
      $group: {
        _id: "$productId",
        count: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  const statsMap = new Map(
    stats.map((s) => [s._id.toString(), { count: s.count, avgRating: s.avgRating }])
  );

  const result = products.map((p) => {
    const s = statsMap.get(p._id.toString()) || { count: 0, avgRating: 0 };
    return {
      ...p,
      reviewCount: s.count,
      avgRating: Math.round(s.avgRating * 10) / 10,
    };
  });

  return NextResponse.json({ products: result });
}
