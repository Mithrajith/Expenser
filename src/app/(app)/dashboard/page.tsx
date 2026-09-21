"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { IconHelper } from "@/components/ui/IconHelper";

interface TransactionItem {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  currency: string;
  title: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  accountName?: string;
  transactionDate: string;
  transactionTime: string;
}

interface SummaryData {
  selectedMonth: string;
  totalBalance: number;
  income: number;
  expense: number;
  net: number;
  percentChange: number;
  categoryExpenses: {
    categoryId: string;
    total: number;
    name: string;
    color: string;
    icon: string;
  }[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [sumRes, txRes] = await Promise.all([
        fetch("/api/analytics/summary"),
        fetch("/api/transactions?limit=6"),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        setRecentTransactions(txData.transactions || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 18) return "Good Afternoon 👋";
    return "Good Evening 👋";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading your finances...</p>
      </div>
    );
  }

  const symbol = "₹";

  return (
    <div className="space-y-6">
      {/* Header & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {getGreeting()}
          </h2>
          <p className="text-sm text-gray-400 mt-1">Here is your financial summary for this month.</p>
        </div>

        {/* Month Selector Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto glass-pill px-4 py-2 rounded-2xl border border-[#263145]">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">September 2026</span>
        </div>
      </div>

      {/* Main Glass Balance Card */}
      <div className="gradient-balance rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Current Balance
            </p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white mt-1 tracking-tight">
              {symbol}
              {(summary?.totalBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>

          {/* Trend Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              (summary?.percentChange || 0) >= 0
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            }`}
          >
            {(summary?.percentChange || 0) >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {(summary?.percentChange || 0) >= 0 ? `+${summary?.percentChange}%` : `${summary?.percentChange}%`} vs last mo
            </span>
          </div>
        </div>

        {/* Mini Balance Sparkline SVG */}
        <div className="h-10 w-full opacity-40">
          <svg className="w-full h-full" viewBox="0 0 300 40" preserveAspectRatio="none">
            <path
              d="M0,35 Q40,10 80,25 T160,15 T240,30 T300,5"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="3"
            />
          </svg>
        </div>

        {/* Income / Expense / Net Cards Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Income</p>
            <p className="text-base sm:text-lg font-bold text-white mt-0.5">
              {symbol}
              {(summary?.income || 0).toLocaleString("en-IN")}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Expense</p>
            <p className="text-base sm:text-lg font-bold text-white mt-0.5">
              {symbol}
              {(summary?.expense || 0).toLocaleString("en-IN")}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Net</p>
            <p className="text-base sm:text-lg font-bold text-white mt-0.5">
              {symbol}
              {(summary?.net || 0).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Expense by Category (Donut Chart) */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Expense by Category</span>
          </h3>
          <Link href="/analytics" className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1">
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {summary?.categoryExpenses && summary.categoryExpenses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-56 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.categoryExpenses}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="total"
                  >
                    {summary.categoryExpenses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || "#3B82F6"} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1C2433",
                      borderColor: "#263145",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(value: any) => [`${symbol}${(value || 0).toLocaleString("en-IN")}`, "Spent"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400">Total Spent</span>
                <span className="text-sm font-bold text-white">
                  {symbol}
                  {(summary?.expense || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Category Breakdown List */}
            <div className="space-y-2.5">
              {summary.categoryExpenses.slice(0, 5).map((item) => (
                <div key={item.categoryId} className="flex items-center justify-between text-sm p-2.5 rounded-xl bg-[#1C2433]/60 border border-[#263145]">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color || "#3B82F6" }}
                    />
                    <span className="font-medium text-gray-200">{item.name}</span>
                  </div>
                  <span className="font-bold text-white">
                    {symbol}
                    {item.total.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            <p>No expenses recorded for this month.</p>
          </div>
        )}
      </div>

      {/* Recent Transactions List */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Recent Transactions</h3>
          <Link href="/transactions" className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1">
            <span>See All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((tx) => {
              const isIncome = tx.type === "INCOME";
              const isTransfer = tx.type === "TRANSFER";

              return (
                <Link
                  key={tx.id}
                  href={`/transactions/${tx.id}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1C2433] border border-[#263145] hover:border-blue-500/40 transition touch-target"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isIncome
                          ? "rgba(16, 185, 129, 0.15)"
                          : isTransfer
                          ? "rgba(14, 165, 233, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                        color: isIncome ? "#10B981" : isTransfer ? "#0EA5E9" : "#EF4444",
                      }}
                    >
                      <IconHelper name={tx.categoryIcon || "Tag"} className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-white">{tx.title}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tx.categoryName || "Transfer"} • {tx.accountName || "Account"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-bold ${
                        isIncome ? "text-emerald-400" : isTransfer ? "text-cyan-400" : "text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : isTransfer ? "" : "-"}
                      {symbol}
                      {tx.amount.toLocaleString("en-IN")}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-0.5">{tx.transactionTime || "12:00"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 space-y-3">
            <Sparkles className="w-10 h-10 text-gray-600 mx-auto" />
            <div>
              <p className="text-base font-semibold text-gray-300">No transactions yet</p>
              <p className="text-xs text-gray-500">Add your first transaction to start tracking your money.</p>
            </div>
            <Link
              href="/transactions/new"
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Transaction</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
