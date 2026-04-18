import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";
import { withRole } from "@/lib/auth";

// POST — Bulk apply moderation action to multiple reviews
export const POST = withRole(["admin"], async (req: NextRequest, { user }) => {
  await connectDB();

  const body = await req.json();
  const { reviewIds, action, note } = body;

  if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
    return NextResponse.json({ error: "reviewIds array is required" }, { status: 400 });
  }

  if (!["approve", "reject", "delete", "override_approve", "override_reject"].includes(action)) {
    return NextResponse.json(
      { error: "Action must be approve, reject, delete, override_approve, or override_reject" },
      { status: 400 }
    );
  }

  const normalizedAction =
    action === "override_approve"
      ? "approve"
      : action === "override_reject"
        ? "reject"
        : action;

  // Handle mass delete
  if (normalizedAction === "delete") {
    const result = await Review.deleteMany({ _id: { $in: reviewIds } });
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} reviews`,
      modifiedCount: result.deletedCount,
    });
  }

  // Handle mass approve/reject
  const updateData: Record<string, unknown> = {
    moderatedBy: user.userId,
    moderatedAt: new Date(),
    moderationNote: note || "Bulk action applied",
  };

  if (normalizedAction === "approve") {
    updateData.moderationStatus = "approved";
    updateData.isFlagged = false;
  } else if (normalizedAction === "reject") {
    updateData.moderationStatus = "rejected";
    updateData.autoResponse = "";
    updateData.autoResponseAt = null;
    updateData.autoResponseSentAt = null;
  }

  const result = await Review.updateMany(
    { _id: { $in: reviewIds } },
    { $set: updateData }
  );

  return NextResponse.json({
    success: true,
    message: `Successfully ${normalizedAction}d ${result.modifiedCount} reviews`,
    modifiedCount: result.modifiedCount,
  });
});
