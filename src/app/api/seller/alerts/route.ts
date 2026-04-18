import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";

// GET — Seller-only alerts endpoint (phase-specific alias)
export const GET = withRole(["seller"], async (req: NextRequest, { user }) => {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const query: Record<string, unknown> = {
    recipientId: user.userId,
    recipientRole: "seller",
  };

  if (unreadOnly) {
    query.isRead = false;
  }

  const alerts = await Alert.find(query)
    .populate("relatedProductId", "name category")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = await Alert.countDocuments({
    recipientId: user.userId,
    recipientRole: "seller",
    isRead: false,
  });

  return NextResponse.json({ alerts, unreadCount });
});
