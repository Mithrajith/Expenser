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

    // Backend financial calculations
    const insights = [];

    // 1. Savings rate analysis
    if (context.savingsRate >= 30) {
      insights.push({
        type: "POSITIVE",
        title: "Strong Savings Momentum",
        description: `You are saving ${context.savingsRate}% of your income this month (${context.currency} ${context.netSavings.toFixed(2)}). Great discipline!`,
      });
    } else if (context.savingsRate > 0) {
      insights.push({
        type: "INFO",
        title: "Moderate Savings",
        description: `Your savings rate is ${context.savingsRate}%. Increasing this to 20-30% will accelerate your financial goals.`,
      });
    } else if (context.monthlyExpense > context.monthlyIncome && context.monthlyIncome > 0) {
      insights.push({
        type: "WARNING",
        title: "Expenses Exceed Income",
        description: `You have spent ${context.currency} ${(context.monthlyExpense - context.monthlyIncome).toFixed(2)} more than your income this month. Review non-essential spending.`,
      });
    }

    // 2. Category concentration analysis
    if (context.categoryBreakdown.length > 0) {
      const top = context.categoryBreakdown[0];
      if (top.percentage >= 40) {
        insights.push({
          type: "WARNING",
          title: `High Spending in ${top.name}`,
          description: `${top.name} represents ${top.percentage}% (${context.currency} ${top.amount.toFixed(2)}) of your total expenses this month.`,
        });
      } else {
        insights.push({
          type: "INFO",
          title: `Primary Expense: ${top.name}`,
          description: `Your highest expenditure category this month is ${top.name} at ${context.currency} ${top.amount.toFixed(2)} (${top.percentage}%).`,
        });
      }
    }

    // 3. AI Groq Narrative Summary
    const systemPrompt = "You are a senior financial advisor analyzing personal spending trends. Write a concise 2-sentence summary of the user's spending habits and a single actionable recommendation.";
    const userPrompt = `Currency: ${context.currency}. Income: ${context.monthlyIncome}. Expense: ${context.monthlyExpense}. Top categories: ${context.categoryBreakdown.map((c) => `${c.name} (${c.percentage}%)`).join(", ")}.`;

    const aiSummary = await callGroqChat(systemPrompt, userPrompt);

    return NextResponse.json({
      success: true,
      summary: aiSummary || `You have spent ${context.currency} ${context.monthlyExpense.toFixed(2)} across ${context.categoryBreakdown.length} categories this month with a net balance of ${context.currency} ${context.netSavings.toFixed(2)}.`,
      insights,
      categoryBreakdown: context.categoryBreakdown,
      metrics: {
        totalBalance: context.totalBalance,
        monthlyIncome: context.monthlyIncome,
        monthlyExpense: context.monthlyExpense,
        netSavings: context.netSavings,
        savingsRate: context.savingsRate,
      },
    });
  } catch (error) {
    console.error("AI insights error:", error);
    return NextResponse.json({ error: "Failed to generate financial insights" }, { status: 500 });
  }
}
