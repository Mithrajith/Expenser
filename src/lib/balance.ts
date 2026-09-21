import { Db, ObjectId } from "mongodb";

export async function recalculateAccountBalance(
  db: Db,
  userId: string,
  accountId: string
): Promise<number> {
  const userObjectId = new ObjectId(userId);
  const accountObjectId = new ObjectId(accountId);

  const account = await db.collection("accounts").findOne({
    _id: accountObjectId,
    userId: userObjectId,
  });

  if (!account) return 0;

  const openingBalance = account.openingBalance || 0;

  // Aggregate EXPENSE and INCOME for this account
  const transactionStats = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        accountId: accountObjectId,
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]).toArray();

  let income = 0;
  let expense = 0;

  for (const stat of transactionStats) {
    if (stat._id === "INCOME") income = stat.total;
    if (stat._id === "EXPENSE") expense = stat.total;
  }

  // Aggregate Transfers IN to this account
  const transfersInStats = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        type: "TRANSFER",
        toAccountId: accountObjectId,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]).toArray();

  const transfersIn = transfersInStats[0]?.total || 0;

  // Aggregate Transfers OUT from this account
  const transfersOutStats = await db.collection("transactions").aggregate([
    {
      $match: {
        userId: userObjectId,
        type: "TRANSFER",
        accountId: accountObjectId,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]).toArray();

  const transfersOut = transfersOutStats[0]?.total || 0;

  const calculatedBalance = openingBalance + income - expense + transfersIn - transfersOut;

  // Update account currentBalance in DB
  await db.collection("accounts").updateOne(
    { _id: accountObjectId, userId: userObjectId },
    { $set: { currentBalance: calculatedBalance, updatedAt: new Date() } }
  );

  return calculatedBalance;
}

export async function recalculateAllUserBalances(db: Db, userId: string): Promise<void> {
  const userObjectId = new ObjectId(userId);
  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();

  for (const acc of accounts) {
    await recalculateAccountBalance(db, userId, acc._id.toString());
  }
}
