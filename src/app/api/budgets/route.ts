import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { BudgetSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const budgets = await db.collection("budgets").find({ userId: userObjectId }).toArray();

    // Calculate current spending against each budget for the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const enrichedBudgets = await Promise.all(
      budgets.map(async (b) => {
        const query: Record<string, unknown> = {
          userId: userObjectId,
          type: "EXPENSE",
          transactionDate: { $gte: startOfMonth, $lte: endOfMonth },
        };
        if (b.categoryId) {
          query.categoryId = new ObjectId(b.categoryId);
        }

        const stats = await db
          .collection("transactions")
          .aggregate([{ $match: query }, { $group: { _id: null, totalSpent: { $sum: "$amount" } } }])
          .toArray();

        const spent = stats[0]?.totalSpent || 0;
        return {
          id: b._id.toString(),
          name: b.name,
          amount: b.amount,
          spent,
          remaining: Math.max(0, b.amount - spent),
          percentage: Math.min(100, Math.round((spent / b.amount) * 100)),
          period: b.period || "MONTHLY",
          categoryId: b.categoryId ? b.categoryId.toString() : null,
          alertThreshold: b.alertThreshold || 80,
          createdAt: b.createdAt,
        };
      })
    );

    return NextResponse.json({ success: true, budgets: enrichedBudgets });
  } catch (error) {
    console.error("Fetch budgets error:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = BudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const doc = {
      userId: userObjectId,
      name: parsed.data.name,
      amount: parsed.data.amount,
      period: parsed.data.period,
      categoryId: parsed.data.categoryId ? new ObjectId(parsed.data.categoryId) : null,
      alertThreshold: parsed.data.alertThreshold,
      startDate: parsed.data.startDate || null,
      endDate: parsed.data.endDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection("budgets").insertOne(doc);
    return NextResponse.json({
      success: true,
      budget: { id: res.insertedId.toString(), ...doc, userId: session.id },
    });
  } catch (error) {
    console.error("Create budget error:", error);
    return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
  }
}
