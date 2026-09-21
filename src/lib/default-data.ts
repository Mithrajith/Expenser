import { Db, ObjectId } from "mongodb";

export const DEFAULT_CATEGORIES = [
  {
    name: "Food",
    type: "EXPENSE",
    icon: "Utensils",
    color: "#EF4444",
    subcategories: ["Breakfast", "Lunch", "Dinner", "Snacks", "Delivery", "Groceries"],
  },
  {
    name: "Transport",
    type: "EXPENSE",
    icon: "Bus",
    color: "#F59E0B",
    subcategories: ["Bus", "Cab/Taxi", "Fuel", "Train", "Metro", "Maintenance"],
  },
  {
    name: "Shopping",
    type: "EXPENSE",
    icon: "ShoppingBag",
    color: "#EC4899",
    subcategories: ["Clothing", "Electronics", "Home & Kitchen", "Gifts", "Personal Care"],
  },
  {
    name: "Education",
    type: "EXPENSE",
    icon: "GraduationCap",
    color: "#8B5CF6",
    subcategories: ["Books", "Courses", "College/School", "Stationery"],
  },
  {
    name: "Entertainment",
    type: "EXPENSE",
    icon: "Film",
    color: "#6366F1",
    subcategories: ["Movies", "Games", "Streaming/Subscriptions", "Events", "Outing"],
  },
  {
    name: "Bills & Utilities",
    type: "EXPENSE",
    icon: "Receipt",
    color: "#3B82F6",
    subcategories: ["Rent", "Electricity", "Water", "Internet", "Mobile Recharge"],
  },
  {
    name: "Health",
    type: "EXPENSE",
    icon: "HeartPulse",
    color: "#10B981",
    subcategories: ["Medicines", "Doctor", "Gym/Fitness", "Insurance"],
  },
  {
    name: "Travel",
    type: "EXPENSE",
    icon: "Plane",
    color: "#06B6D4",
    subcategories: ["Flight", "Hotel", "Sightseeing", "Package"],
  },
  {
    name: "Salary",
    type: "INCOME",
    icon: "Briefcase",
    color: "#10B981",
    subcategories: ["Full-time", "Bonus", "Overtime"],
  },
  {
    name: "Freelance",
    type: "INCOME",
    icon: "Laptop",
    color: "#34D399",
    subcategories: ["Client Project", "Consulting", "Royalty"],
  },
  {
    name: "Other Income",
    type: "INCOME",
    icon: "TrendingUp",
    color: "#A7F3D0",
    subcategories: ["Investment", "Refund", "Gift"],
  },
  {
    name: "Other Expense",
    type: "EXPENSE",
    icon: "MoreHorizontal",
    color: "#6B7280",
    subcategories: ["Misc", "Fees"],
  },
];

export const DEFAULT_ACCOUNTS = [
  {
    name: "Cash",
    type: "CASH",
    currency: "INR",
    openingBalance: 0,
    icon: "Banknote",
    color: "#10B981",
  },
  {
    name: "SBI Bank",
    type: "BANK",
    currency: "INR",
    openingBalance: 0,
    icon: "Building2",
    color: "#3B82F6",
  },
  {
    name: "HDFC Bank",
    type: "BANK",
    currency: "INR",
    openingBalance: 0,
    icon: "Building2",
    color: "#6366F1",
  },
  {
    name: "Credit Card",
    type: "CREDIT_CARD",
    currency: "INR",
    openingBalance: 0,
    icon: "CreditCard",
    color: "#EF4444",
  },
];

export async function seedUserData(db: Db, userId: string) {
  const userObjectId = new ObjectId(userId);

  // Check if categories already exist
  const existingCat = await db.collection("categories").findOne({ userId: userObjectId });
  if (!existingCat) {
    const categoriesToInsert = DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      userId: userObjectId,
      createdAt: new Date(),
    }));
    await db.collection("categories").insertMany(categoriesToInsert);
  }

  // Check if accounts already exist
  const existingAcc = await db.collection("accounts").findOne({ userId: userObjectId });
  if (!existingAcc) {
    const accountsToInsert = DEFAULT_ACCOUNTS.map((acc) => ({
      ...acc,
      userId: userObjectId,
      currentBalance: acc.openingBalance,
      createdAt: new Date(),
    }));
    await db.collection("accounts").insertMany(accountsToInsert);
  }
}
