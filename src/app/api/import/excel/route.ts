import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { parseExcelBuffer } from "@/lib/import-export/excel";
import { recalculateAllUserBalances } from "@/lib/balance";
import { ObjectId } from "mongodb";

function cleanCategoryName(rawName: string): string {
  if (!rawName) return "General";
  // Strip emojis and leading control characters if present e.g. " Food" -> "Food"
  return rawName.replace(/^[\uE000-\uF8FF\uD800-\uDBFF\uDC00-\uDFFF\s]+/g, "").trim() || rawName.trim();
}

function parseDateAndTime(rawDate: unknown): { date: string; time: string } {
  const defaultDate = new Date().toISOString().substring(0, 10);
  const defaultTime = "12:00";

  if (!rawDate) return { date: defaultDate, time: defaultTime };

  let d: Date | null = null;
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    d = rawDate;
  } else if (typeof rawDate === "string") {
    d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      // Try YYYY-MM-DD match
      const match = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
      if (match) return { date: match[1], time: defaultTime };
      return { date: defaultDate, time: defaultTime };
    }
  }

  if (d && !isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
  }

  return { date: defaultDate, time: defaultTime };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingRaw = formData.get("mapping") as string | null;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const { sheets, previewData } = parseExcelBuffer(arrayBuffer);

    // If no mapping passed, return preview & headers
    if (!mappingRaw) {
      return NextResponse.json({
        preview: true,
        sheets,
        sampleRows: previewData,
      });
    }

    const mapping = JSON.parse(mappingRaw);
    const db = await getDb();
    const userObjectId = new ObjectId(session.id);

    // Fetch existing user accounts & categories
    const existingAccounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
    const existingCategories = await db.collection("categories").find({ userId: userObjectId }).toArray();

    const accountMap = new Map(existingAccounts.map((a) => [a.name.toLowerCase().trim(), a._id]));
    const categoryMap = new Map(existingCategories.map((c) => [c.name.toLowerCase().trim(), c._id]));

    let importedCount = 0;
    let duplicateCount = 0;

    for (const row of previewData) {
      // Extract columns based on mapping or fallback auto-detection
      const rawDateVal = row[mapping.date] || row.Date || row.date;
      const { date: rawDate, time: rawTime } = parseDateAndTime(rawDateVal);

      const rawAmountNum = parseFloat(
        String(row[mapping.amount] || row.Amount || row.GBP || row.INR || row.USD || "0")
      );

      if (!rawAmountNum || isNaN(rawAmountNum) || rawAmountNum <= 0) continue;

      const rawTypeStr = String(
        row[mapping.type] || row["Income/Expense"] || row.Type || "EXPENSE"
      ).toUpperCase();

      let txType: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";
      if (rawTypeStr.includes("INC")) txType = "INCOME";
      else if (rawTypeStr.includes("TRANS")) txType = "TRANSFER";

      const rawAccountName = String(row[mapping.account] || row.Account || "Default Bank").trim();
      const rawCategoryName = cleanCategoryName(String(row[mapping.category] || row.Category || "General"));
      const rawSubcategoryName = String(row[mapping.subcategory] || row.Subcategory || "").trim();
      const rawTitle = String(
        row[mapping.title] || row.Note || row.Title || row.Description || "Imported Item"
      ).trim();
      const rawDesc = String(row[mapping.description] || row.Description || "").trim();
      const rawCurrency = String(row[mapping.currency] || row.Currency || "INR").trim();

      // Ensure Account exists in user's DB
      let accId = accountMap.get(rawAccountName.toLowerCase());
      if (!accId) {
        const newAccRes = await db.collection("accounts").insertOne({
          userId: userObjectId,
          name: rawAccountName,
          type: "BANK",
          currency: rawCurrency,
          openingBalance: 0,
          currentBalance: 0,
          createdAt: new Date(),
        });
        accId = newAccRes.insertedId;
        accountMap.set(rawAccountName.toLowerCase(), accId);
      }

      // Ensure Category exists in user's DB
      let catId = categoryMap.get(rawCategoryName.toLowerCase());
      if (!catId && txType !== "TRANSFER") {
        const newCatRes = await db.collection("categories").insertOne({
          userId: userObjectId,
          name: rawCategoryName,
          type: txType,
          icon: "Tag",
          color: "#3B82F6",
          subcategories: rawSubcategoryName ? [rawSubcategoryName] : [],
          createdAt: new Date(),
        });
        catId = newCatRes.insertedId;
        categoryMap.set(rawCategoryName.toLowerCase(), catId);
      }

      // Duplicate check: Same user, date, amount, title
      const existing = await db.collection("transactions").findOne({
        userId: userObjectId,
        transactionDate: rawDate,
        amount: rawAmountNum,
        title: rawTitle,
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      await db.collection("transactions").insertOne({
        userId: userObjectId,
        type: txType,
        amount: rawAmountNum,
        currency: rawCurrency,
        accountId: accId,
        categoryId: catId,
        subcategoryId: rawSubcategoryName,
        title: rawTitle,
        description: rawDesc,
        transactionDate: rawDate,
        transactionTime: rawTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      importedCount++;
    }

    await recalculateAllUserBalances(db, session.id);

    return NextResponse.json({
      success: true,
      totalRows: previewData.length,
      importedCount,
      duplicateCount,
    });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json({ error: "Failed to import Excel file" }, { status: 500 });
  }
}
