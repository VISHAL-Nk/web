"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface ReviewItem {
  _id: string;
  text: string;
  cleanedText: string;
  rating: number;
  trustScore: number;
  overallSentiment: string;
  sentimentConfidence: number;
  isFlagged: boolean;
  flagReasons: string[];
  isSpam: boolean;
  isDuplicate: boolean;
  isReviewBomb: boolean;
  bombType: string;
  moderationStatus: string;
  moderationNote: string;
  tags: string[];
  reasoning: string;
  imageUrl?: string;
  imageClassification?: string;
  createdAt: string;
  autoApproveAt?: string;
  productId: { _id: string; name: string; category: string };
  customerId: { _id: string; name: string; email: string };
}

interface ReviewGroup {
  id: string; // A unique identifier for the group
  label: string; // The type of cluster
  productId: string;
  productName: string;
  reviews: ReviewItem[];
  priority: number;
}

interface SimilarReview {
  _id: string;
  text: string;
  rating: number;
  moderationStatus: string;
  trustScore: number;
  createdAt: string;
  customerId?: { name?: string };
  productId?: { name?: string; category?: string };
}

interface AccountHistoryItem {
  _id: string;
  text: string;
  rating: number;
  overallSentiment: string;
  moderationStatus: string;
  createdAt: string;
  productId?: { name?: string; category?: string };
}

interface ProductContext {
  totalReviews: number;
  avgRating: number;
  avgTrust: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recentReviews: Array<{
    _id: string;
    text: string;
    rating: number;
    overallSentiment: string;
    moderationStatus: string;
    createdAt: string;
    customerId?: { name?: string };
  }>;
}

interface ReviewDetail {
  similarReviews: SimilarReview[];
  accountHistory: AccountHistoryItem[];
  productContext: ProductContext;
}

const STATUS_TABS = [
  { key: "pending", label: "Pending", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { key: "flagged", label: "Flagged", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { key: "approved", label: "Approved", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { key: "rejected", label: "Rejected", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
];

const SENTIMENT_BADGE: Record<string, string> = {
  positive: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  negative: "text-red-400 bg-red-500/10 border-red-500/20",
  neutral: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export default function ModerationPage() {
  const searchParams = useSearchParams();
  const productFilter = searchParams.get("productId") || "";
  const [status, setStatus] = useState("pending");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, flagged: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [reviewDetails, setReviewDetails] = useState<Record<string, ReviewDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [acting, setActing] = useState(false);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set());

  const buildAiSummary = useCallback((review: ReviewItem): string => {
    if (review.reasoning && review.reasoning.trim().length > 0) {
      return review.reasoning;
    }

    const parts: string[] = [];

    if (review.overallSentiment) {
      parts.push(`Sentiment detected as ${review.overallSentiment}.`);
    }

    if (typeof review.trustScore === "number") {
      parts.push(`Trust score ${(review.trustScore * 100).toFixed(0)}%.`);
    }

    if (review.imageUrl) {
      if (review.imageClassification) {
        parts.push(`Image analysis: ${review.imageClassification.replace(/_/g, " ")}.`);
      } else {
        parts.push("Image was provided, but image analysis details are unavailable.");
      }
    }

    if (review.isSpam || review.isDuplicate || review.isReviewBomb) {
      const activeFlags = [
        review.isSpam ? "spam" : null,
        review.isDuplicate ? "duplicate" : null,
        review.isReviewBomb ? "review bomb" : null,
      ].filter(Boolean);
      if (activeFlags.length > 0) {
        parts.push(`Detected risk signals: ${activeFlags.join(", ")}.`);
      }
    }

    return parts.length > 0 ? parts.join(" ") : "No AI analysis available";
  }, []);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setSelectedReviewIds(new Set());
    const params = new URLSearchParams({ status, limit: "100" });
    if (productFilter) {
      params.set("productId", productFilter);
    }

    const res = await fetch(`/api/admin/reviews?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setReviews(data.reviews);
      setCounts(data.counts);
    }
    setLoading(false);
  }, [status, productFilter]);

  async function handleModerate(reviewIds: string[], action: string) {
    setActing(true);
    const res = await fetch(`/api/admin/moderation/bulk-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewIds, action, note: actionNote }),
    });

    if (res.ok) {
      toast.success(action === "delete" ? "Reviews deleted completely" : `Successfully marked as ${action.split('_').pop()}`);
      setSelectedReview(null);
      setActionNote("");
      fetchReviews();
    } else {
      toast.error("Failed to apply moderation action");
    }
    setActing(false);
  }

  const fetchReviewDetail = useCallback(async (reviewId: string) => {
    if (reviewDetails[reviewId]) {
      return;
    }

    setDetailLoading(true);
    const res = await fetch(`/api/admin/reviews/${reviewId}`);
    if (res.ok) {
      const data = await res.json();
      setReviewDetails((prev) => ({
        ...prev,
        [reviewId]: {
          similarReviews: data.similarReviews || [],
          accountHistory: data.accountHistory || [],
          productContext: data.productContext || {
            totalReviews: 0,
            avgRating: 0,
            avgTrust: 0,
            sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
            recentReviews: [],
          },
        },
      }));
    }
    setDetailLoading(false);
  }, [reviewDetails]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (selectedReview?._id) {
      fetchReviewDetail(selectedReview._id);
    }
  }, [selectedReview?._id, fetchReviewDetail]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedReviewIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedReviewIds(newSet);
  };

  const selectGroup = (group: ReviewGroup) => {
    const newSet = new Set(selectedReviewIds);
    let allSelected = true;
    for (const r of group.reviews) {
      if (!newSet.has(r._id)) allSelected = false;
    }
    if (allSelected) {
      for (const r of group.reviews) newSet.delete(r._id);
    } else {
      for (const r of group.reviews) newSet.add(r._id);
    }
    setSelectedReviewIds(newSet);
  };

  const trustColor = (score: number) => {
    if (score >= 0.7) return "text-emerald-400";
    if (score >= 0.4) return "text-amber-400";
    return "text-red-400";
  };
  
  const getCountdown = (dateString?: string) => {
    if (!dateString) return null;
    const diff = new Date(dateString).getTime() - new Date().getTime();
    if (diff <= 0) return "Auto-approving soon...";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Auto-approves in ${hours}h ${mins}m`;
  };

  const groupedReviews = useMemo(() => {
    if (status !== "pending" && status !== "flagged") {
      // Don't group approved/rejected naturally
      return [{
        id: "flat",
        label: "Reviews",
        productId: "",
        productName: "",
        reviews,
        priority: 0,
      }];
    }

    const groups= new Map<string, ReviewGroup>();
    const lonelyReviews: ReviewItem[] = [];

    reviews.forEach(r => {
      if (r.isReviewBomb || r.isDuplicate || r.isSpam) {
        const key = `${r.productId._id}-${r.isReviewBomb ? r.bombType : 'bot_cluster'}`;
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            label: r.isReviewBomb ? `Review Bomb (${r.bombType})` : `Spam / Bot Cluster`,
            productId: r.productId._id,
            productName: r.productId.name,
            reviews: [],
            priority: r.isReviewBomb ? 2 : 1
          });
        }
        groups.get(key)!.reviews.push(r);
      } else {
        lonelyReviews.push(r);
      }
    });

    const result = Array.from(groups.values()).sort((a, b) => b.priority - a.priority);
    
    if (lonelyReviews.length > 0) {
      result.push({
        id: "individual",
        label: "Individual Flagged Reviews",
        productId: "",
        productName: "Various Products",
        reviews: lonelyReviews,
        priority: 0
      });
    }

    return result;
  }, [reviews, status]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
         <h1 className="text-3xl font-bold text-white">Moderation Queue</h1>
         {/* Bulk action bar */}
         {selectedReviewIds.size > 0 && (
           <div className="flex items-center gap-3 bg-zinc-800/80 px-4 py-2 rounded-xl backdrop-blur-md">
             <span className="text-sm font-medium text-white">{selectedReviewIds.size} selected</span>
             <button
               disabled={acting}
               onClick={() => handleModerate(Array.from(selectedReviewIds), "approve")}
               className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
             >
               ✅ Approve All
             </button>
             <button
               disabled={acting}
               onClick={() => handleModerate(Array.from(selectedReviewIds), "reject")}
               className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
             >
               ❌ Reject All
             </button>
             <button
               disabled={acting}
               onClick={() => handleModerate(Array.from(selectedReviewIds), "delete")}
               className="px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
             >
               🗑️ Delete All
             </button>
           </div>
         )}
      </div>
      <p className="text-zinc-500 mb-8">
        Human-in-the-loop review moderation — approve, reject, or override AI decisions
      </p>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
              status === tab.key
                ? tab.color
                : "text-zinc-500 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {tab.label}
            <span className="text-xs font-mono opacity-60">
              {(counts as Record<string, number>)[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Review List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">No reviews in this category</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedReviews.map(group => (
            <div key={group.id} className="space-y-4">
              {group.id !== "flat" && (
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={group.reviews.every(r => selectedReviewIds.has(r._id))}
                      onChange={() => selectGroup(group)}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0"
                    />
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {group.label}
                        <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">{group.reviews.length}</span>
                      </h2>
                      {group.productId && <p className="text-sm text-indigo-400">{group.productName}</p>}
                    </div>
                  </div>
                </div>
              )}

              {group.reviews.map((review) => (
                <div
                  key={review._id}
                  className={`bg-zinc-900/50 flex gap-4 border rounded-2xl p-6 transition-all hover:border-zinc-600 ${
                    selectedReview?._id === review._id ? "border-indigo-500/50 ring-1 ring-indigo-500/20" : "border-zinc-800"
                  }`}
                >
                  <div className="pt-2">
                    <input 
                      type="checkbox"
                      checked={selectedReviewIds.has(review._id)}
                      onChange={() => toggleSelect(review._id)}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0"
                    />
                  </div>
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedReview(selectedReview?._id === review._id ? null : review)}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-medium">
                          {review.customerId?.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{review.customerId?.name || "Unknown"}</p>
                          <div className="flex gap-2 items-center">
                            <p className="text-xs text-zinc-600">{review.customerId?.email}</p>
                            {review.autoApproveAt && (status === "pending" || status === "flagged") && (
                              <span className="text-xs text-amber-500 font-mono bg-amber-500/10 px-1.5 rounded">
                                ⏳ {getCountdown(review.autoApproveAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Trust Score */}
                        <span className={`text-sm font-mono font-bold ${trustColor(review.trustScore)}`}>
                          {(review.trustScore * 100).toFixed(0)}%
                        </span>

                        {/* Rating */}
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "text-amber-400" : "text-zinc-700"}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>

                        {/* Sentiment */}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${SENTIMENT_BADGE[review.overallSentiment] || SENTIMENT_BADGE.neutral}`}>
                          {review.overallSentiment || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Product */}
                    {group.id === "individual" || group.id === "flat" ? (
                      <p className="text-xs text-indigo-400 mb-2">
                        {review.productId?.name} • {review.productId?.category}
                      </p>
                    ) : null}

                    {/* Review text */}
                    <p className="text-sm text-zinc-300 mb-3">{review.text}</p>

                    {/* Flags */}
                    {review.flagReasons?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3 cursor-default" onClick={e => e.stopPropagation()}>
                        {review.flagReasons.map((reason) => (
                          <span key={reason} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                            {reason.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expanded Detail */}
                    {selectedReview?._id === review._id && (
                      <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
                        {/* AI Reasoning */}
                        <div className="bg-zinc-800/50 rounded-xl p-4">
                          <p className="text-xs font-medium text-zinc-400 mb-1">🤖 AI Analysis</p>
                          <p className="text-sm text-zinc-300">{buildAiSummary(review)}</p>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                            <span>Confidence: {((review.sentimentConfidence || 0) * 100).toFixed(0)}%</span>
                            <span>Spam: {review.isSpam ? "Yes" : "No"}</span>
                            <span>Duplicate: {review.isDuplicate ? "Yes" : "No"}</span>
                            <span>Bomb: {review.isReviewBomb ? "Yes" : "No"}</span>
                          </div>
                        </div>

                        {detailLoading && !reviewDetails[review._id] && (
                          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50 text-xs text-zinc-500">
                            Loading review context...
                          </div>
                        )}

                        {reviewDetails[review._id]?.similarReviews?.length > 0 && (
                          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
                            <p className="text-xs font-medium text-zinc-300 mb-3">🔍 Similar Reviews</p>
                            <div className="space-y-2">
                              {reviewDetails[review._id].similarReviews.map((sr) => (
                                <div key={sr._id} className="text-xs text-zinc-400 bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span>{sr.productId?.name || "Product"}</span>
                                    <span className="text-zinc-500">{sr.rating}★ • {(sr.trustScore * 100).toFixed(0)}%</span>
                                  </div>
                                  <p className="line-clamp-2">{sr.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {reviewDetails[review._id]?.accountHistory?.length > 0 && (
                          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
                            <p className="text-xs font-medium text-zinc-300 mb-3">🧾 Account History</p>
                            <div className="space-y-2">
                              {reviewDetails[review._id].accountHistory.slice(0, 5).map((history) => (
                                <div key={history._id} className="text-xs text-zinc-400 bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span>{history.productId?.name || "Product"}</span>
                                    <span>{history.rating}★ • {history.overallSentiment || "neutral"}</span>
                                  </div>
                                  <p className="line-clamp-2">{history.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {reviewDetails[review._id]?.productContext && (
                          <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
                            <p className="text-xs font-medium text-zinc-300 mb-3">📦 Product Context</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                              <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 text-center">
                                <p className="text-lg font-semibold text-white">{reviewDetails[review._id].productContext.totalReviews}</p>
                                <p className="text-xs text-zinc-500">Approved Reviews</p>
                              </div>
                              <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 text-center">
                                <p className="text-lg font-semibold text-amber-400">{reviewDetails[review._id].productContext.avgRating}★</p>
                                <p className="text-xs text-zinc-500">Average Rating</p>
                              </div>
                              <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 text-center">
                                <p className="text-lg font-semibold text-indigo-300">{reviewDetails[review._id].productContext.avgTrust}%</p>
                                <p className="text-xs text-zinc-500">Average Trust</p>
                              </div>
                            </div>

                            <div className="text-xs text-zinc-500 flex gap-4">
                              <span>Positive: {reviewDetails[review._id].productContext.sentimentBreakdown.positive}</span>
                              <span>Neutral: {reviewDetails[review._id].productContext.sentimentBreakdown.neutral}</span>
                              <span>Negative: {reviewDetails[review._id].productContext.sentimentBreakdown.negative}</span>
                            </div>
                          </div>
                        )}

                        {/* Action Note */}
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Moderation Note (optional)</label>
                          <textarea
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
                            placeholder="Add a note for this moderation decision…"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {(review.moderationStatus === "pending" || review.isFlagged) && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleModerate([review._id], review.isFlagged ? "override_approve" : "approve"); }}
                                disabled={acting}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                              >
                                {review.isFlagged ? "✅ Override & Approve" : "✅ Approve"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleModerate([review._id], review.isFlagged ? "override_reject" : "reject"); }}
                                disabled={acting}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                              >
                                ❌ Reject
                              </button>
                            </>
                          )}
                          {review.moderationStatus === "approved" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleModerate([review._id], "override_reject"); }}
                              disabled={acting}
                              className="flex-1 py-2.5 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                              ❌ Revoke Approval
                            </button>
                          )}
                          {review.moderationStatus === "rejected" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleModerate([review._id], "override_approve"); }}
                              disabled={acting}
                              className="flex-1 py-2.5 bg-emerald-600/80 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                              ✅ Reinstate
                            </button>
                          )}
                           <button
                              onClick={(e) => { e.stopPropagation(); handleModerate([review._id], "delete"); }}
                              disabled={acting}
                              className="px-4 py-2.5 bg-zinc-600/80 hover:bg-zinc-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                              🗑️ Delete
                            </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
