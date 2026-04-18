import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";
import { runReviewMaintenance } from "@/lib/reviewMaintenance";

// GET — Product detail + approved reviews
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();
  await runReviewMaintenance();

  const product = await Product.findById(id).lean();
  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { searchParams } = new URL(_req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  // Only return non-flagged/approved reviews
  const reviewMatch = {
    productId: product._id,
    $or: [
      { isFlagged: false, moderationStatus: "approved" },
      { moderationStatus: "auto_approved" },
    ],
  };

  // 1. Calculate overall stats without fetching all reviews
  const statsAggr = await Review.aggregate([
    { $match: reviewMatch },
    { $group: {
        _id: "$rating",
        count: { $sum: 1 },
        totalScore: { $sum: "$rating" }
    }}
  ]);

  const ratingDist = [0, 0, 0, 0, 0];
  let totalReviews = 0;
  let totalScore = 0;

  statsAggr.forEach(stat => {
    if (stat._id >= 1 && stat._id <= 5) {
      ratingDist[stat._id - 1] = stat.count;
      totalReviews += stat.count;
      totalScore += stat.totalScore;
    }
  });

  const avgRating = totalReviews > 0 ? Math.round((totalScore / totalReviews) * 10) / 10 : 0;

  // 2. Fetch Paginated Reviews
  const reviews = await Review.find(reviewMatch)
    .populate("customerId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return NextResponse.json({
    product: {
      ...product,
      reviewCount: totalReviews,
      avgRating,
      ratingDistribution: ratingDist,
    },
    pagination: {
      page,
      limit,
      totalReviews,
      totalPages: Math.ceil(totalReviews / limit)
    },
    reviews: reviews.map((r) => ({
      _id: r._id,
      customerName: (r.customerId as { name?: string })?.name || "Anonymous",
      rating: r.rating,
      text: r.text,
      imageUrl: r.imageUrl,
      tags: r.tags,
      autoResponse: r.autoResponse,
      autoResponseAt: r.autoResponseAt,
      overallSentiment: r.overallSentiment,
      createdAt: r.createdAt,
    })),
  });
}
