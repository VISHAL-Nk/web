import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const intervalMs = 5 * 60 * 1000;

let connectDB: typeof import("@/lib/db").connectDB;
let runReviewMaintenance: typeof import("@/lib/reviewMaintenance").runReviewMaintenance;

async function ensureDepsLoaded() {
  if (!connectDB || !runReviewMaintenance) {
    ({ connectDB } = await import("@/lib/db"));
    ({ runReviewMaintenance } = await import("@/lib/reviewMaintenance"));
  }
}

async function runOnce() {
  await ensureDepsLoaded();
  await connectDB();
  const result = await runReviewMaintenance();
  const timestamp = new Date().toISOString();

  if (
    result.autoApprovedCount > 0 ||
    result.publishedAutoResponses > 0 ||
    result.cancelledScheduledResponses > 0
  ) {
    console.log(`[review-maintenance] ${timestamp}`, result);
  }
}

async function start() {
  await runOnce();
  setInterval(() => {
    runOnce().catch((error) => {
      console.error("[review-maintenance] job failed", error);
    });
  }, intervalMs);

  console.log("[review-maintenance] worker started (every 5 minutes)");
}

start().catch((error) => {
  console.error("[review-maintenance] failed to start", error);
  process.exit(1);
});
