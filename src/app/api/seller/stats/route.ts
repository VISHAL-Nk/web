import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";

export const GET = withRole(["seller"], async (_req, { user }) => {
  await connectDB();

  const products = await Product.find({ sellerId: user.userId, isActive: true }).lean();
  const productIds = products.map((p) => p._id);

  // Overall stats
  const [totalReviews, avgRating, sentimentBreakdown, recentAlerts] = await Promise.all([
    Review.countDocuments({ productId: { $in: productIds } }),
    Review.aggregate([
      { $match: { productId: { $in: productIds }, moderationStatus: { $in: ["approved", "auto_approved"] } } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]),
    Review.aggregate([
      { $match: { productId: { $in: productIds }, moderationStatus: { $in: ["approved", "auto_approved"] } } },
      { $group: { _id: "$overallSentiment", count: { $sum: 1 } } },
    ]),
    Alert.find({ recipientId: user.userId, recipientRole: "seller" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Per-product stats
  const productStats = await Review.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: "$productId",
        totalReviews: { $sum: 1 },
        avgRating: { $avg: "$rating" },
        avgTrust: { $avg: "$trustScore" },
        flaggedCount: { $sum: { $cond: ["$isFlagged", 1, 0] } },
      },
    },
  ]);

  const productStatsMap = new Map(
    productStats.map((s) => [s._id.toString(), s])
  );

  const sentimentMap = Object.fromEntries(
    sentimentBreakdown.map((s) => [s._id || "unknown", s.count])
  );

  return NextResponse.json({
    stats: {
      totalProducts: products.length,
      totalReviews,
      avgRating: avgRating[0]?.avg ? Math.round(avgRating[0].avg * 10) / 10 : 0,
      sentiment: sentimentMap,
    },
    products: products.map((p) => {
      const ps = productStatsMap.get(p._id.toString());
      return {
        _id: p._id,
        name: p.name,
        category: p.category,
        price: p.price,
        imageUrl: p.imageUrl,
        totalReviews: ps?.totalReviews || 0,
        avgRating: ps?.avgRating ? Math.round(ps.avgRating * 10) / 10 : 0,
        avgTrust: ps?.avgTrust ? Math.round(ps.avgTrust * 100) : 0,
        flaggedCount: ps?.flaggedCount || 0,
      };
    }),
    alerts: recentAlerts,
  });
});
