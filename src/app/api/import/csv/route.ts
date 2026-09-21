import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { csvToJson } from "@/lib/import-export/csv";
import { recalculateAllUserBalances } from "@/lib/balance";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });

    const text = await file.text();
    const rows = csvToJson(text);

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
    let defaultAccId = accounts[0]?._id;
    if (!defaultAccId) {
      const newAcc = await db.collection("accounts").insertOne({
        userId: userObjectId,
        name: "CSV Account",
        type: "BANK",
        currency: "INR",
        openingBalance: 0,
        currentBalance: 0,
        createdAt: new Date(),
      });
      defaultAccId = newAcc.insertedId;
    }

    let importedCount = 0;

    for (const row of rows) {
      const amount = parseFloat(row.Amount || row.amount || "0");
      if (amount <= 0) continue;

      const title = row.Title || row.title || row.Description || row.description || "CSV Import";
      const date = row.Date || row.date || new Date().toISOString().substring(0, 10);
      const type = (row.Type || row.type || "EXPENSE").toUpperCase();

      await db.collection("transactions").insertOne({
        userId: userObjectId,
        type,
        amount,
        currency: row.Currency || row.currency || "INR",
        accountId: defaultAccId,
        subcategoryId: row.Subcategory || row.subcategory || "",
        title,
        description: row.Description || row.description || "",
        transactionDate: date,
        transactionTime: "12:00",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      importedCount++;
    }

    await recalculateAllUserBalances(db, session.id);

    return NextResponse.json({ success: true, importedCount });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Failed to import CSV file" }, { status: 500 });
  }
}
