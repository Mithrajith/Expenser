import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // YYYY-MM
  const now = new Date();
  const currentMonthStr = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  // 1. Fetch total current balance across accounts
  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const totalBalance = accounts.reduce((acc, a) => acc + (a.currentBalance ?? a.openingBalance ?? 0), 0);

  // 2. Fetch monthly totals (Income vs Expense)
  const monthRegex = new RegExp(`^${currentMonthStr}`);
  const monthlyStats = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        transactionDate: { $regex: monthRegex },
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]).toArray();

  let income = 0;
  let expense = 0;

  for (const stat of monthlyStats) {
    if (stat._id === "INCOME") income = stat.total;
    if (stat._id === "EXPENSE") expense = stat.total;
  }

  const net = income - expense;

  // 3. Previous month for trend comparison
  const [yearStr, mStr] = currentMonthStr.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(mStr, 10);
  const prevDate = new Date(year, m - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const prevMonthStats = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        transactionDate: { $regex: new RegExp(`^${prevMonthStr}`) },
        type: "EXPENSE",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]).toArray();

  const prevExpense = prevMonthStats[0]?.total || 0;
  let percentChange = 0;
  if (prevExpense > 0) {
    percentChange = Math.round(((expense - prevExpense) / prevExpense) * 100);
  } else if (prevExpense === 0 && expense > 0) {
    percentChange = 100;
  }
  if (isNaN(percentChange)) percentChange = 0;

  // 4. Expense by Category for Donut Chart
  const categoryExpenses = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        type: "EXPENSE",
        transactionDate: { $regex: monthRegex },
      },
    },
    {
      $group: {
        _id: "$categoryId",
        total: { $sum: "$amount" },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $project: {
        categoryId: "$_id",
        total: 1,
        name: { $ifNull: [{ $arrayElemAt: ["$category.name", 0] }, "Uncategorized"] },
        color: { $ifNull: [{ $arrayElemAt: ["$category.color", 0] }, "#6B7280"] },
        icon: { $ifNull: [{ $arrayElemAt: ["$category.icon", 0] }, "Tag"] },
      },
    },
    { $sort: { total: -1 } },
  ]).toArray();

  return NextResponse.json({
    selectedMonth: currentMonthStr,
    totalBalance,
    income,
    expense,
    net,
    percentChange,
    categoryExpenses,
  });
}
