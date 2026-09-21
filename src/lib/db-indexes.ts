import { getDb } from "./mongodb";

let indexesCreated = false;

export async function ensureIndexes(): Promise<void> {
  if (indexesCreated) return;
  try {
    const db = await getDb();

    // Transactions indexes
    await db.collection("transactions").createIndex({ userId: 1, transactionDate: -1 });
    await db.collection("transactions").createIndex({ userId: 1, accountId: 1, transactionDate: -1 });
    await db.collection("transactions").createIndex({ userId: 1, categoryId: 1, transactionDate: -1 });
    await db.collection("transactions").createIndex({ userId: 1, type: 1, transactionDate: -1 });
    await db.collection("transactions").createIndex({
      userId: 1,
      title: "text",
      description: "text",
    }, { name: "transaction_text_search" });

    // Accounts indexes
    await db.collection("accounts").createIndex({ userId: 1 });

    // Categories indexes
    await db.collection("categories").createIndex({ userId: 1 });

    // Transfers indexes
    await db.collection("transfers").createIndex({ userId: 1, date: -1 });

    // Users indexes
    await db.collection("users").createIndex({ email: 1 }, { unique: true });

    indexesCreated = true;
  } catch (error) {
    console.error("Failed to create MongoDB indexes:", error);
  }
}
