import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { generateSqliteExport } from "@/lib/import-export/sqlite";
import { ObjectId } from "mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const transactions = await db.collection("transactions").find({ userId: userObjectId }).toArray();
  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();
  const user = await db.collection("users").findOne({ _id: userObjectId });

  const buffer = await generateSqliteExport(transactions, accounts, categories, {
    baseCurrency: user?.baseCurrency || "INR",
  });

  const fileName = `money_tracker_${new Date().toISOString().substring(0, 10)}.db`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
