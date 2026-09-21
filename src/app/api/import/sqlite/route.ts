import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { parseSqliteBuffer } from "@/lib/import-export/sqlite";
import { recalculateAllUserBalances } from "@/lib/balance";
import { ObjectId } from "mongodb";

function parseDateStr(rawWdate: unknown, rawZdate: unknown): { date: string; time: string } {
  const defaultDate = new Date().toISOString().substring(0, 10);
  const defaultTime = "12:00";

  if (typeof rawWdate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawWdate)) {
    return { date: rawWdate, time: defaultTime };
  }

  if (typeof rawZdate === "number" || (typeof rawZdate === "string" && !isNaN(Number(rawZdate)))) {
    const ts = Number(rawZdate);
    if (ts > 0) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
      }
    }
  }

  return { date: defaultDate, time: defaultTime };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No .db file uploaded" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const { tables, tableData } = await parseSqliteBuffer(arrayBuffer);

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    let importedCount = 0;
    let duplicateCount = 0;

    // Detect if this is Money Manager Android SQLite database (has INOUTCOME table)
    const isMoneyManagerAndroid = Boolean(tableData.INOUTCOME || tableData.inoutcome);

    if (isMoneyManagerAndroid) {
      const inoutcomeRows = tableData.INOUTCOME || tableData.inoutcome || [];
      const assetRows = tableData.ASSETS || tableData.assets || [];
      const categoryRows = tableData.ZCATEGORY || tableData.zcategory || [];

      // 1. Build map for Money Manager Accounts (ASSETS)
      const sqliteAssetMap = new Map<string, string>(); // assetUid -> NIC_NAME
      for (const assetRow of assetRows) {
        const uid = String(assetRow.uid || assetRow.ID || "");
        const name = String(assetRow.NIC_NAME || assetRow.name || "Account").trim();
        if (uid) sqliteAssetMap.set(uid, name);
      }

      // 2. Build map for Money Manager Categories (ZCATEGORY)
      const sqliteCategoryMap = new Map<string, string>(); // ctgUid -> NAME
      for (const catRow of categoryRows) {
        const uid = String(catRow.uid || catRow.ID || "");
        const name = String(catRow.NAME || catRow.name || "General").trim();
        if (uid) sqliteCategoryMap.set(uid, name);
      }

      // 3. Upsert Accounts into User MongoDB
      const mongoAccountMap = new Map<string, ObjectId>();
      const existingAccounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
      existingAccounts.forEach((a) => mongoAccountMap.set(a.name.toLowerCase().trim(), a._id));

      for (const [, accName] of sqliteAssetMap.entries()) {
        if (!mongoAccountMap.has(accName.toLowerCase())) {
          const res = await db.collection("accounts").insertOne({
            userId: userObjectId,
            name: accName,
            type: "BANK",
            currency: "INR",
            openingBalance: 0,
            currentBalance: 0,
            createdAt: new Date(),
          });
          mongoAccountMap.set(accName.toLowerCase(), res.insertedId);
        }
      }

      // 4. Upsert Categories into User MongoDB
      const mongoCategoryMap = new Map<string, ObjectId>();
      const existingCategories = await db.collection("categories").find({ userId: userObjectId }).toArray();
      existingCategories.forEach((c) => mongoCategoryMap.set(c.name.toLowerCase().trim(), c._id));

      for (const [, catName] of sqliteCategoryMap.entries()) {
        if (!mongoCategoryMap.has(catName.toLowerCase())) {
          const res = await db.collection("categories").insertOne({
            userId: userObjectId,
            name: catName,
            type: "EXPENSE",
            icon: "Tag",
            color: "#3B82F6",
            subcategories: [],
            createdAt: new Date(),
          });
          mongoCategoryMap.set(catName.toLowerCase(), res.insertedId);
        }
      }

      // Fallback Account
      let fallbackAccId = existingAccounts[0]?._id;
      if (!fallbackAccId && mongoAccountMap.size > 0) {
        fallbackAccId = Array.from(mongoAccountMap.values())[0];
      }

      // 5. Import INOUTCOME transactions
      for (const txRow of inoutcomeRows) {
        const amount = parseFloat(String(txRow.ZMONEY || txRow.AMOUNT_ACCOUNT || txRow.amount || "0"));
        if (!amount || isNaN(amount) || amount <= 0) continue;

        const doType = Number(txRow.DO_TYPE ?? 1); // 0 = Income, 1 = Expense, 2 = Transfer
        let txType: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";
        if (doType === 0) txType = "INCOME";
        else if (doType === 2) txType = "TRANSFER";

        const { date: txDate, time: txTime } = parseDateStr(txRow.WDATE, txRow.ZDATE);
        const title = String(txRow.ZCONTENT || txRow.CATEGORY_NAME || "Money Manager Item").trim();
        const description = String(txRow.ZDATA || txRow.SMS_PARSE_CONTENT || "").trim();

        // Account mapping
        const srcAccName = sqliteAssetMap.get(String(txRow.assetUid)) || "";
        const dstAccName = sqliteAssetMap.get(String(txRow.toAssetUid)) || "";

        const accId = mongoAccountMap.get(srcAccName.toLowerCase()) || fallbackAccId;
        const toAccId = mongoAccountMap.get(dstAccName.toLowerCase());

        // Category mapping
        const catName = sqliteCategoryMap.get(String(txRow.ctgUid)) || "";
        const catId = mongoCategoryMap.get(catName.toLowerCase());

        // Currency
        let currency = "INR";
        if (typeof txRow.currencyUid === "string" && txRow.currencyUid.length > 0) {
          currency = txRow.currencyUid.split("_")[0];
        }

        // Duplicate check
        const existing = await db.collection("transactions").findOne({
          userId: userObjectId,
          transactionDate: txDate,
          amount,
          title,
        });

        if (existing) {
          duplicateCount++;
          continue;
        }

        await db.collection("transactions").insertOne({
          userId: userObjectId,
          type: txType,
          amount,
          currency,
          accountId: accId,
          toAccountId: txType === "TRANSFER" ? toAccId : undefined,
          categoryId: txType !== "TRANSFER" ? catId : undefined,
          subcategoryId: "",
          title,
          description,
          transactionDate: txDate,
          transactionTime: txTime,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        importedCount++;
      }
    } else if (tableData.transactions && Array.isArray(tableData.transactions)) {
      // Standard generic SQLite schema handling
      const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
      let defaultAccId = accounts[0]?._id;
      if (!defaultAccId) {
        const newAcc = await db.collection("accounts").insertOne({
          userId: userObjectId,
          name: "SQLite Account",
          type: "BANK",
          currency: "INR",
          openingBalance: 0,
          currentBalance: 0,
          createdAt: new Date(),
        });
        defaultAccId = newAcc.insertedId;
      }

      for (const row of tableData.transactions) {
        const amount = Number(row.amount || 0);
        if (amount <= 0) continue;

        const date = String(row.date || new Date().toISOString().substring(0, 10));

        await db.collection("transactions").insertOne({
          userId: userObjectId,
          type: String(row.type || "EXPENSE").toUpperCase(),
          amount,
          currency: String(row.currency || "INR"),
          accountId: defaultAccId,
          subcategoryId: String(row.subcategory || ""),
          title: String(row.title || row.description || "SQLite Import"),
          description: String(row.description || ""),
          transactionDate: date,
          transactionTime: String(row.time || "12:00"),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        importedCount++;
      }
    }

    await recalculateAllUserBalances(db, session.id);

    return NextResponse.json({
      success: true,
      tables,
      importedCount,
      duplicateCount,
    });
  } catch (error) {
    console.error("SQLite import error:", error);
    return NextResponse.json({ error: "Failed to import SQLite file" }, { status: 500 });
  }
}
