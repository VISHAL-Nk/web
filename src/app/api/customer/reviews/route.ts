import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/lib/models/Review";
import Product from "@/lib/models/Product";
import Alert from "@/lib/models/Alert";
import { withRole } from "@/lib/auth";
import { runReviewMaintenance } from "@/lib/reviewMaintenance";

const AUTO_RESPONSE_DELAY_MINUTES = Math.max(
  parseInt(process.env.AUTO_RESPONSE_DELAY_MINUTES || "30", 10) || 30,
  0
);

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// POST — Submit a review
export const POST = withRole(["customer"], async (req, { user }) => {
  await connectDB();
  const body = await req.json();
  const { productId: rawProductId, text, rating, imageUrl } = body;
  const productId = typeof rawProductId === "string" ? rawProductId.trim() : "";

  // ── Validation ───────────────────────────────────────────────────────
  if (!productId || !text || !rating) {
    return NextResponse.json(
      { error: "productId, text, and rating are required" },
      { status: 400 }
    );
  }

  if (text.length < 10) {
    return NextResponse.json(
      { error: "Review must be at least 10 characters" },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const normalizedText = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Check product exists
  let product = null;
  try {
    product = await Product.findById(productId);
  } catch {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Check one review per customer per product
  const existing = await Review.findOne({
    productId,
    customerId: user.userId,
  });
  if (existing) {
    return NextResponse.json(
      { error: "You have already reviewed this product" },
      { status: 409 }
    );
  }

  // Fast duplicate guard before AI call: block exact copy-paste submissions.
  // This keeps spam control functional even when the AI engine is unavailable.
  if (normalizedText.length > 0) {
    const existingDuplicate = await Review.findOne({
      productId,
      customerId: { $ne: user.userId },
      moderationStatus: { $ne: "rejected" },
      $or: [
        { cleanedText: normalizedText },
        { text: { $regex: `^${escapeRegExp(text.trim())}$`, $options: "i" } },
      ],
    }).select("_id");

    if (existingDuplicate) {
      return NextResponse.json(
        { error: "Review rejected: Duplicate submission detected." },
        { status: 406 }
      );
    }
  }

  // ── Create review (initially pending) ────────────────────────────────
  const review = await Review.create({
    productId,
    customerId: user.userId,
    text,
    rating: Number(rating),
    imageUrl: imageUrl || undefined,
    moderationStatus: "pending",
    isFlagged: false,
  });

  // ── Call AI Engine for analysis ──────────────────────────────────────
  const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:8000";

  try {
    const aiResponse = await fetch(`${aiEngineUrl}/api/fake-detection/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_id: review._id.toString(),
        text: review.text,
        rating: review.rating,
        image_url: review.imageUrl || null,
        product_id: productId,
        customer_id: user.userId,
      }),
    });

    if (aiResponse.ok) {
      const ai = await aiResponse.json();

      const combinedReasoning =
        ai.combined_reasoning ||
        [ai.bot_reasoning, ai.account_reasoning, ai.trust_reasoning, ai.bomb_reasoning]
          .filter((part: unknown): part is string => typeof part === "string" && part.trim().length > 0)
          .join(" | ") ||
        "AI analysis completed with limited explanation.";

      // Update review with AI results
      const updateData: Record<string, unknown> = {
        cleanedText: ai.cleaned_text,
        detectedLanguage: ai.detected_language,
        overallSentiment: ai.overall_sentiment,
        sentimentConfidence: ai.sentiment_confidence,
        imageClassification: ai.image_classification,
        trustScore: ai.trust_score,
        isSpam: ai.is_spam,
        isDuplicate: ai.is_duplicate,
        isReviewBomb: ai.is_review_bomb,
        bombType: ai.bomb_type,
        reasoning: combinedReasoning,
      };

      if (ai.duplicate_of) updateData.duplicateOf = ai.duplicate_of;
      if (ai.similar_reviews?.length) updateData.similarReviews = ai.similar_reviews;

      if (ai.should_flag) {

        updateData.isFlagged = true;
        updateData.flagReasons = ai.flag_reasons;
        updateData.moderationStatus = "pending";

        // Keep high-risk flags (spam/duplicate/bomb/high-risk trust) in manual review queue.
        const requiresManualReview =
          ai.is_spam ||
          ai.is_duplicate ||
          ai.is_review_bomb ||
          (Array.isArray(ai.flag_reasons) && ai.flag_reasons.includes("high_risk"));

        updateData.autoApproveAt = requiresManualReview
          ? null
          : new Date(Date.now() + 24 * 60 * 60 * 1000);

        // ── Grouped alert creation ────────────────────────────────────
        const alertType = ai.is_review_bomb ? "review_bomb" : "flagged_review";

        // Try to find an existing unread alert for the same product + type
        // to group similar flags together instead of creating N alerts
        const existingAlert = await Alert.findOne({
          recipientRole: "admin",
          type: alertType,
          relatedProductId: productId,
          isRead: false,
        });

        if (existingAlert) {
          // Append this review to the existing alert cluster
          await Alert.findByIdAndUpdate(existingAlert._id, {
            $addToSet: { relatedReviewIds: review._id },
            $set: {
              title: `${alertType === "review_bomb" ? "Review bomb" : "Reviews flagged"}: ${(existingAlert.relatedReviewIds.length + 1)} reviews for "${product.name}"`,
              message: `Latest flag reasons: ${ai.flag_reasons.join(", ")}. Trust score: ${ai.trust_score}. ${ai.combined_reasoning.slice(0, 150)}`,
            },
          });
        } else {
          await Alert.create({
            recipientRole: "admin",
            type: alertType,
            title: `Review flagged: ${ai.flag_reasons.join(", ")}`,
            message: `A review for "${product.name}" has been flagged. Trust score: ${ai.trust_score}. Reason: ${ai.combined_reasoning.slice(0, 200)}`,
            relatedProductId: productId,
            relatedReviewIds: [review._id],
          });
        }

        // Alert seller if review bomb (also grouped)
        if (ai.is_review_bomb) {
          const existingSellerAlert = await Alert.findOne({
            recipientId: product.sellerId,
            recipientRole: "seller",
            type: "review_bomb",
            relatedProductId: productId,
            isRead: false,
          });

          if (existingSellerAlert) {
            await Alert.findByIdAndUpdate(existingSellerAlert._id, {
              $addToSet: { relatedReviewIds: review._id },
              $set: { message: ai.bomb_reasoning },
            });
          } else {
            await Alert.create({
              recipientId: product.sellerId,
              recipientRole: "seller",
              type: "review_bomb",
              title: `Review bomb detected on ${product.name}`,
              message: ai.bomb_reasoning,
              relatedProductId: productId,
              relatedReviewIds: [review._id],
            });
          }
        }
      } else {
        updateData.isFlagged = false;
        updateData.moderationStatus = "approved";
        updateData.autoApproveAt = null;
      }

      await Review.findByIdAndUpdate(review._id, updateData);

      // ── Fire-and-forget: Tag classification ──────────────────────────
      if (!ai.should_flag) {
        fetch(`${aiEngineUrl}/api/tag-classification/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_id: review._id.toString(),
            cleaned_text: ai.cleaned_text,
            category: product.category,
            overall_sentiment: ai.overall_sentiment,
            rating: review.rating,
          }),
        })
          .then(async (tagRes) => {
            if (tagRes.ok) {
              const tagData = await tagRes.json();
              const tagUpdate: Record<string, unknown> = { tags: tagData.tags };
              // Store feature-level sentiments if returned
              if (tagData.feature_sentiments?.length > 0) {
                tagUpdate.featureSentiments = tagData.feature_sentiments.map(
                  (fs: { attribute: string; sentiment: string; confidence: number; evidenceSnippet: string }) => ({
                    attribute: fs.attribute,
                    sentiment: fs.sentiment,
                    confidence: fs.confidence,
                    evidenceSnippet: fs.evidenceSnippet,
                  })
                );
              }
              await Review.findByIdAndUpdate(review._id, tagUpdate);

              // Auto-response for valid low-score reviews
              if (review.rating <= 2 && ai.trust_score > 0.70 && tagData.tags.length > 0) {
                const autoRes = await fetch(
                  `${aiEngineUrl}/api/tag-classification/auto-respond`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      review_id: review._id.toString(),
                      cleaned_text: ai.cleaned_text,
                      product_name: product.name,
                      category: product.category,
                      rating: review.rating,
                      tags: tagData.tags,
                      overall_sentiment: ai.overall_sentiment,
                    }),
                  }
                );
                if (autoRes.ok) {
                  const autoData = await autoRes.json();
                  const scheduledAt = new Date(
                    Date.now() + AUTO_RESPONSE_DELAY_MINUTES * 60 * 1000
                  );

                  await Review.findByIdAndUpdate(review._id, {
                    autoResponse: autoData.auto_response,
                    autoResponseAt: scheduledAt,
                    autoResponseSentAt:
                      AUTO_RESPONSE_DELAY_MINUTES === 0 ? new Date() : null,
                  });
                }
              }
            }
          })
          .catch((err) => console.error("Tag classification error:", err));
      }

      // Return appropriate message
      const updatedReview = await Review.findById(review._id).lean();
      return NextResponse.json(
        {
          success: true,
          review: updatedReview,
          message: ai.should_flag
            ? "Your review has been submitted and is under review."
            : "Your review has been published!",
          flagged: ai.should_flag,
        },
        { status: 201 }
      );
    } else {
      // AI engine returned an error — flag for manual review
      await Review.findByIdAndUpdate(review._id, {
        isFlagged: true,
        flagReasons: ["ai_unavailable"],
        reasoning: "AI service returned an error while analyzing this review; routed to moderation for manual review.",
        moderationStatus: "pending",
        autoApproveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return NextResponse.json(
        {
          success: true,
          review,
          message: "Your review has been submitted and is under review.",
          flagged: true,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("AI engine connection error:", error);

    // Graceful degradation — accept review, flag for manual review
    await Review.findByIdAndUpdate(review._id, {
      isFlagged: true,
      flagReasons: ["ai_unavailable"],
      reasoning: "AI service was unreachable while analyzing this review; routed to moderation for manual review.",
      moderationStatus: "pending",
      autoApproveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return NextResponse.json(
      {
        success: true,
        review,
        message: "Your review has been submitted and is under review.",
        flagged: true,
      },
      { status: 201 }
    );
  }
});

// GET — Get all reviews by logged-in customer
export const GET = withRole(["customer"], async (_req, { user }) => {
  await connectDB();
  await runReviewMaintenance();

  const reviews = await Review.find({ customerId: user.userId })
    .populate("productId", "name imageUrl")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      _id: r._id,
      product: r.productId,
      rating: r.rating,
      text: r.text,
      overallSentiment: r.overallSentiment,
      trustScore: r.trustScore,
      tags: r.tags,
      isFlagged: r.isFlagged,
      moderationStatus: r.moderationStatus,
      autoResponse: r.autoResponse,
      autoResponseAt: r.autoResponseAt,
      autoResponseSentAt: r.autoResponseSentAt,
      createdAt: r.createdAt,
    })),
  });
});
