import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User";
import Product from "./models/Product";
import Review from "./models/Review";
import Alert from "./models/Alert";

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not set. Check .env.local");
  process.exit(1);
}

async function seed() {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI!);
  console.log("✅ Connected.");

  await User.deleteMany({ email: { $in: ["admin@echosight.com", "seller@echosight.com"] } });
  await User.deleteMany({ email: /customer\d+@echosight\.com/ });
  await Review.deleteMany({});
  await Alert.deleteMany({});

  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await User.create({ name: "Admin", email: "admin@echosight.com", password: adminPassword, role: "admin" });

  const sellerPassword = await bcrypt.hash("seller123", 10);
  const seller = await User.create({ name: "Demo Seller", email: "seller@echosight.com", password: sellerPassword, role: "seller" });

  await Product.deleteMany({ sellerId: seller._id });
  const products = await Product.insertMany([
    {
      sellerId: seller._id,
      name: "UltraPhone X200",
      description: "Flagship smartphone with 6.7\" AMOLED.",
      category: "electronics",
      price: 49999,
      reviewCount: 30,
      avgRating: 3.8,
      ratingDistribution: [4, 6, 5, 5, 10], // 1 to 5 stars counts
      imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
    }
  ]);

  const pId = products[0]._id;

  // Create 10 customers
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    customers.push({
      name: `Customer ${i}`, email: `customer${i}@echosight.com`, password: adminPassword, role: "customer"
    });
  }
  const dbCustomers = await User.insertMany(customers);

  // Generate 30 fake reviews, some bombs, some genuine
  const reviewsData = [];
  for (let i = 0; i < 20; i++) {
    // genuine
    reviewsData.push({
      productId: pId,
      customerId: dbCustomers[i % 10]._id,
      text: "Great phone, but battery could be better. Screen is amazing.",
      cleanedText: "great phone battery screen amazing",
      rating: 4,
      overallSentiment: "positive",
      sentimentConfidence: 0.9,
      trustScore: 0.85,
      isFlagged: false,
      isSpam: false,
      isDuplicate: false,
      isReviewBomb: false,
      moderationStatus: "approved",
      tags: ["battery", "screen"],
      featureSentiments: [
        { attribute: "battery", sentiment: "negative", confidence: 0.8, evidenceSnippet: "battery could be better" },
        { attribute: "screen", sentiment: "positive", confidence: 0.9, evidenceSnippet: "Screen is amazing" }
      ],
      createdAt: new Date(Date.now() - i * 86400000)
    });
  }

  // Bomb reviews
  for (let i = 0; i < 10; i++) {
    reviewsData.push({
      productId: pId,
      customerId: dbCustomers[i % 10]._id,
      text: "Terrible battery! Do not buy! Heating issues immediately.",
      cleanedText: "terrible battery heating issue",
      rating: 1,
      overallSentiment: "negative",
      sentimentConfidence: 0.95,
      trustScore: 0.1,
      isFlagged: true,
      flagReasons: ["review_bomb", "negative_spike"],
      isSpam: false,
      isDuplicate: true,
      isReviewBomb: true,
      bombType: "negative_spike",
      moderationStatus: "pending",
      tags: ["battery", "heating"],
      featureSentiments: [
        { attribute: "battery", sentiment: "negative", confidence: 0.9, evidenceSnippet: "Terrible battery" }
      ],
      createdAt: new Date()
    });
  }

  await Review.insertMany(reviewsData);
  console.log("📦 Generated 30 reviews with AI analysis including Review Bomb cluster");

  await mongoose.disconnect();
  console.log("🎉 Seed complete! Start the Next.js server to explore.");
}

seed().catch(console.error);
