import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";

/**
 * Auto-Approve Cron Job
 *
 * GET /api/admin/auto-approve
 *
 * Finds reviews that are:
 *   - isFlagged: true
 *   - moderationStatus: "pending"
 *   - autoApproveAt <= now
 *
 * And auto-approves them (sets moderationStatus = "auto_approved", isFlagged = false).
 *
 * This endpoint should be hit every 5 minutes by an external cron service
 * (e.g., cron-job.org, Vercel cron, GitHub Actions, or a local scheduler).
 *
 * Security: In production, protect with a secret header.
 */
export async function GET(req: Request) {
  await connectDB();

  // Optional: protect with a cron secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET || "echosight-cron-dev";
  if (cronSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const result = await Review.updateMany(
    {
      isFlagged: true,
      moderationStatus: "pending",
      autoApproveAt: { $lte: now },
    },
    {
      $set: {
        moderationStatus: "auto_approved",
        isFlagged: false,
      },
    }
  );

  return NextResponse.json({
    success: true,
    autoApprovedCount: result.modifiedCount,
    checkedAt: now.toISOString(),
  });
}
