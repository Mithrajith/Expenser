import { Db, ObjectId } from "mongodb";
import { recalculateAllUserBalances } from "../balance";

export interface BackupData {
  version: string;
  exportedAt: string;
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  settings?: Record<string, unknown>;
}

export async function exportUserBackup(db: Db, userId: string): Promise<BackupData> {
  const userObjectId = new ObjectId(userId);

  const accounts = await db.collection("accounts").find({ userId: userObjectId }).toArray();
  const categories = await db.collection("categories").find({ userId: userObjectId }).toArray();
  const transactions = await db.collection("transactions").find({ userId: userObjectId }).toArray();
  const user = await db.collection("users").findOne({ _id: userObjectId });

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    accounts,
    categories,
    transactions,
    settings: {
      baseCurrency: user?.baseCurrency || "INR",
    },
  };
}

export async function restoreUserBackup(
  db: Db,
  userId: string,
  backup: BackupData
): Promise<{ restoredCounts: { accounts: number; categories: number; transactions: number } }> {
  const userObjectId = new ObjectId(userId);

  // Clear existing user data safely
  await db.collection("transactions").deleteMany({ userId: userObjectId });
  await db.collection("accounts").deleteMany({ userId: userObjectId });
  await db.collection("categories").deleteMany({ userId: userObjectId });

  const accountMap = new Map<string, ObjectId>();
  const categoryMap = new Map<string, ObjectId>();

  // Restore accounts
  let restoredAccountsCount = 0;
  if (backup.accounts && Array.isArray(backup.accounts)) {
    for (const acc of backup.accounts) {
      const oldId = String(acc._id || acc.id);
      const newAccId = new ObjectId();
      accountMap.set(oldId, newAccId);

      delete acc._id;
      delete acc.id;
      await db.collection("accounts").insertOne({
        ...acc,
        _id: newAccId,
        userId: userObjectId,
        createdAt: new Date(),
      });
      restoredAccountsCount++;
    }
  }

  // Restore categories
  let restoredCategoriesCount = 0;
  if (backup.categories && Array.isArray(backup.categories)) {
    for (const cat of backup.categories) {
      const oldId = String(cat._id || cat.id);
      const newCatId = new ObjectId();
      categoryMap.set(oldId, newCatId);

      delete cat._id;
      delete cat.id;
      await db.collection("categories").insertOne({
        ...cat,
        _id: newCatId,
        userId: userObjectId,
        createdAt: new Date(),
      });
      restoredCategoriesCount++;
    }
  }

  // Restore transactions
  let restoredTransactionsCount = 0;
  if (backup.transactions && Array.isArray(backup.transactions)) {
    for (const tx of backup.transactions) {
      delete tx._id;
      delete tx.id;

      const accId = accountMap.get(String(tx.accountId)) || new ObjectId(String(tx.accountId));
      const catId = tx.categoryId ? categoryMap.get(String(tx.categoryId)) || new ObjectId(String(tx.categoryId)) : undefined;

      await db.collection("transactions").insertOne({
        ...tx,
        userId: userObjectId,
        accountId: accId,
        categoryId: catId,
        createdAt: new Date(),
      });
      restoredTransactionsCount++;
    }
  }

  // Recalculate balances
  await recalculateAllUserBalances(db, userId);

  return {
    restoredCounts: {
      accounts: restoredAccountsCount,
      categories: restoredCategoriesCount,
      transactions: restoredTransactionsCount,
    },
  };
}
