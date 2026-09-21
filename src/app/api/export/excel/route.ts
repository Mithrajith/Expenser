import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { generateExcelWorkbook } from "@/lib/import-export/excel";
import { ObjectId } from "mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const transactions = await db.collection("transactions").find({ userId: userObjectId }).toArray();
  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();

  const formattedTransactions = transactions.map((t) => ({
    ID: t._id.toString(),
    Date: t.transactionDate,
    Time: t.transactionTime,
    Type: t.type,
    Amount: t.amount,
    Currency: t.currency,
    Title: t.title,
    Description: t.description,
    AccountID: t.accountId?.toString() || "",
    CategoryID: t.categoryId?.toString() || "",
    Subcategory: t.subcategoryId || "",
  }));

  const formattedAccounts = accounts.map((a) => ({
    ID: a._id.toString(),
    Name: a.name,
    Type: a.type,
    Currency: a.currency,
    OpeningBalance: a.openingBalance || 0,
    CurrentBalance: a.currentBalance || 0,
  }));

  const formattedCategories = categories.map((c) => ({
    ID: c._id.toString(),
    Name: c.name,
    Type: c.type,
    Subcategories: (c.subcategories || []).join(", "),
  }));

  const summary = [
    { Item: "Total Transactions", Value: transactions.length },
    { Item: "Total Accounts", Value: accounts.length },
    { Item: "Total Categories", Value: categories.length },
  ];

  const buffer = generateExcelWorkbook(
    formattedTransactions,
    formattedAccounts,
    formattedCategories,
    summary
  );

  const fileName = `money_tracker_${new Date().toISOString().substring(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
