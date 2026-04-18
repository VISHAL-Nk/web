import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Product from "@/lib/models/Product";
import { withRole } from "@/lib/auth";

// PUT — Update a product (seller must own it)
export const PUT = withRole(["seller"], async (req: NextRequest, { user, params }) => {
  await connectDB();
  const productId = params?.id;

  if (!productId) {
    return NextResponse.json({ error: "Product ID required" }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.sellerId.toString() !== user.userId) {
    return NextResponse.json({ error: "You do not own this product" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, category, price, imageUrl, isActive } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (category !== undefined) {
    if (!["electronics", "food", "clothing"].includes(category)) {
      return NextResponse.json(
        { error: "Category must be electronics, food, or clothing" },
        { status: 400 }
      );
    }
    updateData.category = category;
  }
  if (price !== undefined) updateData.price = Number(price);
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);

  const updated = await Product.findByIdAndUpdate(productId, updateData, { new: true }).lean();

  return NextResponse.json({ success: true, product: updated });
});

// DELETE — Soft-delete a product (set isActive: false)
export const DELETE = withRole(["seller"], async (_req: NextRequest, { user, params }) => {
  await connectDB();
  const productId = params?.id;

  if (!productId) {
    return NextResponse.json({ error: "Product ID required" }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.sellerId.toString() !== user.userId) {
    return NextResponse.json({ error: "You do not own this product" }, { status: 403 });
  }

  await Product.findByIdAndUpdate(productId, { isActive: false });

  return NextResponse.json({ success: true, message: "Product deactivated" });
});
