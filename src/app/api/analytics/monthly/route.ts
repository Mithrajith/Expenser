import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const monthParam = searchParams.get("month") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const monthRegex = new RegExp(`^${monthParam}`);

  // 1. Monthly totals
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
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  let income = 0;
  let expense = 0;
  let txCount = 0;

  for (const s of monthlyStats) {
    txCount += s.count;
    if (s._id === "INCOME") income = s.total;
    if (s._id === "EXPENSE") expense = s.total;
  }

  const net = income - expense;
  const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

  // 2. Daily spending array for chart
  const dailySpending = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        type: "EXPENSE",
        transactionDate: { $regex: monthRegex },
      },
    },
    {
      $group: {
        _id: "$transactionDate",
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  // 3. Category & Subcategory breakdown
  const categoryBreakdown = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        type: "EXPENSE",
        transactionDate: { $regex: monthRegex },
      },
    },
    {
      $group: {
        _id: { categoryId: "$categoryId", subcategory: "$subcategoryId" },
        amount: { $sum: "$amount" },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $project: {
        categoryId: "$_id.categoryId",
        subcategory: "$_id.subcategory",
        amount: 1,
        categoryName: { $ifNull: [{ $arrayElemAt: ["$category.name", 0] }, "Uncategorized"] },
        color: { $ifNull: [{ $arrayElemAt: ["$category.color", 0] }, "#6B7280"] },
      },
    },
    { $sort: { amount: -1 } },
  ]).toArray();

  // 4. Month comparison (Last 3 months)
  const monthComparison: { month: string; income: number; expense: number; net: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mLabel = d.toLocaleDateString("en-US", { month: "short" });

    const stats = await db.collection("transactions").aggregate([
      {
        $match: {
          userId: userObjectId,
          transactionDate: { $regex: new RegExp(`^${mKey}`) },
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]).toArray();

    let mInc = 0;
    let mExp = 0;
    for (const s of stats) {
      if (s._id === "INCOME") mInc = s.total;
      if (s._id === "EXPENSE") mExp = s.total;
    }

    monthComparison.push({
      month: mLabel,
      income: mInc,
      expense: mExp,
      net: mInc - mExp,
    });
  }

  return NextResponse.json({
    month: monthParam,
    income,
    expense,
    net,
    savingsRate,
    txCount,
    dailySpending: dailySpending.map((d) => ({ date: d._id, amount: d.amount })),
    categoryBreakdown,
    monthComparison,
  });
}
