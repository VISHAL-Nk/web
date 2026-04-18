"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  reviewCount: number;
  avgRating: number;
  ratingDistribution: number[];
}

interface Review {
  _id: string;
  customerName: string;
  rating: number;
  text: string;
  imageUrl?: string;
  tags: string[];
  moderationStatus: string;
  moderationNote?: string;
  autoResponse?: string;
  autoResponseAt?: string;
  overallSentiment?: string;
  createdAt: string;
}

interface CustomerQAResult {
  answer: string;
  confidence: number;
  intent: string;
  needs_follow_up: boolean;
  follow_up_question?: string;
  escalation_state: string;
  evidence_refs: string[];
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "w-6 h-6" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClass} ${star <= Math.round(rating) ? "text-amber-400" : "text-zinc-700"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function InteractiveStars({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(star)}
          className="transition-transform hover:scale-110"
        >
          <svg
            className={`w-8 h-8 ${
              star <= (hover || rating) ? "text-amber-400" : "text-zinc-700"
            } transition-colors`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  negative: "text-red-400 bg-red-500/10 border-red-500/20",
  neutral: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export default function ProductDetailPage() {
  const { id: rawId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const routeProductId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Review form
  const [showForm, setShowForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewImage, setReviewImage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Product Q&A
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState("");
  const [qaResult, setQaResult] = useState<CustomerQAResult | null>(null);
  const [qaSessionId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  });

  useEffect(() => {
    if (!routeProductId) {
      return;
    }
    fetchProduct(page);
  }, [routeProductId, page]);

  async function fetchProduct(pageNum: number) {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    if (!routeProductId) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const res = await fetch(`/api/customer/products/${routeProductId}?page=${pageNum}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setProduct(data.product);
      
      if (pageNum === 1) {
        setReviews(data.reviews);
      } else {
        setReviews(prev => [...prev, ...data.reviews]);
      }
      
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
      }
    }
    setLoading(false);
    setLoadingMore(false);
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    if (reviewRating === 0) {
      setSubmitError("Please select a rating");
      return;
    }
    if (reviewText.length < 10) {
      setSubmitError("Review must be at least 10 characters");
      return;
    }

    const resolvedProductId = product?._id || routeProductId;
    if (!resolvedProductId) {
      setSubmitError("Unable to resolve product. Please refresh and try again.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/customer/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: resolvedProductId,
        text: reviewText,
        rating: reviewRating,
        imageUrl: reviewImage || undefined,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      toast.success(data.message || "Review submitted successfully!");
      setShowForm(false);
      setReviewText("");
      setReviewRating(0);
      setReviewImage("");
      // Refresh reviews
      setPage(1);
      fetchProduct(1);
    } else {
      toast.error(data.error || "Failed to submit review");
      setSubmitError(data.error || "Failed to submit review");
    }

    setSubmitting(false);
  }

  async function handleAskProductQuestion(e: React.FormEvent) {
    e.preventDefault();
    setQaError("");

    const normalizedQuestion = qaQuestion.trim();
    if (normalizedQuestion.length < 3) {
      setQaError("Please enter a complete question.");
      return;
    }

    const resolvedProductId = product?._id || routeProductId;
    if (!resolvedProductId) {
      setQaError("Unable to resolve product right now. Please refresh and try again.");
      return;
    }

    setQaLoading(true);
    try {
      const res = await fetch("/api/customer/questions/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: resolvedProductId,
          question: normalizedQuestion,
          sessionId: qaSessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setQaError(data.error || "Unable to answer right now. Please try again.");
        return;
      }

      setQaResult(data.result || null);
    } catch (error) {
      console.error("Customer Q&A request failed:", error);
      setQaError("Q&A service is temporarily unavailable.");
    } finally {
      setQaLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 animate-pulse">
        <div className="h-64 bg-zinc-800 rounded-2xl mb-6" />
        <div className="h-6 bg-zinc-800 rounded w-1/3 mb-2" />
        <div className="h-4 bg-zinc-800 rounded w-2/3" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-zinc-500 text-lg">Product not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Product Info */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        <div className="md:w-1/2">
          <div className="aspect-square bg-zinc-800 rounded-2xl overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                No Image
              </div>
            )}
          </div>
        </div>

        <div className="md:w-1/2">
          <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full capitalize">
            {product.category}
          </span>
          <h1 className="text-3xl font-bold text-white mt-3 mb-2">{product.name}</h1>
          <p className="text-zinc-400 mb-4">{product.description}</p>
          <p className="text-3xl font-bold text-white mb-6">
            ₹{product.price.toLocaleString("en-IN")}
          </p>

          <div className="flex items-center gap-4 mb-6">
            <StarRating rating={product.avgRating} size="lg" />
            <span className="text-2xl font-bold text-white">
              {product.avgRating > 0 ? product.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-zinc-500">
              ({product.reviewCount} review{product.reviewCount !== 1 ? "s" : ""})
            </span>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-1.5 mb-6">
            {[5, 4, 3, 2, 1].map((star, idx) => {
              const count = product.ratingDistribution[star - 1];
              const pct = product.reviewCount > 0 ? (count / product.reviewCount) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-4">{star}</span>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-zinc-600 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          {user?.role === "customer" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl transition-all"
            >
              Write a Review
            </button>
          )}
        </div>
      </div>

      {/* Submit Message */}
      {submitMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-5 py-4 rounded-xl mb-6">
          {submitMessage}
        </div>
      )}

      {/* Ask Product Question */}
      {user?.role === "customer" && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-1">Ask About This Product</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Agentic assistant answers using approved review insights and product data.
          </p>

          <form onSubmit={handleAskProductQuestion} className="space-y-3">
            <textarea
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              rows={3}
              placeholder="Example: Is this good for long battery usage?"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            />

            {qaError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {qaError}
              </div>
            )}

            <button
              type="submit"
              disabled={qaLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {qaLoading ? "Thinking..." : "Ask"}
            </button>
          </form>

          {qaResult && (
            <div className="mt-4 bg-zinc-800/40 border border-zinc-700 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  intent: {qaResult.intent}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-zinc-700/50 text-zinc-300 border border-zinc-600">
                  confidence: {(qaResult.confidence * 100).toFixed(0)}%
                </span>
                {qaResult.escalation_state !== "none" && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {qaResult.escalation_state.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">{qaResult.answer}</p>

              {qaResult.evidence_refs?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-700/70">
                  <p className="text-xs text-zinc-400 mb-1">Evidence used</p>
                  <ul className="space-y-1">
                    {qaResult.evidence_refs.slice(0, 4).map((ref) => (
                      <li key={ref} className="text-xs text-zinc-500">• {ref}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitReview}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Write Your Review</h3>

          {submitError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">
              {submitError}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-2">Rating</label>
            <InteractiveStars rating={reviewRating} onRate={setReviewRating} />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-2">Your Review</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="Share your experience with this product…"
              required
            />
            <p className="text-xs text-zinc-600 mt-1">{reviewText.length}/2000 characters</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-zinc-400 mb-2">
              Image URL <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              type="url"
              value={reviewImage}
              onChange={(e) => setReviewImage(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
            >
              {submitting ? "Analyzing & Submitting…" : "Submit Review"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-3 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Reviews */}
      <h2 className="text-xl font-bold text-white mb-6">
        Reviews ({product.reviewCount})
      </h2>

      {reviews.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500">No reviews yet. Be the first to review!</p>
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
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-medium">
                    {review.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{review.customerName}</p>
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
                  {review.overallSentiment && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${
                        SENTIMENT_COLORS[review.overallSentiment] || SENTIMENT_COLORS.neutral
                      }`}
                    >
                      {review.overallSentiment}
                    </span>
                  )}
                  <StarRating rating={review.rating} />
                </div>
              </div>

              <p className="text-zinc-300 text-sm leading-relaxed mb-3">{review.text}</p>

              {review.imageUrl && (
                <div className="mb-3">
                  <img
                    src={review.imageUrl}
                    alt="Review"
                    className="max-h-48 rounded-xl object-cover"
                  />
                </div>
              )}

              {review.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {review.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {review.autoResponse && (!review.autoResponseAt || new Date(review.autoResponseAt).getTime() <= new Date().getTime()) && (
                <div className="mt-3 ml-4 pl-4 border-l-2 border-violet-500/30">
                  <p className="text-xs font-medium text-violet-400 mb-1">Seller Response</p>
                  <p className="text-sm text-zinc-400">{review.autoResponse}</p>
                </div>
              )}
            </div>
          ))}
          
          {page < totalPages && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More Reviews"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
