import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";
import mongoose from "mongoose";
import { withRole } from "@/lib/auth";

export const GET = withRole(["seller"], async (
  _req: NextRequest,
  { user, params }
) => {
  await connectDB();
  const productId = params?.id;

  if (!productId) {
    return NextResponse.json({ error: "Product ID required" }, { status: 400 });
  }

  // 1. Verify product ownership
  const product = await Product.findOne({ _id: productId, sellerId: user.userId })
    .select("name category rating reviewCount")
    .lean();

  if (!product) {
    return NextResponse.json({ error: "Product not found or unauthorized" }, { status: 404 });
  }

  // 2. Fetch Rating Distribution
  const ratingAggregation = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), moderationStatus: { $in: ["approved", "auto_approved"] } } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => {
    const found = ratingAggregation.find(r => r._id === star);
    return { name: `${star} Stars`, value: found ? found.count : 0 };
  });

  // 3. Fetch Overall Sentiment Distribution
  const sentimentAggregation = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), moderationStatus: { $in: ["approved", "auto_approved"] }, overallSentiment: { $ne: "" } } },
    { $group: { _id: "$overallSentiment", count: { $sum: 1 } } }
  ]);

  const sentimentData = [
    { name: "Positive", value: sentimentAggregation.find(s => s._id === "positive")?.count || 0 },
    { name: "Neutral", value: sentimentAggregation.find(s => s._id === "neutral")?.count || 0 },
    { name: "Negative", value: sentimentAggregation.find(s => s._id === "negative")?.count || 0 },
  ];

  // 4. Determine overall volume over time (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyVolume = await Review.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), createdAt: { $gte: thirtyDaysAgo } } },
    { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      count: { $sum: 1 }
    } },
    { $sort: { _id: 1 } }
  ]);

  const volumeTimeline = dailyVolume.map(v => ({ date: v._id, reviews: v.count }));

  // 5. Fetch Trend Snapshot (from Trends collection we made in python)
  // Assuming the Mongoose connection accesses the same DB
  const trendSnapshot = await mongoose.connection.db.collection('trends')
    .find({ productId: new mongoose.Types.ObjectId(productId) })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  const recentTrend = trendSnapshot.length > 0 ? trendSnapshot[0] : null;

  // 6. Fetch Recent Reviews
  const recentReviews = await Review.find({ productId, moderationStatus: { $in: ["approved", "auto_approved"] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("customerId", "name")
    .lean();

  return NextResponse.json({
    product,
    ratingDistribution,
    sentimentData,
    volumeTimeline,
    recentTrend,
    recentReviews,
  });
});
