"use client";

import { useState, useEffect } from "react";

interface Review {
  _id: string;
  product: { _id: string; name: string; imageUrl: string };
  rating: number;
  text: string;
  overallSentiment: string;
  trustScore: number;
  tags: string[];
  isFlagged: boolean;
  moderationStatus: string;
  autoResponse: string;
  autoResponseAt?: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  auto_approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    const res = await fetch("/api/customer/reviews");
    if (res.ok) {
      const data = await res.json();
      setReviews(data.reviews);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-white mb-8">My Reviews</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">My Reviews</h1>
      <p className="text-zinc-500 mb-8">Track the status of your submitted reviews</p>

      {reviews.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">You haven&apos;t reviewed any products yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {review.product?.imageUrl && (
                    <img
                      src={review.product.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {review.product?.name || "Product"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      STATUS_BADGE[review.moderationStatus] || STATUS_BADGE.pending
                    }`}
                  >
                    {review.moderationStatus === "auto_approved"
                      ? "Auto-approved"
                      : review.moderationStatus.charAt(0).toUpperCase() +
                        review.moderationStatus.slice(1)}
                  </span>

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg
                        key={s}
                        className={`w-3.5 h-3.5 ${s <= review.rating ? "text-amber-400" : "text-zinc-700"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-sm text-zinc-300 mb-3">{review.text}</p>

              {review.isFlagged && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2 mb-3">
                  <p className="text-xs text-amber-400">
                    ⚠ This review is under moderation and not yet visible to other users.
                  </p>
                </div>
              )}

              {review.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {review.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {review.autoResponse && (!review.autoResponseAt || new Date(review.autoResponseAt).getTime() <= Date.now()) && (
                <div className="ml-4 pl-4 border-l-2 border-violet-500/30">
                  <p className="text-xs font-medium text-violet-400 mb-1">Seller Response</p>
                  <p className="text-sm text-zinc-400">{review.autoResponse}</p>
                </div>
              )}

              {review.autoResponse && review.autoResponseAt && new Date(review.autoResponseAt).getTime() > Date.now() && (
                <div className="ml-4 pl-4 border-l-2 border-zinc-600/50">
                  <p className="text-xs text-zinc-500">Seller response scheduled.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
