import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { seedUserData } from "@/lib/default-data";
import { recalculateAllUserBalances } from "@/lib/balance";
import { ObjectId } from "mongodb";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed API is disabled in production" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userId = session.id;
  const userObjectId = new ObjectId(userId);

  // Ensure user categories & accounts exist
  await seedUserData(db, userId);

  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();

  const bankAcc = accounts.find((a) => a.type === "BANK")?._id || accounts[0]._id;
  const cashAcc = accounts.find((a) => a.type === "CASH")?._id || accounts[1]._id;

  const foodCat = categories.find((c) => c.name === "Food")?._id;
  const transportCat = categories.find((c) => c.name === "Transport")?._id;
  const shoppingCat = categories.find((c) => c.name === "Shopping")?._id;
  const salaryCat = categories.find((c) => c.name === "Salary")?._id;
  const freelanceCat = categories.find((c) => c.name === "Freelance")?._id;

  // Insert sample transactions across recent dates
  const sampleTransactions = [
    {
      userId: userObjectId,
      type: "INCOME",
      amount: 32500,
      currency: "INR",
      accountId: bankAcc,
      categoryId: salaryCat,
      subcategoryId: "Full-time",
      title: "Monthly Salary",
      description: "September salary credit",
      transactionDate: "2026-09-01",
      transactionTime: "09:00",
      createdAt: new Date(),
    },
    {
      userId: userObjectId,
      type: "INCOME",
      amount: 2000,
      currency: "INR",
      accountId: bankAcc,
      categoryId: freelanceCat,
      subcategoryId: "Client Project",
      title: "Freelance Payment",
      description: "UI Design client milestone",
      transactionDate: "2026-09-20",
      transactionTime: "16:30",
      createdAt: new Date(),
    },
    {
      userId: userObjectId,
      type: "EXPENSE",
      amount: 120,
      currency: "INR",
      accountId: bankAcc,
      categoryId: foodCat,
      subcategoryId: "Lunch",
      title: "College Lunch",
      description: "Campus cafeteria meal",
      transactionDate: "2026-09-21",
      transactionTime: "13:20",
      createdAt: new Date(),
    },
    {
      userId: userObjectId,
      type: "EXPENSE",
      amount: 40,
      currency: "INR",
      accountId: cashAcc,
      categoryId: transportCat,
      subcategoryId: "Bus",
      title: "Bus Fare",
      description: "Daily city transit",
      transactionDate: "2026-09-21",
      transactionTime: "09:10",
      createdAt: new Date(),
    },
    {
      userId: userObjectId,
      type: "EXPENSE",
      amount: 850,
      currency: "INR",
      accountId: bankAcc,
      categoryId: shoppingCat,
      subcategoryId: "Electronics",
      title: "Wireless Earbuds",
      description: "Replacement audio gear",
      transactionDate: "2026-09-18",
      transactionTime: "18:45",
      createdAt: new Date(),
    },
    {
      userId: userObjectId,
      type: "TRANSFER",
      amount: 2000,
      currency: "INR",
      accountId: bankAcc,
      toAccountId: cashAcc,
      title: "ATM Withdrawal",
      description: "Cash top-up",
      transactionDate: "2026-09-15",
      transactionTime: "11:00",
      createdAt: new Date(),
    },
  ];

  await db.collection("transactions").insertMany(sampleTransactions);
  await recalculateAllUserBalances(db, userId);

  return NextResponse.json({ success: true, seededCount: sampleTransactions.length });
}
