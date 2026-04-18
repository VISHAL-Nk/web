import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth";

// POST — Customer product Q&A (agentic AI)
export const POST = withRole(["customer"], async (req, { user }) => {
  const body = await req.json();
  const { productId, question, sessionId } = body;

  const normalizedProductId = typeof productId === "string" ? productId.trim() : "";
  const normalizedQuestion = typeof question === "string" ? question.trim() : "";

  if (!normalizedProductId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  if (!normalizedQuestion || normalizedQuestion.length < 3) {
    return NextResponse.json(
      { error: "Please ask a complete question (minimum 3 characters)." },
      { status: 400 }
    );
  }

  if (normalizedQuestion.length > 500) {
    return NextResponse.json(
      { error: "Question is too long. Please keep it under 500 characters." },
      { status: 400 }
    );
  }

  const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:8000";

  try {
    const aiResponse = await fetch(`${aiEngineUrl}/api/customer-qa/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: normalizedProductId,
        question: normalizedQuestion,
        customer_id: user.userId,
        session_id: typeof sessionId === "string" ? sessionId : undefined,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return NextResponse.json(
        {
          error: "Unable to answer right now. Please try again.",
          details: errText.slice(0, 240),
        },
        { status: 502 }
      );
    }

    const result = await aiResponse.json();
    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error("Customer Q&A route error:", error);
    return NextResponse.json(
      {
        error: "Q&A service is temporarily unavailable. Please try again shortly.",
      },
      { status: 502 }
    );
  }
});
