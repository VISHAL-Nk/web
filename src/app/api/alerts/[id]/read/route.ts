import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";

// PATCH — Mark an alert as read (supports admin or seller)
export const PATCH = withRole(["admin", "seller"], async (
  _req: NextRequest,
  { user, params }
) => {
  await connectDB();
  const alertId = params?.id;

  if (!alertId) {
    return NextResponse.json({ error: "Alert ID required" }, { status: 400 });
  }

  const alert = await Alert.findById(alertId);
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  // Authorization check
  if (user.role === "admin" && alert.recipientRole !== "admin") {
    return NextResponse.json({ error: "Forbidden: Not an admin alert" }, { status: 403 });
  } else if (
    user.role === "seller" &&
    (alert.recipientRole !== "seller" || alert.recipientId?.toString() !== user.userId)
  ) {
    return NextResponse.json({ error: "Forbidden: Alert does not belong to you" }, { status: 403 });
  }

  const updatedAlert = await Alert.findByIdAndUpdate(
    alertId,
    { isRead: true },
    { new: true }
  ).lean();

  return NextResponse.json({ success: true, alert: updatedAlert });
});
