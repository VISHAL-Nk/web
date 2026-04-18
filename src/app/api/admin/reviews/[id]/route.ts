import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";
import { withRole } from "@/lib/auth";

// PATCH — Moderate a review (approve / reject / override)
export const PATCH = withRole(["admin"], async (
  req: NextRequest,
  { user, params }
) => {
  await connectDB();
  const reviewId = params?.id;
  const body = await req.json();
  const { action, note } = body;

  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  if (!["approve", "reject", "override_approve", "override_reject"].includes(action)) {
    return NextResponse.json(
      { error: "Action must be approve, reject, override_approve, or override_reject" },
      { status: 400 }
    );
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Apply moderation
  const updateData: Record<string, unknown> = {
    moderatedBy: user.userId,
    moderatedAt: new Date(),
    moderationNote: note || "",
  };

  switch (action) {
    case "approve":
    case "override_approve":
      updateData.moderationStatus = "approved";
      updateData.isFlagged = false;
      break;
    case "reject":
    case "override_reject":
      updateData.moderationStatus = "rejected";
      updateData.autoResponse = "";
      updateData.autoResponseAt = null;
      updateData.autoResponseSentAt = null;
      break;
  }

  const updated = await Review.findByIdAndUpdate(reviewId, updateData, { new: true })
    .populate("productId", "name category")
    .populate("customerId", "name email")
    .lean();

  return NextResponse.json({
    success: true,
    review: updated,
    message: `Review ${action.replace("_", " ")}d successfully`,
  });
});

// DELETE - Delete a review completely
export const DELETE = withRole(["admin"], async (
  _req: NextRequest,
  { params }
) => {
  await connectDB();
  const reviewId = params?.id;

  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  
  await Review.findByIdAndDelete(reviewId);

  return NextResponse.json({
    success: true,
    message: "Review deleted completely",
  });
});


// GET — Get a single review with full details (for admin detail view)
export const GET = withRole(["admin"], async (
  _req: NextRequest,
  { params }
) => {
  await connectDB();
  const reviewId = params?.id;

  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  const review = await Review.findById(reviewId)
    .populate("productId", "name category sellerId")
    .populate("customerId", "name email")
    .populate("duplicateOf", "text rating moderationStatus")
    .lean();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const productRef = (review.productId as { _id?: string } | string)?._id || review.productId;
  const customerRef = (review.customerId as { _id?: string } | string)?._id || review.customerId;

  const [similarReviews, accountHistory, productStatsAgg, productSentimentAgg, productRecentReviews] =
    await Promise.all([
      Review.find({ _id: { $in: review.similarReviews || [] } })
        .select("text rating moderationStatus trustScore createdAt")
        .populate("customerId", "name")
        .populate("productId", "name category")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Review.find({ customerId: customerRef, _id: { $ne: review._id } })
        .select("text rating overallSentiment moderationStatus trustScore createdAt")
        .populate("productId", "name category")
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      Review.aggregate([
        { $match: { productId: productRef, moderationStatus: { $in: ["approved", "auto_approved"] } } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            avgRating: { $avg: "$rating" },
            avgTrust: { $avg: "$trustScore" },
          },
        },
      ]),
      Review.aggregate([
        { $match: { productId: productRef, moderationStatus: { $in: ["approved", "auto_approved"] } } },
        { $group: { _id: "$overallSentiment", count: { $sum: 1 } } },
      ]),
      Review.find({ productId: productRef })
        .select("text rating overallSentiment moderationStatus createdAt")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

  const productStats = productStatsAgg[0] || {
    totalReviews: 0,
    avgRating: 0,
    avgTrust: 0,
  };

  const sentimentBreakdown = {
    positive: productSentimentAgg.find((s) => s._id === "positive")?.count || 0,
    neutral: productSentimentAgg.find((s) => s._id === "neutral")?.count || 0,
    negative: productSentimentAgg.find((s) => s._id === "negative")?.count || 0,
  };

  return NextResponse.json({
    review,
    similarReviews,
    accountHistory,
    productContext: {
      totalReviews: productStats.totalReviews,
      avgRating: Math.round((productStats.avgRating || 0) * 10) / 10,
      avgTrust: Math.round((productStats.avgTrust || 0) * 100),
      sentimentBreakdown,
      recentReviews: productRecentReviews,
    },
  });
});
