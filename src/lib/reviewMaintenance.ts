import Review from "@/lib/models/Review";

export interface ReviewMaintenanceResult {
  autoApprovedCount: number;
  publishedAutoResponses: number;
  cancelledScheduledResponses: number;
}

export async function runReviewMaintenance(now = new Date()): Promise<ReviewMaintenanceResult> {
  const [autoApproveResult, publishAutoResponseResult, cancelInvalidScheduledResponses] =
    await Promise.all([
      Review.updateMany(
        {
          moderationStatus: "pending",
          autoApproveAt: { $lte: now },
        },
        {
          $set: {
            moderationStatus: "auto_approved",
            isFlagged: false,
            moderatedAt: now,
            moderationNote: "Auto-approved by timeout policy",
          },
          $unset: {
            autoApproveAt: "",
          },
        }
      ),
      Review.updateMany(
        {
          autoResponse: { $ne: "" },
          autoResponseAt: { $lte: now },
          moderationStatus: { $in: ["approved", "auto_approved"] },
          isFlagged: false,
          $or: [{ autoResponseSentAt: { $exists: false } }, { autoResponseSentAt: null }],
        },
        {
          $set: {
            autoResponseSentAt: now,
          },
        }
      ),
      Review.updateMany(
        {
          autoResponse: { $ne: "" },
          autoResponseAt: { $gt: now },
          moderationStatus: { $nin: ["approved", "auto_approved"] },
        },
        {
          $set: {
            autoResponse: "",
          },
          $unset: {
            autoResponseAt: "",
            autoResponseSentAt: "",
          },
        }
      ),
    ]);

  return {
    autoApprovedCount: autoApproveResult.modifiedCount,
    publishedAutoResponses: publishAutoResponseResult.modifiedCount,
    cancelledScheduledResponses: cancelInvalidScheduledResponses.modifiedCount,
  };
}
