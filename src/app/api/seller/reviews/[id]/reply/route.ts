import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";
import { withRole } from "@/lib/auth";

// PATCH — Add or update seller reply on an approved review
export const PATCH = withRole(["seller"], async (req: NextRequest, { user, params }) => {
  await connectDB();

  const reviewId = params?.id;
  if (!reviewId) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
  }

  const body = await req.json();
  if (typeof body?.reply !== "string") {
    return NextResponse.json({ error: "reply must be a string" }, { status: 400 });
  }

  const reply = body.reply.trim();
  if (reply.length > 1000) {
    return NextResponse.json(
      { error: "Reply must be 1000 characters or less" },
      { status: 400 }
    );
  }

  const review = await Review.findById(reviewId).select("productId moderationStatus");
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const ownsProduct = await Product.exists({
    _id: review.productId,
    sellerId: user.userId,
    isActive: true,
  });

  if (!ownsProduct) {
    return NextResponse.json(
      { error: "You cannot reply to reviews on this product" },
      { status: 403 }
    );
  }

  if (!["approved", "auto_approved"].includes(review.moderationStatus)) {
    return NextResponse.json(
      { error: "Replies are allowed only on approved reviews" },
      { status: 409 }
    );
  }

  const updateData = reply
    ? {
        autoResponse: reply,
        autoResponseAt: new Date(),
        autoResponseSentAt: new Date(),
      }
    : {
        autoResponse: "",
        autoResponseAt: null,
        autoResponseSentAt: null,
      };

  const updated = await Review.findByIdAndUpdate(reviewId, updateData, { new: true }).lean();

  return NextResponse.json({
    success: true,
    message: reply ? "Seller reply saved" : "Seller reply removed",
    review: {
      _id: updated?._id,
      autoResponse: updated?.autoResponse || "",
      autoResponseAt: updated?.autoResponseAt || null,
      autoResponseSentAt: updated?.autoResponseSentAt || null,
    },
  });
});
