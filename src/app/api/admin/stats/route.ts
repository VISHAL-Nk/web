import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";
import User from "@/lib/models/User";
import Product from "@/lib/models/Product";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";

// GET — Admin dashboard stats
export const GET = withRole(["admin"], async () => {
  await connectDB();

  const [
    pendingCount,
    flaggedCount,
    approvedCount,
    rejectedCount,
    totalReviews,
    totalProducts,
    totalCustomers,
    recentAlerts,
  ] = await Promise.all([
    Review.countDocuments({ moderationStatus: "pending" }),
    Review.countDocuments({ isFlagged: true }),
    Review.countDocuments({ moderationStatus: { $in: ["approved", "auto_approved"] } }),
    Review.countDocuments({ moderationStatus: "rejected" }),
    Review.countDocuments(),
    Product.countDocuments({ isActive: true }),
    User.countDocuments({ role: "customer" }),
    Alert.find({ recipientRole: "admin", isRead: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Recent flagged reviews
  const recentFlagged = await Review.find({ isFlagged: true })
    .populate("productId", "name")
    .populate("customerId", "name")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return NextResponse.json({
    stats: {
      pendingCount,
      flaggedCount,
      approvedCount,
      rejectedCount,
      totalReviews,
      totalProducts,
      totalCustomers,
    },
    recentAlerts,
    recentFlagged: recentFlagged.map((r) => ({
      _id: r._id,
      text: r.text.slice(0, 100),
      rating: r.rating,
      trustScore: r.trustScore,
      flagReasons: r.flagReasons,
      productName: (r.productId as { name?: string })?.name || "Unknown",
      customerName: (r.customerId as { name?: string })?.name || "Unknown",
      createdAt: r.createdAt,
    })),
  });
});
