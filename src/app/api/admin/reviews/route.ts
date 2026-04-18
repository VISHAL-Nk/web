import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";
import { withRole } from "@/lib/auth";
import { runReviewMaintenance } from "@/lib/reviewMaintenance";

// GET — Get all reviews pending moderation (flagged)
export const GET = withRole(["admin"], async (req) => {
  await connectDB();
  await runReviewMaintenance();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const productId = searchParams.get("productId") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, unknown> = {};
  if (status === "pending") {
    query.moderationStatus = "pending";
  } else if (status === "approved") {
    query.moderationStatus = { $in: ["approved", "auto_approved"] };
  } else if (status === "rejected") {
    query.moderationStatus = "rejected";
  } else if (status === "flagged") {
    query.isFlagged = true;
  }

  if (productId) {
    query.productId = productId;
  }

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("productId", "name category")
      .populate("customerId", "name email")
      .sort({ isReviewBomb: -1, isSpam: -1, trustScore: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ]);

  // Get counts for sidebar
  const [pendingCount, flaggedCount, approvedCount, rejectedCount] = await Promise.all([
    Review.countDocuments({ moderationStatus: "pending" }),
    Review.countDocuments({ isFlagged: true }),
    Review.countDocuments({ moderationStatus: { $in: ["approved", "auto_approved"] } }),
    Review.countDocuments({ moderationStatus: "rejected" }),
  ]);

  return NextResponse.json({
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    counts: {
      pending: pendingCount,
      flagged: flaggedCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  });
});
