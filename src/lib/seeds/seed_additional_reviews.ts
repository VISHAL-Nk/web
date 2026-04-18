import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

import User from "../models/User";
import Product from "../models/Product";
import Review from "../models/Review";

config({ path: resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
const SELLER_EMAIL = "seller@echosight.com";
const CUSTOMER_PREFIX = "extracustomer";

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

type FeatureSentiment = {
  attribute: string;
  sentiment: "positive" | "negative" | "neutral" | "ambiguous";
  confidence: number;
  evidenceSnippet: string;
};

type ReviewSeed = {
  customerIndex: number;
  rating: number;
  text: string;
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  trustScore: number;
  tags: string[];
  featureSentiments: FeatureSentiment[];
  daysAgo: number;
};

async function getOrCreateCustomers(count: number) {
  const password = await bcrypt.hash("customer123", 10);
  const customers = [];

  for (let i = 1; i <= count; i++) {
    const email = `${CUSTOMER_PREFIX}${i}@echosight.com`;

    const customer = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Extra Customer ${i}`,
          email,
          password,
          role: "customer",
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (!customer) {
      throw new Error(`Failed to create or fetch customer: ${email}`);
    }

    customers.push(customer);
  }

  return customers;
}

async function getOrCreateProduct(input: {
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: "electronics" | "food" | "clothing";
  price: number;
  imageUrl: string;
}) {
  const product = await Product.findOneAndUpdate(
    { sellerId: input.sellerId, name: input.name },
    {
      $setOnInsert: {
        ...input,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!product) {
    throw new Error(`Failed to create or fetch product: ${input.name}`);
  }

  return product;
}

async function seedReviewsForProduct(
  productId: mongoose.Types.ObjectId,
  customers: Array<{ _id: mongoose.Types.ObjectId }>,
  seeds: ReviewSeed[]
) {
  for (const seed of seeds) {
    await Review.updateOne(
      {
        productId,
        customerId: customers[seed.customerIndex]._id,
      },
      {
        $setOnInsert: {
          productId,
          customerId: customers[seed.customerIndex]._id,
          text: seed.text,
          cleanedText: cleanText(seed.text),
          rating: seed.rating,
          overallSentiment: seed.sentiment,
          sentimentConfidence: seed.confidence,
          trustScore: seed.trustScore,
          moderationStatus: "approved" as const,
          isFlagged: false,
          isSpam: false,
          isDuplicate: false,
          isReviewBomb: false,
          bombType: "none",
          tags: seed.tags,
          featureSentiments: seed.featureSentiments,
          reasoning: "seeded additional product review",
          createdAt: new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true }
    );
  }
}

async function seedAdditionalReviews() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);

  const seller = await User.findOne({ email: SELLER_EMAIL, role: "seller" });
  if (!seller) {
    throw new Error(`Seller not found. Please ensure ${SELLER_EMAIL} exists.`);
  }

  const customers = await getOrCreateCustomers(12);

  const productA = await getOrCreateProduct({
    sellerId: seller._id,
    name: "PulseBrew Coffee Grinder",
    description: "Compact grinder for daily brewing with consistent grind size.",
    category: "electronics",
    price: 3499,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900",
  });

  const productB = await getOrCreateProduct({
    sellerId: seller._id,
    name: "StrideLite Running Shoes",
    description: "Lightweight everyday running shoes with breathable mesh support.",
    category: "clothing",
    price: 2799,
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900",
  });

  await seedReviewsForProduct(productA._id, customers, [
    {
      customerIndex: 0,
      rating: 5,
      text: "Very consistent grind and low noise even in early mornings.",
      sentiment: "positive",
      confidence: 0.92,
      trustScore: 0.94,
      tags: ["grind_consistency", "low_noise"],
      featureSentiments: [
        { attribute: "grind", sentiment: "positive", confidence: 0.91, evidenceSnippet: "Very consistent grind" },
        { attribute: "noise", sentiment: "positive", confidence: 0.87, evidenceSnippet: "low noise" },
      ],
      daysAgo: 12,
    },
    {
      customerIndex: 1,
      rating: 4,
      text: "Solid build quality and easy cleaning after use.",
      sentiment: "positive",
      confidence: 0.88,
      trustScore: 0.92,
      tags: ["build_quality", "easy_cleaning"],
      featureSentiments: [
        { attribute: "build", sentiment: "positive", confidence: 0.86, evidenceSnippet: "Solid build quality" },
        { attribute: "maintenance", sentiment: "positive", confidence: 0.82, evidenceSnippet: "easy cleaning" },
      ],
      daysAgo: 11,
    },
    {
      customerIndex: 2,
      rating: 3,
      text: "Works fine but hopper capacity is a bit small for family use.",
      sentiment: "neutral",
      confidence: 0.71,
      trustScore: 0.9,
      tags: ["hopper_capacity"],
      featureSentiments: [
        { attribute: "capacity", sentiment: "neutral", confidence: 0.68, evidenceSnippet: "capacity is a bit small" },
      ],
      daysAgo: 9,
    },
    {
      customerIndex: 3,
      rating: 2,
      text: "Motor heats up after multiple batches and smell appears.",
      sentiment: "negative",
      confidence: 0.9,
      trustScore: 0.87,
      tags: ["motor_heating"],
      featureSentiments: [
        { attribute: "motor", sentiment: "negative", confidence: 0.9, evidenceSnippet: "Motor heats up" },
      ],
      daysAgo: 7,
    },
    {
      customerIndex: 4,
      rating: 4,
      text: "Fast operation and good value for this price segment.",
      sentiment: "positive",
      confidence: 0.86,
      trustScore: 0.93,
      tags: ["speed", "value_for_money"],
      featureSentiments: [
        { attribute: "speed", sentiment: "positive", confidence: 0.84, evidenceSnippet: "Fast operation" },
      ],
      daysAgo: 6,
    },
    {
      customerIndex: 5,
      rating: 5,
      text: "Excellent texture control from coarse to fine settings.",
      sentiment: "positive",
      confidence: 0.91,
      trustScore: 0.95,
      tags: ["texture_control", "settings"],
      featureSentiments: [
        { attribute: "settings", sentiment: "positive", confidence: 0.89, evidenceSnippet: "coarse to fine settings" },
      ],
      daysAgo: 4,
    },
  ]);

  await seedReviewsForProduct(productB._id, customers, [
    {
      customerIndex: 6,
      rating: 5,
      text: "Very comfortable cushioning and super light for long runs.",
      sentiment: "positive",
      confidence: 0.93,
      trustScore: 0.95,
      tags: ["comfort", "lightweight"],
      featureSentiments: [
        { attribute: "comfort", sentiment: "positive", confidence: 0.92, evidenceSnippet: "Very comfortable cushioning" },
      ],
      daysAgo: 10,
    },
    {
      customerIndex: 7,
      rating: 4,
      text: "Grip is reliable and ventilation is good in hot weather.",
      sentiment: "positive",
      confidence: 0.88,
      trustScore: 0.93,
      tags: ["grip", "breathability"],
      featureSentiments: [
        { attribute: "grip", sentiment: "positive", confidence: 0.86, evidenceSnippet: "Grip is reliable" },
        { attribute: "mesh", sentiment: "positive", confidence: 0.83, evidenceSnippet: "ventilation is good" },
      ],
      daysAgo: 9,
    },
    {
      customerIndex: 8,
      rating: 3,
      text: "Average arch support but fine for casual jogging.",
      sentiment: "neutral",
      confidence: 0.69,
      trustScore: 0.89,
      tags: ["arch_support"],
      featureSentiments: [
        { attribute: "arch_support", sentiment: "neutral", confidence: 0.66, evidenceSnippet: "Average arch support" },
      ],
      daysAgo: 8,
    },
    {
      customerIndex: 9,
      rating: 2,
      text: "The sole wears quickly and heel support feels weak.",
      sentiment: "negative",
      confidence: 0.9,
      trustScore: 0.86,
      tags: ["sole_durability", "heel_support"],
      featureSentiments: [
        { attribute: "sole", sentiment: "negative", confidence: 0.9, evidenceSnippet: "sole wears quickly" },
      ],
      daysAgo: 7,
    },
    {
      customerIndex: 10,
      rating: 4,
      text: "Good fit overall and true to size in my case.",
      sentiment: "positive",
      confidence: 0.82,
      trustScore: 0.92,
      tags: ["fit", "sizing"],
      featureSentiments: [
        { attribute: "fit", sentiment: "positive", confidence: 0.81, evidenceSnippet: "Good fit overall" },
      ],
      daysAgo: 5,
    },
    {
      customerIndex: 11,
      rating: 5,
      text: "Great daily trainer with stable landing and responsive feel.",
      sentiment: "positive",
      confidence: 0.9,
      trustScore: 0.94,
      tags: ["stability", "responsiveness"],
      featureSentiments: [
        { attribute: "stability", sentiment: "positive", confidence: 0.88, evidenceSnippet: "stable landing" },
      ],
      daysAgo: 3,
    },
  ]);

  const [productAReviewCount, productBReviewCount] = await Promise.all([
    Review.countDocuments({ productId: productA._id, moderationStatus: { $in: ["approved", "auto_approved"] } }),
    Review.countDocuments({ productId: productB._id, moderationStatus: { $in: ["approved", "auto_approved"] } }),
  ]);

  console.log("\nAdditional Reviews Seed Ready (non-destructive)");
  console.log("Trend product is untouched.");
  console.log(`Seller: ${SELLER_EMAIL} / seller123`);
  console.log(`${productA.name}: ${productAReviewCount} approved reviews`);
  console.log(`${productB.name}: ${productBReviewCount} approved reviews\n`);

  await mongoose.disconnect();
}

seedAdditionalReviews().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
