import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import Review from "@/lib/models/Review";
import { withRole } from "@/lib/auth";

// GET — List all products by the logged-in seller
export const GET = withRole(["seller"], async (_req, { user }) => {
  await connectDB();

  const products = await Product.find({ sellerId: user.userId, isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  // Get review counts for each product
  const productIds = products.map((p) => p._id);
  const reviewCounts = await Review.aggregate([
    { $match: { productId: { $in: productIds } } },
    { $group: { _id: "$productId", count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
  ]);

  const countMap = new Map(
    reviewCounts.map((r) => [r._id.toString(), { count: r.count, avgRating: r.avgRating }])
  );

  const result = products.map((p) => {
    const stats = countMap.get(p._id.toString()) || { count: 0, avgRating: 0 };
    return {
      ...p,
      reviewCount: stats.count,
      avgRating: Math.round(stats.avgRating * 10) / 10,
    };
  });

  return NextResponse.json({ products: result });
});

// POST — Create a new product
export const POST = withRole(["seller"], async (req, { user }) => {
  await connectDB();
  const body = await req.json();

  const { name, description, category, price, imageUrl } = body;

  if (!name || !description || !category || price === undefined) {
    return NextResponse.json(
      { error: "Name, description, category, and price are required" },
      { status: 400 }
    );
  }

  if (!["electronics", "food", "clothing"].includes(category)) {
    return NextResponse.json(
      { error: "Category must be electronics, food, or clothing" },
      { status: 400 }
    );
  }

  const product = await Product.create({
    sellerId: user.userId,
    name,
    description,
    category,
    price: Number(price),
    imageUrl: imageUrl || "",
  });

  return NextResponse.json({ product }, { status: 201 });
});
