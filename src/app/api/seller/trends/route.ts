import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";
import Product from "@/lib/models/Product";
import { withRole } from "@/lib/auth";

// GET — Get trend data for a seller's product
export const GET = withRole(["seller"], async (req, { user }) => {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  // Verify product belongs to seller
  const product = await Product.findOne({ _id: productId, sellerId: user.userId });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Get all approved reviews with feature sentiments, grouped by week
  const reviews = await Review.find({
    productId,
    moderationStatus: { $in: ["approved", "auto_approved"] },
  })
    .sort({ createdAt: 1 })
    .select("rating overallSentiment tags featureSentiments createdAt")
    .lean();

  if (reviews.length === 0) {
    return NextResponse.json({
      product: { name: product.name, category: product.category },
      timeline: [],
      tagCloud: [],
      sentimentOverTime: [],
    });
  }

  // ── Sentiment over time (daily buckets) ───────────────────────────────
  const dailyMap = new Map<string, { positive: number; negative: number; neutral: number; total: number; avgRating: number; ratings: number[] }>();

  for (const r of reviews) {
    const day = new Date(r.createdAt).toISOString().split("T")[0];
    if (!dailyMap.has(day)) {
      dailyMap.set(day, { positive: 0, negative: 0, neutral: 0, total: 0, avgRating: 0, ratings: [] });
    }
    const bucket = dailyMap.get(day)!;
    const sent = r.overallSentiment || "neutral";
    if (sent === "positive") bucket.positive++;
    else if (sent === "negative") bucket.negative++;
    else bucket.neutral++;
    bucket.total++;
    bucket.ratings.push(r.rating);
  }

  const sentimentOverTime = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      positive: data.positive,
      negative: data.negative,
      neutral: data.neutral,
      total: data.total,
      avgRating: Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10,
    }));

  // ── Tag cloud ─────────────────────────────────────────────────────────
  const tagCounts = new Map<string, number>();
  for (const r of reviews) {
    for (const tag of r.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const tagCloud = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ── Feature sentiment timeline ────────────────────────────────────────
  const featureMap = new Map<string, { positive: number; negative: number; neutral: number }>();
  for (const r of reviews) {
    for (const fs of r.featureSentiments || []) {
      if (!featureMap.has(fs.attribute)) {
        featureMap.set(fs.attribute, { positive: 0, negative: 0, neutral: 0 });
      }
      const fm = featureMap.get(fs.attribute)!;
      if (fs.sentiment === "positive") fm.positive++;
      else if (fs.sentiment === "negative") fm.negative++;
      else fm.neutral++;
    }
  }

  const featureBreakdown = Array.from(featureMap.entries())
    .map(([feature, counts]) => ({
      feature,
      ...counts,
      total: counts.positive + counts.negative + counts.neutral,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    product: { name: product.name, category: product.category },
    sentimentOverTime,
    tagCloud,
    featureBreakdown,
    totalReviews: reviews.length,
  });
});
