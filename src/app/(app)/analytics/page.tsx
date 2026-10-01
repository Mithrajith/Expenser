"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart as PieIcon,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Filter,
  FileDown,
} from "lucide-react";

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

function getDaysInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function formatDateRangeLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "All dates";

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${startDate}T00:00:00`))} - ${formatter.format(
    new Date(`${endDate}T00:00:00`)
  )}`;
}

function buildTransactionsLink(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/transactions${query.toString() ? `?${query.toString()}` : ""}`;
}

function buildPdfExportLink(startDate: string, endDate: string) {
  const query = new URLSearchParams();
  if (startDate) query.set("startDate", startDate);
  if (endDate) query.set("endDate", endDate);
  return `/api/export/pdf${query.toString() ? `?${query.toString()}` : ""}`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dateRangeReady, setDateRangeReady] = useState(false);
  const [analysisView, setAnalysisView] = useState<"overview" | "categories" | "trends">("overview");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadDateRange() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setStartDate(data.user?.analyticsStartDate || "");
          setEndDate(data.user?.analyticsEndDate || "");
        }
      } catch {
        setStartDate("");
        setEndDate("");
      } finally {
        setDateRangeReady(true);
      }
    }

    loadDateRange();
  }, []);

  useEffect(() => {
    if (!dateRangeReady) return;

    try {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyticsStartDate: startDate, analyticsEndDate: endDate }),
      }).catch(() => undefined);
    } catch {
      // ignore persistence failures
    }
  }, [startDate, endDate, dateRangeReady]);

  useEffect(() => {
    if (!dateRangeReady) return;

    async function loadAnalytics() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/analytics/monthly?${params.toString()}`);
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
  }, [startDate, endDate, dateRangeReady]);

  useEffect(() => {
    if (!dateRangeReady) return;
    setSelectedCategory(null);
  }, [startDate, endDate, dateRangeReady]);

  if (loading || !data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="flex flex-col gap-3">
          <div className="h-7 w-56 rounded-xl bg-[#1C2433] animate-pulse" />
          <div className="h-4 w-80 rounded-xl bg-[#1C2433] animate-pulse" />
          <div className="h-4 w-48 rounded-xl bg-[#1C2433] animate-pulse" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-3xl bg-[#141A24] border border-[#263145] animate-pulse" />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 rounded-3xl bg-[#141A24] border border-[#263145] animate-pulse" />
          <div className="h-80 rounded-3xl bg-[#141A24] border border-[#263145] animate-pulse" />
        </div>
      </div>
    );
  }

  const symbol = "₹";
  const rangeLabel = formatDateRangeLabel(startDate, endDate);
  const daysInRange = getDaysInRange(startDate, endDate);
  const avgDailySpend = Math.round(data.expense / Math.max(daysInRange, 1));
  const expenseToIncomeRatio = data.income > 0 ? Math.round((data.expense / data.income) * 100) : 0;
  const topCategory = data.categoryBreakdown[0];
  const topCategoryShare = data.expense > 0 && topCategory ? Math.round((topCategory.amount / data.expense) * 100) : 0;
  const filteredCategories = selectedCategory
    ? data.categoryBreakdown.filter((item) => item.categoryName === selectedCategory)
    : data.categoryBreakdown;
  const categoryFocusRows = selectedCategory
    ? data.categoryBreakdown.filter((item) => item.categoryName === selectedCategory)
    : [];
  const categoryFocusTotal = categoryFocusRows.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Financial Analytics</h2>
            <p className="text-xs text-gray-400">In-depth breakdown of your cashflow & spending habits</p>
            <p className="text-[11px] text-cyan-400 mt-1 font-medium">Showing {rangeLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={buildPdfExportLink(startDate, endDate)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-semibold border border-indigo-500 hover:bg-indigo-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]"
              aria-label="Download analytics PDF report"
            >
              <FileDown className="w-4 h-4" />
              <span>PDF Report</span>
            </a>

            <div className="flex items-center gap-1 bg-[#141A24] p-1 rounded-2xl border border-[#263145]">
              {(["overview", "categories", "trends"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setAnalysisView(view)}
                  aria-label={`Switch to ${view} analytics view`}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117] ${
                    analysisView === view
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-[#141A24] border border-[#263145] rounded-2xl px-3 py-2">
              <div>
                <label className="block text-[10px] uppercase text-gray-500 font-semibold mb-0.5">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="Analytics start date"
                  className="bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
              <div className="h-8 w-px bg-[#263145]" />
              <div>
                <label className="block text-[10px] uppercase text-gray-500 font-semibold mb-0.5">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="Analytics end date"
                  className="bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#141A24] p-1 rounded-2xl border border-[#263145] self-start">
          {(["month", "quarter", "year"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAnalysisView(t === "month" ? "overview" : t === "quarter" ? "categories" : "trends")}
              className={`px-4 py-2 text-xs font-semibold rounded-xl capitalize transition ${
                ((t === "month" && analysisView === "overview") || (t === "quarter" && analysisView === "categories") || (t === "year" && analysisView === "trends"))
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "month" ? "Overview" : t === "quarter" ? "Categories" : "Trends"}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Transactions</p>
          <h4 className="text-xl font-black text-white mt-1">{data.txCount}</h4>
        </div>

        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Avg Daily Spend</p>
          <h4 className="text-xl font-black text-red-400 mt-1">
            {symbol}
            {avgDailySpend.toLocaleString("en-IN")}
          </h4>
        </div>

        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Top Category</p>
          <h4 className="text-xl font-black text-emerald-400 mt-1">{topCategory?.categoryName || "N/A"}</h4>
        </div>

        <div className="p-4 rounded-3xl bg-[#141A24] border border-[#263145]">
          <p className="text-xs font-semibold uppercase text-gray-400">Expense / Income</p>
          <h4 className="text-xl font-black text-cyan-400 mt-1">{expenseToIncomeRatio}%</h4>
        </div>
      </div>

      {analysisView === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span>Month-over-Month Comparison</span>
            </h3>

            <div className="h-64 w-full">
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
        </div>
      )}

      {analysisView === "categories" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-emerald-400" />
                <span>Category Spending</span>
              </h3>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-blue-400 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredCategories}
                    dataKey="amount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    onClick={(entry: any) => setSelectedCategory(entry?.categoryName || null)}
                  >
                    {filteredCategories.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color || "#3B82F6"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1C2433", borderColor: "#263145", borderRadius: "12px", color: "#fff" }}
                    formatter={(val: any) => [`${symbol}${(val || 0).toLocaleString("en-IN")}`, "Expense"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {data.categoryBreakdown.map((item, idx) => (
                <Link
                  key={idx}
                  href={buildTransactionsLink({
                    categoryId: item.categoryId,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                  })}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117] ${
                    selectedCategory === item.categoryName
                      ? "bg-blue-500/10 border-blue-500/40"
                      : "bg-[#1C2433] border-[#263145] hover:border-blue-500/40"
                  }`}
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
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <span>Category Deep Dive</span>
            </h3>

            {selectedCategory ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-[#1C2433] border border-[#263145]">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase">Selected Category</p>
                    <p className="text-lg font-bold text-white mt-1">{selectedCategory}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#1C2433] border border-[#263145]">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase">Share of Expense</p>
                    <p className="text-lg font-bold text-cyan-400 mt-1">{topCategoryShare}%</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#1C2433] border border-[#263145]">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase">Category Total</p>
                  <p className="text-2xl font-black text-white mt-1">
                    {symbol}
                    {categoryFocusTotal.toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {categoryFocusRows.map((item, idx) => (
                    <div key={`${item.categoryName}-${item.subcategory || idx}`} className="flex items-center justify-between p-3 rounded-2xl bg-[#1C2433] border border-[#263145]">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.categoryName}</p>
                        <p className="text-xs text-gray-400">{item.subcategory || "Uncategorized"}</p>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {symbol}
                        {item.amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="min-h-[220px] flex items-center justify-center text-center text-sm text-gray-400 border border-dashed border-[#263145] rounded-2xl">
                Select a category to inspect its subcategory spend and share of total expense.
              </div>
            )}
          </div>
        </div>
      )}

      {analysisView === "trends" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>Month Comparison Trend</span>
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#263145" vertical={false} />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={12} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1C2433", borderColor: "#263145", borderRadius: "12px", color: "#fff" }} />
                  <Bar dataKey="net" fill="#0EA5E9" radius={[6, 6, 0, 0]} name="Net" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span>Month Snapshot</span>
            </h3>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#1C2433] border border-[#263145]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">Selected Month</p>
                <p className="text-lg font-bold text-white mt-1">{rangeLabel}</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#1C2433] border border-[#263145]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">Top Category Share</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">{topCategoryShare}%</p>
              </div>
              <div className="p-4 rounded-2xl bg-[#1C2433] border border-[#263145]">
                <p className="text-[11px] font-semibold text-gray-400 uppercase">Days in Month</p>
                <p className="text-lg font-bold text-cyan-400 mt-1">{daysInRange}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
