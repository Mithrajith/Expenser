import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getUserFinancialContext, callGroqChat } from "@/lib/groq";

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const userMessage = body.message || body.prompt;

    if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
      return NextResponse.json({ error: "Message prompt is required" }, { status: 400 });
    }

    const db = await getDb();
    const context = await getUserFinancialContext(db, session.id);

    const systemPrompt = `You are Expenser AI, an intelligent, empathetic, and concise personal financial assistant.
You have verified access to the user's live financial data:
- User Name: ${session.name}
- Currency: ${context.currency}
- Total Account Balance: ${context.currency} ${context.totalBalance.toFixed(2)}
- Current Month Income: ${context.currency} ${context.monthlyIncome.toFixed(2)}
- Current Month Expense: ${context.currency} ${context.monthlyExpense.toFixed(2)}
- Net Monthly Savings: ${context.currency} ${context.netSavings.toFixed(2)} (${context.savingsRate}% savings rate)
- Top Spending Categories: ${context.categoryBreakdown.map((c) => `${c.name}: ${context.currency} ${c.amount} (${c.percentage}%)`).join(", ") || "None recorded yet"}
- Recent Transactions: ${context.recentTransactions.map((t) => `${t.date} - ${t.title}: ${context.currency} ${t.amount} (${t.type})`).join("; ") || "None"}

Rules:
1. Ground answers strictly in the user's financial figures above.
2. Offer actionable, practical advice for saving and budgeting.
3. Keep answers concise, clear, and easy to read on mobile devices (use bullet points when appropriate).
4. Do not make up transactions that are not listed.`;

    const aiResponse = await callGroqChat(systemPrompt, userMessage);

    let reply = aiResponse;
    if (!reply) {
      // Deterministic smart algorithmic fallback if Groq API key is not yet set up
      const q = userMessage.toLowerCase();
      if (q.includes("balance") || q.includes("how much do i have")) {
        reply = `Your total available balance across all accounts is **${context.currency} ${context.totalBalance.toFixed(2)}**.`;
      } else if (q.includes("spend") || q.includes("spent") || q.includes("expense")) {
        reply = `This month, you have spent **${context.currency} ${context.monthlyExpense.toFixed(2)}**. Your top category is **${context.categoryBreakdown[0]?.name || "General"}** (${context.currency} ${context.categoryBreakdown[0]?.amount?.toFixed(2) || "0.00"}).`;
      } else if (q.includes("save") || q.includes("saving")) {
        reply = `Your current savings rate is **${context.savingsRate}%** (${context.currency} ${context.netSavings.toFixed(2)} saved this month). Aiming for at least 20% is recommended.`;
      } else {
        reply = `Hello ${session.name}! So far this month you have recorded ${context.currency} ${context.monthlyIncome.toFixed(2)} in income and ${context.currency} ${context.monthlyExpense.toFixed(2)} in expenses, leaving a net balance of ${context.currency} ${context.netSavings.toFixed(2)}. How can I assist with your budget today?`;
      }
    }

    return NextResponse.json({
      success: true,
      reply,
      context: {
        totalBalance: context.totalBalance,
        monthlyExpense: context.monthlyExpense,
        monthlyIncome: context.monthlyIncome,
        savingsRate: context.savingsRate,
      },
    });
  } catch (error) {
    console.error("AI assistant error:", error);
    return NextResponse.json({ error: "Failed to process AI assistant request" }, { status: 500 });
  }
}
