import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { jsonToCsv } from "@/lib/import-export/csv";
import { ObjectId } from "mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const transactions = await db.collection("transactions").find({ userId: userObjectId }).toArray();

  const data = transactions.map((t) => ({
    Date: t.transactionDate,
    Time: t.transactionTime,
    Type: t.type,
    Amount: t.amount,
    Currency: t.currency,
    Title: t.title,
    Description: t.description || "",
    Subcategory: t.subcategoryId || "",
  }));

  const csv = jsonToCsv(data);
  const fileName = `money_tracker_${new Date().toISOString().substring(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
