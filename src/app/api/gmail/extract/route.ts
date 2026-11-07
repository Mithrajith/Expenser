import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No email messages provided" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const amountRegex = /(?:INR|Rs\.?|₹)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/i;
    const refRegex = /(?:Ref\s*(?:no\.?|id)?|UTR(?:\s*no\.?)?|Order\s*ID|Txn\s*ID)\s*[:/-]?\s*([0-9A-Za-z_-]{6,30})/i;
    const accountRegex = /(?:A\/C|Acct|Account|Card)\s*(?:ending\s*)?(?:in\s*)?[xX*]*([0-9]{3,6})/i;

    const extractedTransactions = [];

    for (const msg of messages) {
      const text = `${msg.subject || ""} ${msg.snippet || ""}`.trim();
      const lower = text.toLowerCase();

      const isDebit = lower.includes("debited") || lower.includes("paid") || lower.includes("receipt") || lower.includes("order confirmed");
      const isCredit = lower.includes("credited") || lower.includes("refund") || lower.includes("received");

      if (!isDebit && !isCredit) continue;

      const amtMatch = text.match(amountRegex);
      if (!amtMatch) continue;

      const amtNum = parseFloat(amtMatch[1].replace(/,/g, ""));
      if (isNaN(amtNum) || amtNum <= 0) continue;

      const refMatch = text.match(refRegex);
      const reference = refMatch ? refMatch[1].trim() : null;

      const accMatch = text.match(accountRegex);
      const bankHint = accMatch ? accMatch[1].trim() : null;

      // Check duplicate against existing transactions
      let isDuplicate = false;
      if (reference) {
        const dup = await db.collection("transactions").findOne({
          userId: userObjectId,
          $or: [{ reference }, { description: { $regex: reference, $options: "i" } }],
        });
        if (dup) isDuplicate = true;
      }

      extractedTransactions.push({
        id: msg.id || new ObjectId().toString(),
        sourceMessageId: msg.id || null,
        title: (msg.subject || "Gmail Transaction").substring(0, 60),
        amount: amtNum,
        currency: "INR",
        type: isCredit ? "INCOME" : "EXPENSE",
        transactionDate: msg.date ? new Date(msg.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        transactionTime: "12:00",
        merchant: msg.from || "Gmail",
        reference,
        bankAccountHint: bankHint,
        description: text.substring(0, 200),
        confidence: 0.9,
        isDuplicate,
        requiresReview: true,
      });
    }

    return NextResponse.json({
      success: true,
      count: extractedTransactions.length,
      transactions: extractedTransactions,
    });
  } catch (error) {
    console.error("Gmail extract error:", error);
    return NextResponse.json({ error: "Failed to extract Gmail transactions" }, { status: 500 });
  }
}
