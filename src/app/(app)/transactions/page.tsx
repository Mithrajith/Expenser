"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  Loader2,
  Calendar as CalendarIcon,
  Copy,
  Edit2,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconHelper } from "@/components/ui/IconHelper";

interface Transaction {
  id: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  currency: string;
  title: string;
  description?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  accountName?: string;
  toAccountName?: string;
  subcategoryId?: string;
  transactionDate: string;
  transactionTime: string;
  runningBalance?: number;
}

function parseLocalDate(dateStr: string) {
  if (!dateStr) return { dayNum: "--", dayName: "", monthYearStr: "" };
  const parts = dateStr.split("-").map(Number);
  let d: Date;
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return { dayNum: dateStr, dayName: "", monthYearStr: "" };

  const dayNum = d.getDate();
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const monthYearStr = d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
  return { dayNum, dayName, monthYearStr };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"daily" | "calendar" | "weekly" | "monthly">("daily");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>("");
  const [filterAccountId, setFilterAccountId] = useState<string>("");

  // Calendar month selection state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (search) params.set("search", search);
      if (filterType) params.set("type", filterType);
      if (filterAccountId) params.set("accountId", filterAccountId);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterAccountId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction? This will update your account balance.")) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error("Delete transaction failed:", err);
    }
  };

  const handleDuplicate = async (tx: Transaction) => {
    try {
      const now = new Date();
      const payload = {
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        accountId: tx.accountName,
        title: `${tx.title} (Copy)`,
        description: tx.description || "",
        subcategoryId: tx.subcategoryId || "",
        transactionDate: now.toISOString().substring(0, 10),
        transactionTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      };

      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      fetchTransactions();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  };

  // Group transactions by date for list view
  const groupedTransactions = transactions.reduce((acc, tx) => {
    const dateKey = tx.transactionDate ? tx.transactionDate.substring(0, 10) : "Undated";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const symbol = "₹";

  // Calculate totals
  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);
  const netTotal = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Transactions</h2>
          <p className="text-xs text-gray-400">Activity timeline, running balances & multi-period views</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, category..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141A24] border border-[#263145] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilterModal(true)}
            className="p-2.5 rounded-xl bg-[#141A24] border border-[#263145] text-gray-300 hover:text-white hover:border-blue-500/50 transition touch-target"
          >
            <Filter className="w-4 h-4" />
          </button>

          <Link
            href="/transactions/new"
            className="hidden md:flex items-center gap-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </Link>
        </div>
      </div>

      {/* Income / Expense / Net Summary Pill Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-2xl bg-[#141A24] border border-emerald-500/30 text-center">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase">Income</p>
          <p className="text-base font-bold text-white mt-0.5">+{symbol}{totalIncome.toLocaleString("en-IN")}</p>
        </div>
        <div className="p-3 rounded-2xl bg-[#141A24] border border-red-500/30 text-center">
          <p className="text-[11px] font-semibold text-red-400 uppercase">Expense</p>
          <p className="text-base font-bold text-white mt-0.5">-{symbol}{totalExpense.toLocaleString("en-IN")}</p>
        </div>
        <div className="p-3 rounded-2xl bg-[#141A24] border border-cyan-500/30 text-center">
          <p className="text-[11px] font-semibold text-cyan-400 uppercase">Net</p>
          <p className="text-base font-bold text-white mt-0.5">{symbol}{netTotal.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 bg-[#141A24] p-1 rounded-2xl border border-[#263145] max-w-md">
        {(["daily", "calendar", "weekly", "monthly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize transition ${
              activeTab === tab
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          <p className="text-xs text-gray-400">Fetching transaction records...</p>
        </div>
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <div className="text-center py-16 bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-3">
          <CalendarIcon className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-base font-semibold text-gray-300">No transactions found</p>
          <p className="text-xs text-gray-500">Try adjusting your filters or import your transactions.</p>
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </Link>
        </div>
      ) : (
        <>
          {/* DAILY / TIMELINE LIST VIEW */}
          {(activeTab === "daily" || activeTab === "weekly" || activeTab === "monthly") && (
            <>
              {/* Mobile Grouped Timeline Cards */}
              <div className="md:hidden space-y-6">
                {Object.entries(groupedTransactions).map(([dateStr, items]) => {
                  const { dayNum, dayName, monthYearStr } = parseLocalDate(dateStr);
                  const dailyExpenseTotal = items
                    .filter((i) => i.type === "EXPENSE")
                    .reduce((sum, i) => sum + i.amount, 0);
                  const dailyIncomeTotal = items
                    .filter((i) => i.type === "INCOME")
                    .reduce((sum, i) => sum + i.amount, 0);
                  const endOfDayBalance = items[0]?.runningBalance;

                  return (
                    <div key={dateStr} className="space-y-2">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#263145]/60 bg-[#141A24]/40 rounded-t-xl">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl font-black text-white">{dayNum}</span>
                          <div>
                            <span className="text-xs font-bold text-gray-300 tracking-wider block">
                              {dayName} {monthYearStr && `• ${monthYearStr}`}
                            </span>
                            {endOfDayBalance !== undefined && (
                              <span className="text-[11px] font-semibold text-cyan-400 block">
                                Balance: {symbol}{endOfDayBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {dailyExpenseTotal > 0 && (
                            <span className="text-xs font-semibold text-red-400 block">
                              Total: -{symbol}
                              {dailyExpenseTotal.toLocaleString("en-IN")}
                            </span>
                          )}
                          {dailyIncomeTotal > 0 && (
                            <span className="text-xs font-semibold text-emerald-400 block">
                              Total: +{symbol}
                              {dailyIncomeTotal.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {items.map((tx) => {
                          const isIncome = tx.type === "INCOME";
                          const isTransfer = tx.type === "TRANSFER";

                          return (
                            <Link
                              key={tx.id}
                              href={`/transactions/${tx.id}`}
                              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#141A24] border border-[#263145] hover:border-blue-500/40 active:scale-98 transition touch-target"
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
                                {tx.runningBalance !== undefined && (
                                  <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                                    Bal: {symbol}{tx.runningBalance.toLocaleString("en-IN")}
                                  </p>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-[#141A24] border border-[#263145] rounded-3xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#263145] text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#1C2433]/50">
                      <th className="py-4 px-6">Date & Time</th>
                      <th className="py-4 px-6">Title</th>
                      <th className="py-4 px-6">Category</th>
                      <th className="py-4 px-6">Account</th>
                      <th className="py-4 px-6 text-right">Amount</th>
                      <th className="py-4 px-6 text-right">Balance</th>
                      <th className="py-4 px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#263145] text-sm">
                    {transactions.map((tx) => {
                      const isIncome = tx.type === "INCOME";
                      const isTransfer = tx.type === "TRANSFER";

                      return (
                        <tr key={tx.id} className="hover:bg-[#1C2433]/50 transition">
                          <td className="py-4 px-6 text-gray-300 whitespace-nowrap">
                            <span className="font-semibold text-white">{tx.transactionDate}</span>
                            <span className="text-xs text-gray-500 block">{tx.transactionTime}</span>
                          </td>
                          <td className="py-4 px-6 font-medium text-white">{tx.title}</td>
                          <td className="py-4 px-6 text-gray-300">
                            <div className="flex items-center gap-2">
                              <IconHelper name={tx.categoryIcon || "Tag"} className="w-4 h-4 text-cyan-400" />
                              <span>{tx.categoryName || "Transfer"}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-300">{tx.accountName || "Bank"}</td>
                          <td className="py-4 px-6 text-right font-bold whitespace-nowrap">
                            <span className={isIncome ? "text-emerald-400" : isTransfer ? "text-cyan-400" : "text-red-400"}>
                              {isIncome ? "+" : isTransfer ? "" : "-"}
                              {symbol}
                              {tx.amount.toLocaleString("en-IN")}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-semibold text-gray-300 whitespace-nowrap">
                            {symbol}{(tx.runningBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Link
                                href={`/transactions/${tx.id}`}
                                className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDuplicate(tx)}
                                className="p-2 text-gray-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition"
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id)}
                                className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* CALENDAR VIEW */}
          {activeTab === "calendar" && (
            <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-cyan-400" />
                  <span>
                    {currentCalendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentCalendarDate(
                        new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1)
                      )
                    }
                    className="p-2 rounded-xl bg-[#1C2433] text-gray-300 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentCalendarDate(
                        new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1)
                      )
                    }
                    className="p-2 rounded-xl bg-[#1C2433] text-gray-300 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid of Days */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 font-semibold mb-2">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => {
                  const startOfMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
                  const firstDayIndex = startOfMonth.getDay();
                  const dayNum = i - firstDayIndex + 1;
                  const daysInMonth = new Date(
                    currentCalendarDate.getFullYear(),
                    currentCalendarDate.getMonth() + 1,
                    0
                  ).getDate();

                  const isValidDay = dayNum > 0 && dayNum <= daysInMonth;

                  const dateString = isValidDay
                    ? `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(
                        2,
                        "0"
                      )}-${String(dayNum).padStart(2, "0")}`
                    : "";

                  const dayTxs = isValidDay ? groupedTransactions[dateString] || [] : [];
                  const dayExpense = dayTxs
                    .filter((t) => t.type === "EXPENSE")
                    .reduce((sum, t) => sum + t.amount, 0);

                  return (
                    <div
                      key={i}
                      className={`min-h-[64px] p-1.5 rounded-xl border flex flex-col justify-between ${
                        isValidDay
                          ? "bg-[#1C2433]/70 border-[#263145]"
                          : "bg-transparent border-transparent opacity-30"
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-300">{isValidDay ? dayNum : ""}</span>
                      {dayExpense > 0 && (
                        <span className="text-[10px] font-bold text-red-400 leading-tight">
                          -{symbol}{dayExpense.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <h3 className="font-bold text-white text-lg">Filter Transactions</h3>
              <button onClick={() => setShowFilterModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Transaction Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                >
                  <option value="">All Types</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                  <option value="TRANSFER">Transfer</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setFilterType("");
                  setFilterAccountId("");
                  setShowFilterModal(false);
                }}
                className="flex-1 py-3 rounded-xl bg-[#1C2433] text-gray-300 font-medium hover:bg-[#263145]"
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
