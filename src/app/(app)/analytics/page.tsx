"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Calendar, PieChart as PieIcon } from "lucide-react";

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  txCount: number;
  dailySpending: { date: string; amount: number }[];
  categoryBreakdown: { categoryId: string; subcategory?: string; amount: number; categoryName: string; color: string }[];
  monthComparison: { month: string; income: number; expense: number; net: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("month");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        const res = await fetch("/api/analytics/monthly");
        if (res.ok) {
          const resData = await res.json();
          setData(resData);
        }
      } catch (err) {
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [timeframe]);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading analytics & charts...</p>
      </div>
    );
  }

  const symbol = "₹";

  return (
    <div className="space-y-6">
      {/* Header & Timeframe Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Financial Analytics</h2>
          <p className="text-xs text-gray-400">In-depth breakdown of your cashflow & spending habits</p>
        </div>

        <div className="flex items-center gap-1 bg-[#141A24] p-1 rounded-2xl border border-[#263145]">
          {(["week", "month", "year"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl capitalize transition ${
                timeframe === t
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Total Income</p>
          <h4 className="text-xl font-black text-emerald-400 mt-1">
            +{symbol}
            {data.income.toLocaleString("en-IN")}
          </h4>
        </div>

        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Total Expenses</p>
          <h4 className="text-xl font-black text-red-400 mt-1">
            -{symbol}
            {data.expense.toLocaleString("en-IN")}
          </h4>
        </div>

        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Net Savings</p>
          <h4 className="text-xl font-black text-cyan-400 mt-1">
            {symbol}
            {data.net.toLocaleString("en-IN")}
          </h4>
        </div>

        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Savings Rate</p>
          <h4 className="text-xl font-black text-indigo-400 mt-1">{data.savingsRate}%</h4>
        </div>
      </div>

      {/* Daily Spending Trend Area Chart */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-400" />
          <span>Daily Spending Trend</span>
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailySpending}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#263145" vertical={false} />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6B7280" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1C2433", borderColor: "#263145", borderRadius: "12px", color: "#fff" }}
                formatter={(val: any) => [`${symbol}${(val || 0).toLocaleString("en-IN")}`, "Expense"]}
              />
              <Area type="monotone" dataKey="amount" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month-over-Month Comparison Bar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span>Month-over-Month Comparison</span>
          </h3>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263145" vertical={false} />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#1C2433", borderColor: "#263145", borderRadius: "12px", color: "#fff" }} />
                <Bar dataKey="income" fill="#10B981" radius={[6, 6, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#EF4444" radius={[6, 6, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category & Subcategory Breakdown */}
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-emerald-400" />
            <span>Category Spending</span>
          </h3>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {data.categoryBreakdown.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCategory(item.categoryName)}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#1C2433] border border-[#263145] hover:border-blue-500/40 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color || "#3B82F6" }} />
                  <div>
                    <h5 className="font-semibold text-sm text-white">{item.categoryName}</h5>
                    {item.subcategory && <p className="text-xs text-gray-400">└ {item.subcategory}</p>}
                  </div>
                </div>
                <span className="font-bold text-sm text-white">
                  {symbol}
                  {item.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
