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
const CUSTOMER_PREFIX = "spamcustomer";

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

async function wipeSellerDomain(sellerId: mongoose.Types.ObjectId) {
  const productIds = await Product.find({ sellerId }).distinct("_id");

  if (productIds.length > 0) {
    await Review.deleteMany({ productId: { $in: productIds } });
    await Alert.deleteMany({
      $or: [{ recipientId: sellerId }, { relatedProductId: { $in: productIds } }],
    });

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is not available");
    await db.collection("trends").deleteMany({ productId: { $in: productIds } });

    await Product.deleteMany({ sellerId });
  }
}

async function createCustomers(count: number) {
  await User.deleteMany({
    email: { $regex: `^${CUSTOMER_PREFIX}\\d+@echosight\\.com$` },
  });

  const password = await bcrypt.hash("customer123", 10);
  const customers = [];

  for (let i = 1; i <= count; i++) {
    customers.push({
      name: `Spam Customer ${i}`,
      email: `${CUSTOMER_PREFIX}${i}@echosight.com`,
      password,
      role: "customer",
    });
  }

  return User.insertMany(customers);
}

async function seedSpamDetectionScenario() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);

  const { seller } = await ensureCoreUsers();
  await wipeSellerDomain(seller._id);

  const customers = await createCustomers(6);

  const product = await Product.create({
    sellerId: seller._id,
    name: "Sentinel USB-C Charger",
    description: "65W fast charger used for spam/duplicate detection demos.",
    category: "electronics",
    price: 2499,
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=900",
  });

  const anchorDuplicateText =
    "This charger overheats after 20 minutes and stopped working in one week. Very disappointed with reliability.";

  const now = Date.now();

  await Review.insertMany([
    {
      productId: product._id,
      customerId: customers[0]._id,
      text: anchorDuplicateText,
      cleanedText: "charger overheats 20 minutes stopped working one week disappointed reliability",
      rating: 1,
      overallSentiment: "negative",
      sentimentConfidence: 0.96,
      trustScore: 0.89,
      moderationStatus: "approved",
      isFlagged: false,
      isSpam: false,
      isDuplicate: false,
      tags: ["overheating", "reliability"],
      featureSentiments: [
        {
          attribute: "heating",
          sentiment: "negative",
          confidence: 0.95,
          evidenceSnippet: "overheats after 20 minutes",
        },
      ],
      createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000),
    },
    {
      productId: product._id,
      customerId: customers[1]._id,
      text: "Fast charging is good but the cable quality is average.",
      cleanedText: "fast charging good cable quality average",
      rating: 3,
      overallSentiment: "neutral",
      sentimentConfidence: 0.73,
      trustScore: 0.91,
      moderationStatus: "approved",
      isFlagged: false,
      isSpam: false,
      isDuplicate: false,
      tags: ["charging_speed", "cable_quality"],
      featureSentiments: [
        {
          attribute: "charging",
          sentiment: "positive",
          confidence: 0.8,
          evidenceSnippet: "Fast charging is good",
        },
        {
          attribute: "cable",
          sentiment: "neutral",
          confidence: 0.62,
          evidenceSnippet: "cable quality is average",
        },
      ],
      createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    },
    {
      productId: product._id,
      customerId: customers[2]._id,
      text: "Build quality feels solid and works with my laptop and phone.",
      cleanedText: "build quality solid works laptop phone",
      rating: 4,
      overallSentiment: "positive",
      sentimentConfidence: 0.88,
      trustScore: 0.93,
      moderationStatus: "approved",
      isFlagged: false,
      isSpam: false,
      isDuplicate: false,
      tags: ["build_quality", "compatibility"],
      featureSentiments: [
        {
          attribute: "build",
          sentiment: "positive",
          confidence: 0.86,
          evidenceSnippet: "Build quality feels solid",
        },
      ],
      createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
    },
    {
      productId: product._id,
      customerId: customers[3]._id,
      text: "BUY NOW best charger buy now best charger buy now!!!",
      cleanedText: "buy now best charger buy now best charger buy now",
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.45,
      trustScore: 0.08,
      moderationStatus: "pending",
      isFlagged: true,
      isSpam: true,
      isDuplicate: true,
      flagReasons: ["bot_duplicate", "high_risk"],
      tags: ["promotional_spam"],
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    },
    {
      productId: product._id,
      customerId: customers[4]._id,
      text: "BUY NOW best charger buy now best charger buy now!!!",
      cleanedText: "buy now best charger buy now best charger buy now",
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.43,
      trustScore: 0.05,
      moderationStatus: "pending",
      isFlagged: true,
      isSpam: true,
      isDuplicate: true,
      flagReasons: ["bot_duplicate", "cross_product_duplicate"],
      tags: ["promotional_spam"],
      createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log("\nSpam Detection Seed Ready");
  console.log(`Seller login: ${SELLER_EMAIL} / seller123`);
  console.log("Product:", product.name);
  console.log("Use this duplicate text for testing hard-block:");
  console.log(anchorDuplicateText);
  console.log("Customer logins: spamcustomer1@echosight.com .. spamcustomer6@echosight.com / customer123\n");

  await mongoose.disconnect();
}

seedSpamDetectionScenario().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
