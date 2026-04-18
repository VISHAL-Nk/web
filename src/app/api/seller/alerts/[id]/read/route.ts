import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";

// PATCH — Seller marks their own alert as read (phase-specific alias)
export const PATCH = withRole(["seller"], async (_req: NextRequest, { user, params }) => {
  await connectDB();

  const alertId = params?.id;
  if (!alertId) {
    return NextResponse.json({ error: "Alert ID required" }, { status: 400 });
  }

  const alert = await Alert.findById(alertId);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  if (alert.recipientRole !== "seller" || alert.recipientId?.toString() !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updatedAlert = await Alert.findByIdAndUpdate(
    alertId,
    { isRead: true },
    { new: true }
  ).lean();

  return NextResponse.json({ success: true, alert: updatedAlert });
});
