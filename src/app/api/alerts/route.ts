import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";

// GET — Get alerts for admin (or seller based on role)
export const GET = withRole(["admin", "seller"], async (req, { user }) => {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const query: Record<string, unknown> = {};

  if (user.role === "admin") {
    query.recipientRole = "admin";
  } else {
    // Seller sees their own alerts
    query.recipientId = user.userId;
    query.recipientRole = "seller";
  }

  if (unreadOnly) {
    query.isRead = false;
  }

  const alerts = await Alert.find(query)
    .populate("relatedProductId", "name category")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = await Alert.countDocuments({
    ...query,
    isRead: false,
  });

  return NextResponse.json({ alerts, unreadCount });
});
