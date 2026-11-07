import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getUserFinancialContext, callGroqChat } from "@/lib/groq";

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const context = await getUserFinancialContext(db, session.id);

    // Calculate baseline recommended budgets based on 50/30/20 rule or historical category spends
    const recommendedBudgets = context.categoryBreakdown.map((cat) => {
      // Recommend a 10% optimization buffer for discretionary categories
      const recommended = Math.max(500, Math.round((cat.amount * 0.9) / 100) * 100);
      return {
        categoryName: cat.name,
        currentSpend: cat.amount,
        recommendedAmount: recommended,
        suggestedReduction: Math.max(0, cat.amount - recommended),
        period: "MONTHLY",
        tip: `Cap ${cat.name} spending at ${context.currency} ${recommended} to free up more savings.`,
      };
    });

    const savingsGoalSuggestion = {
      title: "Emergency & Growth Fund",
      suggestedMonthlySavings: Math.max(
        1000,
        Math.round((context.monthlyIncome > 0 ? context.monthlyIncome * 0.2 : 2000) / 100) * 100
      ),
      targetAmount: Math.max(
        10000,
        Math.round((context.monthlyExpense > 0 ? context.monthlyExpense * 3 : 15000) / 500) * 500
      ),
      notes: "3-Month essential expense buffer recommended by financial guidelines.",
    };

    // Prompt Groq for personalized advice
    const systemPrompt = "You are an expert financial planner. Give 3 short, concrete bullet points on optimizing monthly budget allocations.";
    const userPrompt = `Income: ${context.currency} ${context.monthlyIncome}. Expenses: ${context.currency} ${context.monthlyExpense}. Top spends: ${context.categoryBreakdown.map((c) => `${c.name}: ${c.amount}`).join(", ")}.`;

    const aiAdvice = await callGroqChat(systemPrompt, userPrompt);

    return NextResponse.json({
      success: true,
      currency: context.currency,
      advice: aiAdvice || "1. Set category limits to control discretionary spending.\n2. Automate transfers of 20% of your income into savings right when you receive it.\n3. Track daily micro-expenses to identify hidden leaks.",
      recommendedBudgets,
      savingsGoalSuggestion,
    });
  } catch (error) {
    console.error("AI budget planner error:", error);
    return NextResponse.json({ error: "Failed to generate budget plan" }, { status: 500 });
  }
}
