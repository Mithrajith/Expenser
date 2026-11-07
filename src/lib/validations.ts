import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  baseCurrency: z.string().default("INR"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export const TransactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("INR"),
  accountId: z.string().min(1, "Account is required"),
  toAccountId: z.string().optional(), // For transfers
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  transactionDate: z.string().min(1, "Date is required"), // YYYY-MM-DD
  transactionTime: z.string().min(1, "Time is required"), // HH:mm
});

export const AccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  type: z.enum(["BANK", "CASH", "CREDIT_CARD", "PAYPAL", "WALLET", "OTHER"]),
  currency: z.string().default("INR"),
  openingBalance: z.number().default(0),
  icon: z.string().default("Wallet"),
  color: z.string().default("#3B82F6"),
});

export const CategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  icon: z.string().default("Tag"),
  color: z.string().default("#10B981"),
  subcategories: z.array(z.string()).default([]),
});

export const ReminderSchema = z.object({
  title: z.string().min(1, "Reminder title is required"),
  message: z.string().min(1, "Reminder message is required"),
  repeat: z.enum(["once", "daily", "weekly", "monthly"]),
  time: z.string().min(1, "Reminder time is required"),
  enabled: z.boolean().default(true),
  timeZone: z.string().optional(),
});

export const SettingsSchema = z.object({
  name: z.string().min(2),
  baseCurrency: z.string(),
  appearance: z.enum(["light", "dark", "system"]).default("dark"),
});

export const BudgetSchema = z.object({
  name: z.string().min(1, "Budget name is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  categoryId: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  alertThreshold: z.number().min(0).max(100).default(80),
});

export const GoalSchema = z.object({
  title: z.string().min(1, "Goal title is required"),
  targetAmount: z.number().positive("Target amount must be greater than 0"),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional().default(""),
});

