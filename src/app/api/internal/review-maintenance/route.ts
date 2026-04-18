import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { runReviewMaintenance } from "@/lib/reviewMaintenance";

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    // Local/dev convenience: allow triggering without a secret when not configured.
    return true;
  }

  const providedSecret = req.headers.get("x-cron-secret");
  return providedSecret === configuredSecret;
}

// POST — Run scheduled maintenance jobs (auto-approve + delayed auto-response publish)
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  await connectDB();
  const result = await runReviewMaintenance();

  return NextResponse.json({
    success: true,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
