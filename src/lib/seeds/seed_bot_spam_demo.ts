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
const SELLER_EMAIL = "seller@echosight.com";
const BOT_PRODUCT_NAME = "PulseBrew Coffee Grinder";
const SPAM_PRODUCT_NAME = "StrideLite Running Shoes";
const CUSTOMER_PREFIX = "botspamcustomer";

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

async function getSeller() {
  const seller = await User.findOne({ email: SELLER_EMAIL, role: "seller" });
  if (!seller) {
    throw new Error(`Seller ${SELLER_EMAIL} not found. Run a base seed first.`);
  }
  return seller;
}

async function getOrCreateCustomers(count: number) {
  const password = await bcrypt.hash("customer123", 10);
  const customers = [];

  for (let i = 1; i <= count; i++) {
    const email = `${CUSTOMER_PREFIX}${i}@echosight.com`;

    const customer = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `BotSpam Customer ${i}`,
          email,
          password,
          role: "customer",
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (!customer) {
      throw new Error(`Failed to create/fetch customer ${email}`);
    }

    customers.push(customer);
  }

  return customers;
}

async function getOrCreateDemoProducts(sellerId: mongoose.Types.ObjectId) {
  const botProduct = await Product.findOneAndUpdate(
    { sellerId, name: BOT_PRODUCT_NAME },
    {
      $setOnInsert: {
        sellerId,
        name: BOT_PRODUCT_NAME,
        description: "Demo product for bot-cluster / duplicate detection showcase.",
        category: "electronics",
        price: 3499,
        imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900",
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const spamProduct = await Product.findOneAndUpdate(
    { sellerId, name: SPAM_PRODUCT_NAME },
    {
      $setOnInsert: {
        sellerId,
        name: SPAM_PRODUCT_NAME,
        description: "Demo product for spam-flagging and moderation queue showcase.",
        category: "clothing",
        price: 2799,
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900",
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!botProduct || !spamProduct) {
    throw new Error("Could not create/fetch demo products");
  }

  return { botProduct, spamProduct };
}

async function seedBotDetectionProduct(
  productId: mongoose.Types.ObjectId,
  customers: mongoose.Document[]
) {
  await Review.deleteMany({ productId });

  const now = Date.now();
  const duplicateText =
    "Free giveaway claim now! This grinder is unbelievable 10000% perfect buy now buy now.";

  const inserted = await Review.insertMany([
    {
      productId,
      customerId: customers[0]._id,
      text: "Consistent grind size and low noise. Great for morning coffee.",
      cleanedText: cleanText("Consistent grind size and low noise. Great for morning coffee."),
      rating: 5,
      overallSentiment: "positive",
      sentimentConfidence: 0.93,
      trustScore: 0.95,
      moderationStatus: "approved",
      isFlagged: false,
      isSpam: false,
      isDuplicate: false,
      isReviewBomb: false,
      bombType: "none",
      tags: ["grind_consistency", "low_noise"],
      featureSentiments: [
        {
          attribute: "grind",
          sentiment: "positive",
          confidence: 0.9,
          evidenceSnippet: "Consistent grind size",
        },
      ],
      createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
    },
    {
      productId,
      customerId: customers[1]._id,
      text: duplicateText,
      cleanedText: cleanText(duplicateText),
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.41,
      trustScore: 0.08,
      moderationStatus: "pending",
      isFlagged: true,
      flagReasons: ["bot_duplicate", "high_risk"],
      isSpam: true,
      isDuplicate: true,
      similarReviews: [],
      isReviewBomb: false,
      bombType: "none",
      tags: ["promotional_spam"],
      reasoning: "High lexical similarity with multiple suspicious promotional reviews.",
      autoApproveAt: new Date(now + 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    },
    {
      productId,
      customerId: customers[2]._id,
      text: duplicateText,
      cleanedText: cleanText(duplicateText),
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.39,
      trustScore: 0.06,
      moderationStatus: "pending",
      isFlagged: true,
      flagReasons: ["bot_duplicate", "cross_product_duplicate", "high_risk"],
      isSpam: true,
      isDuplicate: true,
      similarReviews: [],
      isReviewBomb: false,
      bombType: "none",
      tags: ["promotional_spam"],
      reasoning: "Near-identical text pattern indicates bot farm behavior.",
      autoApproveAt: new Date(now + 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 90 * 60 * 1000),
    },
    {
      productId,
      customerId: customers[3]._id,
      text: duplicateText,
      cleanedText: cleanText(duplicateText),
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.4,
      trustScore: 0.07,
      moderationStatus: "pending",
      isFlagged: true,
      flagReasons: ["bot_duplicate", "spam_velocity", "high_risk"],
      isSpam: true,
      isDuplicate: true,
      similarReviews: [],
      isReviewBomb: false,
      bombType: "none",
      tags: ["promotional_spam"],
      reasoning: "Duplicate burst across multiple accounts in short time window.",
      autoApproveAt: new Date(now + 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 55 * 60 * 1000),
    },
  ]);

  const duplicateIds = inserted.slice(1).map((r) => r._id);

  for (const review of inserted.slice(1)) {
    await Review.findByIdAndUpdate(review._id, {
      duplicateOf: inserted[1]._id,
      similarReviews: duplicateIds.filter((id) => id.toString() !== review._id.toString()),
    });
  }

  return {
    allReviewIds: inserted.map((r) => r._id),
    flaggedReviewIds: duplicateIds,
    duplicateText,
  };
}

async function seedSpamDetectionProduct(
  productId: mongoose.Types.ObjectId,
  customers: mongoose.Document[]
) {
  await Review.deleteMany({ productId });

  const now = Date.now();

  const inserted = await Review.insertMany([
    {
      productId,
      customerId: customers[4]._id,
      text: "Very comfortable and lightweight for daily jogging.",
      cleanedText: cleanText("Very comfortable and lightweight for daily jogging."),
      rating: 4,
      overallSentiment: "positive",
      sentimentConfidence: 0.9,
      trustScore: 0.93,
      moderationStatus: "approved",
      isFlagged: false,
      isSpam: false,
      isDuplicate: false,
      isReviewBomb: false,
      bombType: "none",
      tags: ["comfort", "lightweight"],
      featureSentiments: [
        {
          attribute: "comfort",
          sentiment: "positive",
          confidence: 0.89,
          evidenceSnippet: "Very comfortable",
        },
      ],
      createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    },
    {
      productId,
      customerId: customers[5]._id,
      text: "Click this link for instant cash reward, best shoes guaranteed 200% real offer now!",
      cleanedText: cleanText("Click this link for instant cash reward, best shoes guaranteed 200% real offer now!"),
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.35,
      trustScore: 0.05,
      moderationStatus: "pending",
      isFlagged: true,
      flagReasons: ["high_risk", "spam_velocity"],
      isSpam: true,
      isDuplicate: false,
      similarReviews: [],
      isReviewBomb: false,
      bombType: "none",
      tags: ["promotional_spam"],
      reasoning: "Promotional and incentive wording pattern matched spam classifier.",
      autoApproveAt: new Date(now + 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 70 * 60 * 1000),
    },
    {
      productId,
      customerId: customers[6]._id,
      text: "Limited-time offer! Buy these shoes and get direct payout. Visit private channel now.",
      cleanedText: cleanText("Limited-time offer! Buy these shoes and get direct payout. Visit private channel now."),
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.33,
      trustScore: 0.04,
      moderationStatus: "pending",
      isFlagged: true,
      flagReasons: ["high_risk", "cross_product_duplicate"],
      isSpam: true,
      isDuplicate: false,
      similarReviews: [],
      isReviewBomb: false,
      bombType: "none",
      tags: ["promotional_spam"],
      reasoning: "Commercial solicitation style does not align with genuine product review language.",
      autoApproveAt: new Date(now + 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 50 * 60 * 1000),
    },
    {
      productId,
      customerId: customers[7]._id,
      text: "Guaranteed profit if you purchase through referral code, do it now.",
      cleanedText: cleanText("Guaranteed profit if you purchase through referral code, do it now."),
      rating: 5,
      overallSentiment: "neutral",
      sentimentConfidence: 0.31,
      trustScore: 0.03,
      moderationStatus: "pending",
      isFlagged: true,
      flagReasons: ["high_risk", "account_manipulation"],
      isSpam: true,
      isDuplicate: false,
      similarReviews: [],
      isReviewBomb: false,
      bombType: "none",
      tags: ["promotional_spam"],
      reasoning: "Referral-based financial promise pattern is classified as spam/manipulation.",
      autoApproveAt: new Date(now + 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 40 * 60 * 1000),
    },
  ]);

  return {
    allReviewIds: inserted.map((r) => r._id),
    flaggedReviewIds: inserted.slice(1).map((r) => r._id),
  };
}

async function seedAlerts(
  sellerId: mongoose.Types.ObjectId,
  botProductId: mongoose.Types.ObjectId,
  spamProductId: mongoose.Types.ObjectId,
  botFlaggedReviewIds: mongoose.Types.ObjectId[],
  spamFlaggedReviewIds: mongoose.Types.ObjectId[]
) {
  await Alert.deleteMany({
    relatedProductId: { $in: [botProductId, spamProductId] },
    type: "flagged_review",
  });

  await Alert.insertMany([
    {
      recipientRole: "admin",
      type: "flagged_review",
      title: "Bot duplicate cluster detected",
      message: "Multiple near-identical reviews detected on PulseBrew Coffee Grinder.",
      relatedProductId: botProductId,
      relatedReviewIds: botFlaggedReviewIds,
      isRead: false,
    },
    {
      recipientRole: "seller",
      recipientId: sellerId,
      type: "flagged_review",
      title: "Spam reviews flagged on StrideLite Running Shoes",
      message: "High-risk promotional reviews were held for moderation.",
      relatedProductId: spamProductId,
      relatedReviewIds: spamFlaggedReviewIds,
      isRead: false,
    },
  ]);
}

async function seedBotSpamDemo() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);

  const seller = await getSeller();
  const customers = await getOrCreateCustomers(10);
  const { botProduct, spamProduct } = await getOrCreateDemoProducts(seller._id);

  const botResult = await seedBotDetectionProduct(botProduct._id, customers as mongoose.Document[]);
  const spamResult = await seedSpamDetectionProduct(spamProduct._id, customers as mongoose.Document[]);

  await seedAlerts(
    seller._id,
    botProduct._id,
    spamProduct._id,
    botResult.flaggedReviewIds,
    spamResult.flaggedReviewIds
  );

  const [botApproved, botPending, spamApproved, spamPending] = await Promise.all([
    Review.countDocuments({ productId: botProduct._id, moderationStatus: { $in: ["approved", "auto_approved"] } }),
    Review.countDocuments({ productId: botProduct._id, moderationStatus: "pending" }),
    Review.countDocuments({ productId: spamProduct._id, moderationStatus: { $in: ["approved", "auto_approved"] } }),
    Review.countDocuments({ productId: spamProduct._id, moderationStatus: "pending" }),
  ]);

  console.log("\nBot/Spam Demo Seed Ready (non-destructive)");
  console.log("Trend analytics product is untouched.");
  console.log(`Seller: ${SELLER_EMAIL} / seller123`);
  console.log(`${BOT_PRODUCT_NAME}: ${botApproved} approved, ${botPending} pending flagged`);
  console.log(`${SPAM_PRODUCT_NAME}: ${spamApproved} approved, ${spamPending} pending flagged`);
  console.log("\nBot duplicate sample text to test rejection:");
  console.log(botResult.duplicateText);
  console.log("\nDemo customer logins: botspamcustomer1..10@echosight.com / customer123\n");

  await mongoose.disconnect();
}

seedBotSpamDemo().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
