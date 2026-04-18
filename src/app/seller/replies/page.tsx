"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface ProductOption {
  _id: string;
  name: string;
  category: string;
}

interface ReviewItem {
  _id: string;
  text: string;
  rating: number;
  tags: string[];
  overallSentiment: string;
  autoResponse: string;
  autoResponseAt: string | null;
  createdAt: string;
  customerName: string;
  product: {
    _id: string;
    name: string;
    category: string;
  };
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  negative: "text-red-400 bg-red-500/10 border-red-500/20",
  neutral: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${star <= rating ? "text-amber-400" : "text-zinc-700"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function SellerRepliesPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [selectedProduct]);

  async function fetchReviews() {
    setLoading(true);

    const params = new URLSearchParams({ limit: "100" });
    if (selectedProduct) {
      params.set("productId", selectedProduct);
    }

    const res = await fetch(`/api/seller/reviews?${params.toString()}`);
    if (!res.ok) {
      toast.error("Failed to load reviews");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const productList: ProductOption[] = data.products || [];
    const reviewList: ReviewItem[] = data.reviews || [];

    setProducts(productList);
    setReviews(reviewList);

    setDrafts((prev) => {
      const next = { ...prev };
      for (const review of reviewList) {
        if (next[review._id] === undefined) {
          next[review._id] = review.autoResponse || "";
        }
      }
      return next;
    });

    if (!selectedProduct && productList.length > 0) {
      setSelectedProduct(productList[0]._id);
    }

    setLoading(false);
  }

  async function saveReply(reviewId: string) {
    const reply = (drafts[reviewId] || "").trim();
    setSavingId(reviewId);

    const res = await fetch(`/api/seller/reviews/${reviewId}/reply`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error || "Failed to save reply");
      setSavingId(null);
      return;
    }

    setReviews((prev) =>
      prev.map((r) =>
        r._id === reviewId
          ? {
              ...r,
              autoResponse: data.review?.autoResponse || "",
              autoResponseAt: data.review?.autoResponseAt || null,
            }
          : r
      )
    );

    toast.success(data.message || "Reply saved");
    setSavingId(null);
  }

  const visibleReviews = useMemo(() => {
    if (!selectedProduct) return reviews;
    return reviews.filter((r) => r.product._id === selectedProduct);
  }, [reviews, selectedProduct]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Seller Replies</h1>
        <p className="text-zinc-500 mt-1">Reply to approved reviews for your products</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-zinc-500 mb-2">Filter by product</label>
        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
        >
          {products.length === 0 ? (
            <option value="">No products available</option>
          ) : (
            products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.category})
              </option>
            ))
          )}
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : visibleReviews.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">No approved reviews found for replies.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReviews.map((review) => (
            <div key={review._id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm text-zinc-500">{review.product.name}</p>
                  <p className="text-sm font-medium text-white">{review.customerName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StarRow rating={review.rating} />
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${
                      SENTIMENT_STYLE[review.overallSentiment] || SENTIMENT_STYLE.neutral
                    }`}
                  >
                    {review.overallSentiment || "neutral"}
                  </span>
                </div>
              </div>

              <p className="text-sm text-zinc-300 mb-3">{review.text}</p>

              {review.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {review.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <label className="block text-xs text-zinc-500 mb-2">Your reply</label>
              <textarea
                value={drafts[review._id] || ""}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [review._id]: e.target.value,
                  }))
                }
                rows={3}
                maxLength={1000}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="Write a helpful response for this customer..."
              />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                <p className="text-xs text-zinc-600">
                  {review.autoResponseAt
                    ? `Last replied on ${new Date(review.autoResponseAt).toLocaleString("en-IN")}`
                    : "No reply sent yet"}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDrafts((prev) => ({ ...prev, [review._id]: "" }));
                    }}
                    className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={savingId === review._id}
                    onClick={() => saveReply(review._id)}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg transition-all disabled:opacity-60"
                  >
                    {savingId === review._id ? "Saving..." : "Save Reply"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
