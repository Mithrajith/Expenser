import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  // Get last 7 days date strings
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const startDate = days[0];
  const endDate = days[6];

  const transactions = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        transactionDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { date: "$transactionDate", type: "$type" },
        total: { $sum: "$amount" },
      },
    },
  ]).toArray();

  const dailyDataMap: Record<string, { income: number; expense: number }> = {};
  days.forEach((day) => {
    dailyDataMap[day] = { income: 0, expense: 0 };
  });

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    const day = tx._id.date;
    const type = tx._id.type;
    if (dailyDataMap[day]) {
      if (type === "INCOME") {
        dailyDataMap[day].income += tx.total;
        totalIncome += tx.total;
      } else if (type === "EXPENSE") {
        dailyDataMap[day].expense += tx.total;
        totalExpense += tx.total;
      }
    }
  }

  const dailyBreakdown = days.map((day) => ({
    date: day,
    dayName: new Date(day).toLocaleDateString("en-US", { weekday: "short" }),
    income: dailyDataMap[day].income,
    expense: dailyDataMap[day].expense,
    net: dailyDataMap[day].income - dailyDataMap[day].expense,
  }));

  const avgDailySpending = Math.round(totalExpense / 7);

  return NextResponse.json({
    startDate,
    endDate,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    avgDailySpending,
    dailyBreakdown,
  });
}
