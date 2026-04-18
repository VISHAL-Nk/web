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
const CUSTOMER_PREFIX = "sentcustomer";

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
      name: `Sentiment Customer ${i}`,
      email: `${CUSTOMER_PREFIX}${i}@echosight.com`,
      password,
      role: "customer",
    });
  }

  return User.insertMany(customers);
}

async function seedSentimentScenario() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);

  const { seller } = await ensureCoreUsers();
  await wipeSellerDomain(seller._id);

  const customers = await createCustomers(12);

  const product = await Product.create({
    sellerId: seller._id,
    name: "AromaBrew Smart Coffee Maker",
    description: "Smart coffee maker seeded for sentiment distribution demos.",
    category: "electronics",
    price: 8999,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900",
  });

  const reviewBlueprints = [
    {
      rating: 5,
      sentiment: "positive",
      text: "Coffee tastes excellent and the app scheduling works perfectly.",
      tags: ["coffee_taste", "app_control"],
      featureSentiments: [
        { attribute: "taste", sentiment: "positive", confidence: 0.95, evidenceSnippet: "tastes excellent" },
        { attribute: "app", sentiment: "positive", confidence: 0.9, evidenceSnippet: "scheduling works perfectly" },
      ],
    },
    {
      rating: 4,
      sentiment: "positive",
      text: "Brews quickly and cleaning is easy after daily use.",
      tags: ["brew_speed", "cleaning"],
      featureSentiments: [
        { attribute: "brew_speed", sentiment: "positive", confidence: 0.87, evidenceSnippet: "Brews quickly" },
        { attribute: "maintenance", sentiment: "positive", confidence: 0.82, evidenceSnippet: "cleaning is easy" },
      ],
    },
    {
      rating: 5,
      sentiment: "positive",
      text: "Great aroma and consistent temperature in every brew.",
      tags: ["aroma", "temperature_control"],
      featureSentiments: [
        { attribute: "aroma", sentiment: "positive", confidence: 0.9, evidenceSnippet: "Great aroma" },
        { attribute: "temperature", sentiment: "positive", confidence: 0.86, evidenceSnippet: "consistent temperature" },
      ],
    },
    {
      rating: 4,
      sentiment: "positive",
      text: "The build quality feels premium and coffee output is strong.",
      tags: ["build_quality", "brew_quality"],
      featureSentiments: [
        { attribute: "build", sentiment: "positive", confidence: 0.85, evidenceSnippet: "feels premium" },
        { attribute: "brew_quality", sentiment: "positive", confidence: 0.84, evidenceSnippet: "output is strong" },
      ],
    },
    {
      rating: 5,
      sentiment: "positive",
      text: "Perfect for mornings, very reliable timer and notifications.",
      tags: ["timer", "notifications"],
      featureSentiments: [
        { attribute: "timer", sentiment: "positive", confidence: 0.89, evidenceSnippet: "very reliable timer" },
      ],
    },
    {
      rating: 3,
      sentiment: "neutral",
      text: "It works fine but the water tank could be slightly larger.",
      tags: ["water_tank"],
      featureSentiments: [
        { attribute: "water_tank", sentiment: "neutral", confidence: 0.64, evidenceSnippet: "could be slightly larger" },
      ],
    },
    {
      rating: 3,
      sentiment: "neutral",
      text: "Coffee quality is decent, app UI is average.",
      tags: ["coffee_quality", "app_ui"],
      featureSentiments: [
        { attribute: "taste", sentiment: "neutral", confidence: 0.6, evidenceSnippet: "quality is decent" },
        { attribute: "app", sentiment: "neutral", confidence: 0.58, evidenceSnippet: "UI is average" },
      ],
    },
    {
      rating: 3,
      sentiment: "neutral",
      text: "Good machine overall, but setup instructions are not very clear.",
      tags: ["setup", "instructions"],
      featureSentiments: [
        { attribute: "setup", sentiment: "neutral", confidence: 0.57, evidenceSnippet: "instructions are not very clear" },
      ],
    },
    {
      rating: 2,
      sentiment: "negative",
      text: "The grinder is too noisy and wakes everyone up in the morning.",
      tags: ["noise", "grinder"],
      featureSentiments: [
        { attribute: "noise", sentiment: "negative", confidence: 0.92, evidenceSnippet: "too noisy" },
      ],
    },
    {
      rating: 2,
      sentiment: "negative",
      text: "Steam wand pressure is weak and milk frothing is poor.",
      tags: ["steam_wand", "milk_frothing"],
      featureSentiments: [
        { attribute: "steam_wand", sentiment: "negative", confidence: 0.88, evidenceSnippet: "pressure is weak" },
      ],
      autoResponse: "We are sorry about the weak steam pressure. Our team can help calibrate or replace the unit.",
    },
    {
      rating: 1,
      sentiment: "negative",
      text: "Stopped heating after one month and customer support was slow.",
      tags: ["heating_issue", "support_delay"],
      featureSentiments: [
        { attribute: "heating", sentiment: "negative", confidence: 0.94, evidenceSnippet: "Stopped heating" },
        { attribute: "support", sentiment: "negative", confidence: 0.83, evidenceSnippet: "support was slow" },
      ],
      autoResponse: "We apologize for the heating issue and support delay. Please share your order ID and we will prioritize a replacement.",
    },
    {
      rating: 2,
      sentiment: "negative",
      text: "Frequent descaling alerts even after cleaning, very frustrating.",
      tags: ["alerts", "maintenance"],
      featureSentiments: [
        { attribute: "maintenance", sentiment: "negative", confidence: 0.86, evidenceSnippet: "Frequent descaling alerts" },
      ],
    },
  ];

  const now = Date.now();

  const reviews = reviewBlueprints.map((blueprint, index) => ({
    productId: product._id,
    customerId: customers[index]._id,
    text: blueprint.text,
    cleanedText: blueprint.text.toLowerCase().replace(/[^a-z0-9\s]/g, ""),
    rating: blueprint.rating,
    overallSentiment: blueprint.sentiment,
    sentimentConfidence: blueprint.sentiment === "neutral" ? 0.66 : 0.91,
    trustScore: blueprint.sentiment === "negative" ? 0.84 : 0.93,
    moderationStatus: "approved",
    isFlagged: false,
    isSpam: false,
    isDuplicate: false,
    tags: blueprint.tags,
    featureSentiments: blueprint.featureSentiments,
    autoResponse: blueprint.autoResponse || "",
    autoResponseAt: blueprint.autoResponse ? new Date(now - (11 - index) * 60 * 60 * 1000) : undefined,
    createdAt: new Date(now - (12 - index) * 24 * 60 * 60 * 1000),
  }));

  await Review.insertMany(reviews);

  console.log("\nSentiment Analysis Seed Ready");
  console.log(`Seller login: ${SELLER_EMAIL} / seller123`);
  console.log("Product:", product.name);
  console.log("Expected mix: 5 positive, 3 neutral, 4 negative approved reviews");
  console.log("Customer logins: sentcustomer1@echosight.com .. sentcustomer12@echosight.com / customer123\n");

  await mongoose.disconnect();
}

seedSentimentScenario().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
