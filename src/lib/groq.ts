import { Db, ObjectId } from "mongodb";

export interface UserFinancialSummary {
  currency: string;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  netSavings: number;
  savingsRate: number;
  categoryBreakdown: { name: string; amount: number; percentage: number }[];
  recentTransactions: { title: string; amount: number; type: string; date: string; category?: string }[];
}

export async function getUserFinancialContext(db: Db, userId: string): Promise<UserFinancialSummary> {
  const userObjectId = new ObjectId(userId);
  const user = await db.collection("users").findOne({ _id: userObjectId });
  const currency = user?.baseCurrency || "INR";

  // Calculate total balance from all accounts
  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const totalBalance = accounts.reduce((sum, a) => sum + (a.currentBalance || a.balance || 0), 0);

  // Time window: current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const transactions = await db
    .collection("transactions")
    .find({
      userId: userObjectId,
      transactionDate: { $gte: startOfMonth, $lte: endOfMonth },
    })
    .sort({ transactionDate: -1, transactionTime: -1 })
    .toArray();

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  const categoryMap = new Map<string, number>();

  // Fetch categories for name lookup
  const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();
  const catNameMap = new Map<string, string>();
  for (const c of categories) {
    catNameMap.set(c._id.toString(), c.name);
  }

  for (const t of transactions) {
    const amt = typeof t.amount === "number" ? t.amount : 0;
    if (t.type === "INCOME") {
      monthlyIncome += amt;
    } else if (t.type === "EXPENSE") {
      monthlyExpense += amt;
      const catName = t.categoryId ? catNameMap.get(t.categoryId.toString()) || "Other" : "Other";
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + amt);
    }
  }

  const netSavings = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? Math.max(0, Math.round((netSavings / monthlyIncome) * 100)) : 0;

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: monthlyExpense > 0 ? Math.round((amount / monthlyExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const recentTransactions = transactions.slice(0, 10).map((t) => ({
    title: t.title,
    amount: t.amount,
    type: t.type,
    date: t.transactionDate,
    category: t.categoryId ? catNameMap.get(t.categoryId.toString()) : undefined,
  }));

  return {
    currency,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    netSavings,
    savingsRate,
    categoryBreakdown,
    recentTransactions,
  };
}

export async function callGroqChat(
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      console.warn("Groq API error status:", response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.warn("Groq fetch failed:", err);
    return null;
  }
}
