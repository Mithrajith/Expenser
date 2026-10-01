"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  CheckSquare,
  Square,
  Download,
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

function formatDateRangeLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "All dates";

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${startDate}T00:00:00`))} - ${formatter.format(
    new Date(`${endDate}T00:00:00`)
  )}`;
}

function parseDateKey(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return isNaN(date.getTime()) ? new Date() : date;
}

function formatGroupDateLabel(date: Date) {
  const dayNum = date.getDate();
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const monthYearStr = date.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
  return { dayNum, dayName, monthYearStr };
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type ViewGroup = {
  key: string;
  title: string;
  subtitle?: string;
  items: Transaction[];
  income: number;
  expense: number;
  startDate: string;
};

function buildViewGroups(transactions: Transaction[], tab: "daily" | "calendar" | "weekly" | "monthly") {
  const groups = new Map<string, ViewGroup>();

  for (const tx of transactions) {
    const dateKey = tx.transactionDate ? tx.transactionDate.substring(0, 10) : "Undated";
    const txDate = parseDateKey(dateKey);

    let key = dateKey;
    let title = dateKey;
    let subtitle: string | undefined;
    let sortDate = dateKey;

    if (tab === "weekly") {
      const weekStart = startOfWeek(txDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      key = `week-${weekStart.toISOString().slice(0, 10)}`;
      title = `Week of ${formatShortDate(weekStart)}`;
      subtitle = `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
      sortDate = weekStart.toISOString().slice(0, 10);
    } else if (tab === "monthly") {
      key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      title = txDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      subtitle = "Monthly summary";
      sortDate = key;
    } else {
      const { dayNum, dayName, monthYearStr } = formatGroupDateLabel(txDate);
      key = dateKey;
      title = `${dayName} ${dayNum}`;
      subtitle = monthYearStr;
      sortDate = dateKey;
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title,
        subtitle,
        items: [],
        income: 0,
        expense: 0,
        startDate: sortDate,
      });
    }

    const group = groups.get(key)!;
    group.items.push(tx);
    if (tx.type === "INCOME") group.income += tx.amount;
    if (tx.type === "EXPENSE") group.expense += tx.amount;
  }

  return Array.from(groups.values()).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"daily" | "calendar" | "weekly" | "monthly">("daily");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [filtersReady, setFiltersReady] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);

  // Filters
  const [filterType, setFilterType] = useState<string>("");
  const [filterAccountId, setFilterAccountId] = useState<string>("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  useEffect(() => {
    async function loadFilterRange() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setSearch(data.user?.transactionSearch || "");
          setFilterType(data.user?.transactionType || "");
          setFilterAccountId(data.user?.transactionAccountId || "");
          setFilterCategoryId(data.user?.transactionCategoryId || "");
          setFilterStartDate(data.user?.transactionStartDate || "");
          setFilterEndDate(data.user?.transactionEndDate || "");
        }
      } catch {
        setFilterStartDate("");
        setFilterEndDate("");
      } finally {
        setFiltersReady(true);
      }
    }

    loadFilterRange();
  }, []);

  useEffect(() => {
    if (!filtersReady) return;

    try {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionSearch: search,
          transactionType: filterType,
          transactionAccountId: filterAccountId,
          transactionCategoryId: filterCategoryId,
          transactionStartDate: filterStartDate,
          transactionEndDate: filterEndDate,
        }),
      }).catch(() => undefined);
    } catch {
      // ignore persistence failures
    }
  }, [search, filterType, filterAccountId, filterCategoryId, filterStartDate, filterEndDate, filtersReady]);

  useEffect(() => {
    if (!filtersReady) return;

    const urlSearch = searchParams.get("search");
    const urlType = searchParams.get("type");
    const urlAccountId = searchParams.get("accountId");
    const urlCategoryId = searchParams.get("categoryId");
    const urlStartDate = searchParams.get("startDate");
    const urlEndDate = searchParams.get("endDate");

    if (urlSearch !== null) setSearch(urlSearch);
    if (urlType) setFilterType(urlType);
    if (urlAccountId) setFilterAccountId(urlAccountId);
    if (urlCategoryId) setFilterCategoryId(urlCategoryId);
    if (urlStartDate) setFilterStartDate(urlStartDate);
    if (urlEndDate) setFilterEndDate(urlEndDate);
  }, [filtersReady, searchParams]);

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
      if (filterCategoryId) params.set("categoryId", filterCategoryId);
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);

      const [transactionsRes, summaryRes] = await Promise.all([
        fetch(`/api/transactions?${params.toString()}`),
        fetch("/api/analytics/summary"),
      ]);

      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data.transactions || []);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setCurrentBalance(summaryData.totalBalance || 0);
      }
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterAccountId, filterCategoryId, filterStartDate, filterEndDate]);

  const toggleSelectedTransaction = (id: string) => {
    setSelectedTransactionIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  };

  const clearSelection = () => setSelectedTransactionIds([]);

  const selectedTransactions = transactions.filter((transaction) => selectedTransactionIds.includes(transaction.id));

  const downloadCsv = (rows: Transaction[]) => {
    if (rows.length === 0) return;

    const headers = ["Date", "Time", "Type", "Title", "Category", "Account", "Amount", "Currency"];
    const csvRows = rows.map((row) => [
      row.transactionDate,
      row.transactionTime,
      row.type,
      row.title,
      row.categoryName || "",
      row.accountName || "",
      row.amount,
      row.currency,
    ]);

    const csv = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDelete = async () => {
    if (selectedTransactionIds.length === 0) return;
    if (!confirm(`Delete ${selectedTransactionIds.length} selected transactions?`)) return;

    await Promise.all(selectedTransactionIds.map((id) => fetch(`/api/transactions/${id}`, { method: "DELETE" })));
    clearSelection();
    fetchTransactions();
  };

  const bulkDuplicate = async () => {
    if (selectedTransactionIds.length === 0) return;
    const selected = selectedTransactions;
    await Promise.all(
      selected.map((tx) =>
        fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            accountId: tx.accountName,
            title: `${tx.title} (Copy)`,
            description: tx.description || "",
            subcategoryId: tx.subcategoryId || "",
            transactionDate: new Date().toISOString().substring(0, 10),
            transactionTime: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
          }),
        })
      )
    );
    clearSelection();
    fetchTransactions();
  };

  useEffect(() => {
    if (!filtersReady) return;

    const timer = setTimeout(() => {
      fetchTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTransactions, filtersReady]);

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

  const viewGroups = buildViewGroups(transactions, activeTab);

  const symbol = "₹";

  // Calculate totals
  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);
  const activeRangeLabel = formatDateRangeLabel(filterStartDate, filterEndDate);

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Transactions</h2>
          <p className="text-xs text-gray-400">Activity timeline, running balances & multi-period views</p>
          <p className="text-[11px] text-cyan-400 mt-1 font-medium">Showing {activeRangeLabel}</p>
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
            aria-label="Open filters"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => downloadCsv(selectedTransactions.length > 0 ? selectedTransactions : transactions)}
            className="p-2.5 rounded-xl bg-[#141A24] border border-[#263145] text-gray-300 hover:text-white hover:border-blue-500/50 transition touch-target"
            aria-label="Export transactions as CSV"
          >
            <Download className="w-4 h-4" />
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

      {selectedTransactionIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#141A24] border border-[#263145]">
          <p className="text-sm text-gray-300 font-medium">{selectedTransactionIds.length} selected</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={bulkDuplicate}
              className="px-3 py-2 rounded-xl bg-[#1C2433] text-cyan-300 border border-cyan-500/20 text-xs font-semibold hover:bg-cyan-500/10"
            >
              Duplicate selected
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(selectedTransactions)}
              className="px-3 py-2 rounded-xl bg-[#1C2433] text-emerald-300 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/10"
            >
              Export selected CSV
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              className="px-3 py-2 rounded-xl bg-[#1C2433] text-red-300 border border-red-500/20 text-xs font-semibold hover:bg-red-500/10"
            >
              Delete selected
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-2 rounded-xl bg-[#1C2433] text-gray-300 border border-[#263145] text-xs font-semibold hover:bg-[#263145]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
          <p className="text-base font-bold text-white mt-0.5">{symbol}{currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 bg-[#141A24] p-1 rounded-2xl border border-[#263145] max-w-md">
        {(["daily", "calendar", "weekly", "monthly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-label={`Switch to ${tab} transaction view`}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117] ${
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
        <div className="space-y-6" aria-busy="true" aria-live="polite">
          <div className="flex flex-col gap-3">
            <div className="h-8 w-64 rounded-xl bg-[#1C2433] animate-pulse" />
            <div className="h-4 w-80 rounded-xl bg-[#1C2433] animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 rounded-3xl bg-[#141A24] border border-[#263145] animate-pulse" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-20 rounded-2xl bg-[#141A24] border border-[#263145] animate-pulse" />
            ))}
          </div>
        </div>
      ) : viewGroups.length === 0 ? (
        <div className="text-center py-16 bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-3">
          <CalendarIcon className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-base font-semibold text-gray-300">No transactions found</p>
          <p className="text-xs text-gray-500">Try adjusting your filters or import your transactions.</p>
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]"
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
                {viewGroups.map((group) => {
                  const latestBalance = group.items[0]?.runningBalance;

                  return (
                    <div key={group.key} className="space-y-2">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#263145]/60 bg-[#141A24]/40 rounded-t-xl">
                        <div className="flex items-center gap-2.5">
                          {activeTab === "daily" ? (
                            <span className="text-xl font-black text-white">
                              {parseDateKey(group.startDate).getDate()}
                            </span>
                          ) : (
                            <span className="text-xl font-black text-white">{group.title}</span>
                          )}
                          <div>
                            <span className="text-xs font-bold text-gray-300 tracking-wider block">
                              {activeTab === "daily" ? parseDateKey(group.startDate).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase() : group.subtitle}
                            </span>
                            {latestBalance !== undefined && (
                              <span className="text-[11px] font-semibold text-cyan-400 block">
                                Balance: {symbol}{latestBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {group.expense > 0 && (
                            <span className="text-xs font-semibold text-red-400 block">
                              Total: -{symbol}
                              {group.expense.toLocaleString("en-IN")}
                            </span>
                          )}
                          {group.income > 0 && (
                            <span className="text-xs font-semibold text-emerald-400 block">
                              Total: +{symbol}
                              {group.income.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((tx) => {
                          const isIncome = tx.type === "INCOME";
                          const isTransfer = tx.type === "TRANSFER";
                          const isSelected = selectedTransactionIds.includes(tx.id);

                          return (
                            <div
                              key={tx.id}
                              className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#141A24] border transition touch-target ${
                                isSelected ? "border-blue-500/50 bg-blue-500/5" : "border-[#263145] hover:border-blue-500/40"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleSelectedTransaction(tx.id)}
                                className="shrink-0 text-gray-400 hover:text-white"
                                aria-label={isSelected ? `Deselect ${tx.title}` : `Select ${tx.title}`}
                              >
                                {isSelected ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5" />}
                              </button>

                              <Link href={`/transactions/${tx.id}`} className="flex items-center justify-between flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117]" aria-label={`Open ${tx.title}`}>
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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Grouped Timeline Cards */}
              <div className="hidden md:block space-y-6">
                {viewGroups.map((group) => {
                  const latestBalance = group.items[0]?.runningBalance;

                  return (
                    <div key={group.key} className="bg-[#141A24] border border-[#263145] rounded-3xl overflow-hidden shadow-xl">
                      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#263145] bg-[#1C2433]/50">
                        <div>
                          <p className="text-sm font-bold text-white">{group.title}</p>
                          {group.subtitle && <p className="text-xs text-gray-400 mt-0.5">{group.subtitle}</p>}
                        </div>
                        <div className="text-right">
                          {latestBalance !== undefined && (
                            <p className="text-[11px] font-semibold text-cyan-400">Balance: {symbol}{latestBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                          )}
                          <p className="text-[11px] font-semibold text-emerald-400">+{symbol}{group.income.toLocaleString("en-IN")}</p>
                          <p className="text-[11px] font-semibold text-red-400">-{symbol}{group.expense.toLocaleString("en-IN")}</p>
                        </div>
                      </div>

                      <div className="divide-y divide-[#263145]">
                        {group.items.map((tx) => {
                          const isIncome = tx.type === "INCOME";
                          const isTransfer = tx.type === "TRANSFER";
                          const isSelected = selectedTransactionIds.includes(tx.id);

                          return (
                            <div key={tx.id} className={`grid grid-cols-[40px_minmax(120px,180px)_1fr_140px_120px] gap-4 px-6 py-4 items-center transition hover:bg-[#1C2433]/40 ${isSelected ? "bg-blue-500/5" : ""}`}>
                              <button
                                type="button"
                                onClick={() => toggleSelectedTransaction(tx.id)}
                                className="text-gray-400 hover:text-white"
                                aria-label={isSelected ? `Deselect ${tx.title}` : `Select ${tx.title}`}
                              >
                                {isSelected ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5" />}
                              </button>
                              <div className="text-gray-300 whitespace-nowrap">
                                <span className="font-semibold text-white block">{tx.transactionDate}</span>
                                <span className="text-xs text-gray-500 block">{tx.transactionTime}</span>
                              </div>
                              <div className="font-medium text-white">
                                <div className="flex items-center gap-2">
                                  <IconHelper name={tx.categoryIcon || "Tag"} className="w-4 h-4 text-cyan-400" />
                                  <span>{tx.title}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{tx.categoryName || "Transfer"} • {tx.accountName || "Bank"}</p>
                              </div>
                              <div className="text-right font-bold whitespace-nowrap">
                                <span className={isIncome ? "text-emerald-400" : isTransfer ? "text-cyan-400" : "text-red-400"}>
                                  {isIncome ? "+" : isTransfer ? "" : "-"}
                                  {symbol}
                                  {tx.amount.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                <Link
                                  href={`/transactions/${tx.id}`}
                                  className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition"
                                  title="Edit"
                                  aria-label={`Edit ${tx.title}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => handleDuplicate(tx)}
                                  className="p-2 text-gray-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition"
                                  title="Duplicate"
                                  aria-label={`Duplicate ${tx.title}`}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(tx.id)}
                                  className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                                  title="Delete"
                                  aria-label={`Delete ${tx.title}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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

                  const dayTxs = isValidDay
                    ? transactions.filter((t) => t.transactionDate?.substring(0, 10) === dateString)
                    : [];
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">To Date</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                  />
                </div>
              </div>

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
                  setSearch("");
                  setFilterType("");
                  setFilterAccountId("");
                  setFilterCategoryId("");
                  setFilterStartDate("");
                  setFilterEndDate("");
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
