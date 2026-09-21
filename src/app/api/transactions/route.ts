import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { TransactionSchema } from "@/lib/validations";
import { recalculateAccountBalance } from "@/lib/balance";
import { ObjectId, Filter } from "mongodb";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
  const skip = (page - 1) * limit;

  const search = searchParams.get("search");
  const type = searchParams.get("type");
  const accountId = searchParams.get("accountId");
  const categoryId = searchParams.get("categoryId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const minAmount = searchParams.get("minAmount");
  const maxAmount = searchParams.get("maxAmount");

  const userObjectId = new ObjectId(session.id);
  const db = await getDb();

  // Fetch accounts to calculate opening balances
  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const accountOpeningMap = new Map<string, number>();
  let initialTotalBalance = 0;
  accounts.forEach((a) => {
    const ob = a.openingBalance || 0;
    accountOpeningMap.set(a._id.toString(), ob);
    initialTotalBalance += ob;
  });

  // Calculate chronological running balances for ALL user transactions
  const allChronologicalTxs = await db
    .collection("transactions")
    .find({ userId: userObjectId })
    .sort({ transactionDate: 1, transactionTime: 1, _id: 1 })
    .toArray();

  const accountRunningMap = new Map<string, number>(accountOpeningMap);
  let totalRunningBalance = initialTotalBalance;
  const txRunningBalanceMap = new Map<string, number>();

  for (const tx of allChronologicalTxs) {
    const txId = tx._id.toString();
    const accIdStr = tx.accountId?.toString();
    const toAccIdStr = tx.toAccountId?.toString();
    const amt = tx.amount || 0;

    if (tx.type === "INCOME") {
      totalRunningBalance += amt;
      if (accIdStr) {
        accountRunningMap.set(accIdStr, (accountRunningMap.get(accIdStr) || 0) + amt);
      }
    } else if (tx.type === "EXPENSE") {
      totalRunningBalance -= amt;
      if (accIdStr) {
        accountRunningMap.set(accIdStr, (accountRunningMap.get(accIdStr) || 0) - amt);
      }
    } else if (tx.type === "TRANSFER") {
      if (accIdStr) {
        accountRunningMap.set(accIdStr, (accountRunningMap.get(accIdStr) || 0) - amt);
      }
      if (toAccIdStr) {
        accountRunningMap.set(toAccIdStr, (accountRunningMap.get(toAccIdStr) || 0) + amt);
      }
    }

    // Store balance after this transaction
    if (accountId && accIdStr === accountId) {
      txRunningBalanceMap.set(txId, accountRunningMap.get(accountId) || 0);
    } else {
      txRunningBalanceMap.set(txId, totalRunningBalance);
    }
  }

  // Filter query built using $and array to avoid $or collisions and guarantee userId scoping
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andConditions: Filter<any>[] = [{ userId: userObjectId }];

  if (type && ["EXPENSE", "INCOME", "TRANSFER"].includes(type)) {
    andConditions.push({ type });
  }

  if (accountId && ObjectId.isValid(accountId)) {
    const accObjId = new ObjectId(accountId);
    andConditions.push({
      $or: [{ accountId: accObjId }, { toAccountId: accObjId }],
    });
  }

  if (categoryId && ObjectId.isValid(categoryId)) {
    andConditions.push({ categoryId: new ObjectId(categoryId) });
  }

  if (startDate || endDate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateCond: Record<string, any> = {};
    if (startDate) dateCond.$gte = startDate;
    if (endDate) dateCond.$lte = endDate;
    andConditions.push({ transactionDate: dateCond });
  }

  if (minAmount || maxAmount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const amountCond: Record<string, any> = {};
    if (minAmount) amountCond.$gte = parseFloat(minAmount);
    if (maxAmount) amountCond.$lte = parseFloat(maxAmount);
    andConditions.push({ amount: amountCond });
  }

  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), "i");
    andConditions.push({
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { subcategoryId: { $regex: searchRegex } },
      ],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Filter<any> = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

  const total = await db.collection("transactions").countDocuments(query);

  const transactions = await db
    .collection("transactions")
    .aggregate([
      { $match: query },
      { $sort: { transactionDate: -1, transactionTime: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "accounts",
          let: { accId: "$accountId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$accId"] },
                    { $eq: ["$userId", userObjectId] },
                  ],
                },
              },
            },
          ],
          as: "account",
        },
      },
      {
        $lookup: {
          from: "accounts",
          let: { toAccId: "$toAccountId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$toAccId"] },
                    { $eq: ["$userId", userObjectId] },
                  ],
                },
              },
            },
          ],
          as: "toAccount",
        },
      },
      {
        $lookup: {
          from: "categories",
          let: { catId: "$categoryId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$catId"] },
                    { $eq: ["$userId", userObjectId] },
                  ],
                },
              },
            },
          ],
          as: "category",
        },
      },
      {
        $project: {
          id: "$_id",
          type: 1,
          amount: 1,
          currency: 1,
          accountId: 1,
          toAccountId: 1,
          categoryId: 1,
          subcategoryId: 1,
          title: 1,
          description: 1,
          transactionDate: 1,
          transactionTime: 1,
          createdAt: 1,
          accountName: { $arrayElemAt: ["$account.name", 0] },
          accountColor: { $arrayElemAt: ["$account.color", 0] },
          toAccountName: { $arrayElemAt: ["$toAccount.name", 0] },
          categoryName: { $arrayElemAt: ["$category.name", 0] },
          categoryIcon: { $arrayElemAt: ["$category.icon", 0] },
          categoryColor: { $arrayElemAt: ["$category.color", 0] },
        },
      },
    ])
    .toArray();

  const formattedTransactions = transactions.map((t) => ({
    ...t,
    runningBalance: txRunningBalanceMap.get(t.id.toString()) ?? 0,
  }));

  return NextResponse.json({
    transactions: formattedTransactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = TransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.id);
    const data = parsed.data;

    // Validate account ownership
    if (!ObjectId.isValid(data.accountId)) {
      return NextResponse.json({ error: "Invalid account ID" }, { status: 400 });
    }
    const accountObjId = new ObjectId(data.accountId);
    const accountExists = await db.collection("accounts").findOne({ _id: accountObjId, userId: userObjectId });
    if (!accountExists) {
      return NextResponse.json({ error: "Account not found or does not belong to user" }, { status: 400 });
    }

    // Validate destination account ownership if transfer
    let toAccountObjId: ObjectId | undefined = undefined;
    if (data.type === "TRANSFER" && data.toAccountId) {
      if (!ObjectId.isValid(data.toAccountId)) {
        return NextResponse.json({ error: "Invalid destination account ID" }, { status: 400 });
      }
      toAccountObjId = new ObjectId(data.toAccountId);
      const toAccountExists = await db.collection("accounts").findOne({ _id: toAccountObjId, userId: userObjectId });
      if (!toAccountExists) {
        return NextResponse.json({ error: "Destination account not found or does not belong to user" }, { status: 400 });
      }
    }

    // Validate category ownership if categoryId provided
    let categoryObjId: ObjectId | undefined = undefined;
    if (data.categoryId) {
      if (!ObjectId.isValid(data.categoryId)) {
        return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
      }
      categoryObjId = new ObjectId(data.categoryId);
      const categoryExists = await db.collection("categories").findOne({ _id: categoryObjId, userId: userObjectId });
      if (!categoryExists) {
        return NextResponse.json({ error: "Category not found or does not belong to user" }, { status: 400 });
      }
    }

    const newTransaction = {
      userId: userObjectId,
      type: data.type,
      amount: data.amount,
      currency: data.currency || "INR",
      accountId: accountObjId,
      toAccountId: toAccountObjId,
      categoryId: categoryObjId,
      subcategoryId: data.subcategoryId || "",
      title: data.title,
      description: data.description || "",
      transactionDate: data.transactionDate,
      transactionTime: data.transactionTime,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("transactions").insertOne(newTransaction);

    // Recalculate affected account balances
    await recalculateAccountBalance(db, session.id, data.accountId);
    if (data.type === "TRANSFER" && data.toAccountId) {
      await recalculateAccountBalance(db, session.id, data.toAccountId);
    }

    return NextResponse.json({
      success: true,
      transaction: { ...newTransaction, id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
