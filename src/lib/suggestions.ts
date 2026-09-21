import { Db, ObjectId } from "mongodb";

export async function getSmartSuggestions(
  db: Db,
  userId: string,
  query: string,
  field: "title" | "category" | "subcategory" | "description" = "title"
): Promise<string[]> {
  if (!query || query.trim().length === 0) return [];
  const userObjectId = new ObjectId(userId);
  const regex = new RegExp(query.trim(), "i");

  const pipeline = [
    { $match: { userId: userObjectId, [field]: { $regex: regex } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, lastUsed: { $max: "$createdAt" } } },
    { $sort: { count: -1, lastUsed: -1 } },
    { $limit: 5 },
  ];

  const results = await db.collection("transactions").aggregate(pipeline).toArray();
  return results.map((r) => r._id).filter(Boolean);
}
