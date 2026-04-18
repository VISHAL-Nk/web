import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

import User from "../models/User";
import Product from "../models/Product";
import Review from "../models/Review";
import Alert from "../models/Alert";

config({ path: resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = "admin@echosight.com";
const SELLER_EMAIL = "seller@echosight.com";
const CUSTOMER_PREFIX = "trendcustomer";
const TREND_PRODUCT_NAME = "VoltEdge Wireless Earbuds Pro";

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

async function ensureCoreUsers() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const sellerPassword = await bcrypt.hash("seller123", 10);

  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      $set: {
        name: "Admin",
        email: ADMIN_EMAIL,
        role: "admin",
        password: adminPassword,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const seller = await User.findOneAndUpdate(
    { email: SELLER_EMAIL },
    {
      $set: {
        name: "Demo Seller",
        email: SELLER_EMAIL,
        role: "seller",
        password: sellerPassword,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return { admin, seller };
}

async function resetTrendProductData(sellerId: mongoose.Types.ObjectId) {
  const trendProduct = await Product.findOne({
    sellerId,
    name: TREND_PRODUCT_NAME,
  }).select("_id");

  if (!trendProduct) {
    return;
  }

  await Review.deleteMany({ productId: trendProduct._id });
  await Alert.deleteMany({ relatedProductId: trendProduct._id });

  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not available");
  await db.collection("trends").deleteMany({ productId: trendProduct._id });
}

async function createCustomers(count: number) {
  await User.deleteMany({
    email: { $regex: `^${CUSTOMER_PREFIX}\\d+@echosight\\.com$` },
  });

  const password = await bcrypt.hash("customer123", 10);
  const customers = [];

  for (let i = 1; i <= count; i++) {
    customers.push({
      name: `Trend Customer ${i}`,
      email: `${CUSTOMER_PREFIX}${i}@echosight.com`,
      password,
      role: "customer",
    });
  }

  return User.insertMany(customers);
}

async function seedTrendScenario() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);

  const { seller } = await ensureCoreUsers();
  await resetTrendProductData(seller._id);

  const customers = await createCustomers(40);

  const product = await Product.findOneAndUpdate(
    { sellerId: seller._id, name: TREND_PRODUCT_NAME },
    {
      $setOnInsert: {
        sellerId: seller._id,
        name: TREND_PRODUCT_NAME,
        description: "Earbuds seeded with timeline shifts to demonstrate trend analytics.",
        category: "electronics",
        price: 5999,
        imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900",
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!product) {
    throw new Error("Failed to create/fetch trend demo product");
  }

  const reviews = [];
  const now = Date.now();

  for (let i = 0; i < 40; i++) {
    const isRecentDrop = i >= 20;
    const customer = customers[i % customers.length];

    if (!isRecentDrop) {
      reviews.push({
        productId: product._id,
        customerId: customer._id,
        text: "Battery backup is solid and the sound quality is clear for long sessions.",
        cleanedText: "battery backup solid sound quality clear long sessions",
        rating: i % 3 === 0 ? 5 : 4,
        overallSentiment: "positive",
        sentimentConfidence: 0.92,
        trustScore: 0.9,
        moderationStatus: "approved",
        isFlagged: false,
        isSpam: false,
        isDuplicate: false,
        tags: ["battery", "sound_quality"],
        featureSentiments: [
          {
            attribute: "battery",
            sentiment: "positive",
            confidence: 0.9,
            evidenceSnippet: "Battery backup is solid",
          },
          {
            attribute: "audio",
            sentiment: "positive",
            confidence: 0.87,
            evidenceSnippet: "sound quality is clear",
          },
        ],
        createdAt: new Date(now - (40 - i) * 24 * 60 * 60 * 1000),
      });
    } else {
      reviews.push({
        productId: product._id,
        customerId: customer._id,
        text: "Battery drains too fast and earbuds heat up after 30 minutes.",
        cleanedText: "battery drains fast earbuds heat up after 30 minutes",
        rating: i % 2 === 0 ? 1 : 2,
        overallSentiment: "negative",
        sentimentConfidence: 0.95,
        trustScore: 0.88,
        moderationStatus: "approved",
        isFlagged: false,
        isSpam: false,
        isDuplicate: false,
        tags: ["battery_drain", "heating"],
        featureSentiments: [
          {
            attribute: "battery",
            sentiment: "negative",
            confidence: 0.96,
            evidenceSnippet: "Battery drains too fast",
          },
          {
            attribute: "heating",
            sentiment: "negative",
            confidence: 0.94,
            evidenceSnippet: "earbuds heat up",
          },
        ],
        createdAt: new Date(now - (40 - i) * 24 * 60 * 60 * 1000),
      });
    }
  }

  await Review.insertMany(reviews);

  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not available");

  const featureTimeline = {
    battery: [
      { window: 1, positive: 0.9, negative: 0.1, neutral: 0.0, total_mentions: 10 },
      { window: 2, positive: 0.8, negative: 0.2, neutral: 0.0, total_mentions: 10 },
      { window: 3, positive: 0.5, negative: 0.5, neutral: 0.0, total_mentions: 10 },
      { window: 4, positive: 0.2, negative: 0.8, neutral: 0.0, total_mentions: 10 },
    ],
    heating: [
      { window: 3, positive: 0.1, negative: 0.7, neutral: 0.2, total_mentions: 10 },
      { window: 4, positive: 0.0, negative: 0.9, neutral: 0.1, total_mentions: 10 },
    ],
  };

  const detectedTrends = [
    {
      feature: "battery",
      direction: "rising_complaint",
      severity: "systemic",
      current_ratio: 0.8,
      previous_ratio: 0.5,
      change_pct: 30,
      window_description: "last 10 reviews vs previous 10",
      unique_reviewers: 10,
      example_reviews: [
        "Battery drains too fast and earbuds heat up after 30 minutes.",
      ],
    },
    {
      feature: "heating",
      direction: "rising_complaint",
      severity: "emerging",
      current_ratio: 0.9,
      previous_ratio: 0.7,
      change_pct: 20,
      window_description: "last 10 reviews vs previous 10",
      unique_reviewers: 8,
      example_reviews: [
        "earbuds heat up after 30 minutes",
      ],
    },
  ];

  await db.collection("trends").insertOne({
    productId: product._id,
    periodStart: reviews[0].createdAt,
    periodEnd: reviews[reviews.length - 1].createdAt,
    totalReviewsAnalyzed: reviews.length,
    windowSize: 10,
    featureTimeline: featureTimeline,
    detectedTrends: detectedTrends,
    createdAt: new Date(),
  });

  await Alert.create({
    recipientId: seller._id,
    recipientRole: "seller",
    type: "trend_alert",
    title: "Trend Alert: Battery",
    message:
      "Battery complaints increased sharply in the latest review window. Check product quality and batch-level issues.",
    relatedProductId: product._id,
    relatedReviewIds: [],
  });

  console.log("\nTrend Analysis Seed Ready");
  console.log(`Seller login: ${SELLER_EMAIL} / seller123`);
  console.log("Product:", product.name);
  console.log("Inserted 40 approved reviews + trend snapshot in trends collection.");
  console.log("Other seller products were not modified.");
  console.log("Open /seller/products and /seller/products/[productId]/analytics to verify charts.\n");

  await mongoose.disconnect();
}

seedTrendScenario().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
