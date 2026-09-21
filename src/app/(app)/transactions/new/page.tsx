"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Check } from "lucide-react";

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
  subcategories: string[];
}

export default function AddTransactionPage() {
  const router = useRouter();

  const [type, setType] = useState<"EXPENSE" | "INCOME" | "TRANSFER">("EXPENSE");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("INR");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");

  const now = new Date();
  const [date, setDate] = useState<string>(now.toISOString().substring(0, 10));
  const [time, setTime] = useState<string>(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  );

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const [accRes, catRes] = await Promise.all([
          fetch("/api/accounts"),
          fetch("/api/categories"),
        ]);

        if (accRes.ok) {
          const accData = await accRes.json();
          setAccounts(accData.accounts || []);
          if (accData.accounts?.length > 0) {
            setAccountId(accData.accounts[0].id);
            if (accData.accounts.length > 1) {
              setToAccountId(accData.accounts[1].id);
            }
          }
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
          if (catData.categories?.length > 0) {
            setCategoryId(catData.categories[0].id);
          }
        }
      } catch (err) {
        console.error("Form options error:", err);
      }
    }
    loadFormOptions();
  }, []);

  // Smart suggestions on title input
  useEffect(() => {
    if (title.trim().length > 1) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/suggestions?q=${encodeURIComponent(title)}&field=title`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data.suggestions || []);
          }
        } catch {
          // ignore
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [title]);

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (!accountId) {
      setError("Please select an account");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        type,
        amount: numAmount,
        currency,
        accountId,
        toAccountId: type === "TRANSFER" ? toAccountId : undefined,
        categoryId: type !== "TRANSFER" ? categoryId : undefined,
        subcategoryId: type !== "TRANSFER" ? subcategoryId : undefined,
        title: title || (type === "TRANSFER" ? "Account Transfer" : "Transaction"),
        description,
        transactionDate: date,
        transactionTime: time,
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save transaction");

      router.push("/transactions");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const symbol = "₹";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2.5 rounded-2xl bg-[#141A24] border border-[#263145] text-gray-300 hover:text-white transition touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">Add Transaction</h2>
          <p className="text-xs text-gray-400">Record a new income, expense, or transfer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Transaction Type Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#141A24] rounded-2xl border border-[#263145]">
          <button
            type="button"
            onClick={() => setType("EXPENSE")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${
              type === "EXPENSE"
                ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType("INCOME")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${
              type === "INCOME"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setType("TRANSFER")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${
              type === "TRANSFER"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-md"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Transfer
          </button>
        </div>

        {/* Large Prominent Amount Card */}
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 text-center space-y-2 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Amount</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-gray-400">{symbol}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full max-w-xs text-4xl sm:text-5xl font-black text-white bg-transparent text-center focus:outline-none placeholder-gray-600"
            />
          </div>
        </div>

        {/* Details Fields Card */}
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl">
          {/* Title / Note with Suggestions */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Title / Note
            </label>
            <input
              type="text"
              required
              placeholder={type === "EXPENSE" ? "e.g. College Lunch" : "e.g. Salary"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-[#1C2433] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-base"
            />

            {/* Smart Suggestions Chips */}
            {suggestions.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                {suggestions.map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => {
                      setTitle(sugg);
                      setSuggestions([]);
                    }}
                    className="text-xs px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/20 transition"
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account Selection */}
          {type === "TRANSFER" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">From Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">To Account</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId("");
                  }}
                  className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                >
                  {categories
                    .filter((c) => c.type === type)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Subcategory selection if available */}
          {type !== "TRANSFER" && selectedCategoryObj && selectedCategoryObj.subcategories?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Subcategory</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {selectedCategoryObj.subcategories.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubcategoryId(sub === subcategoryId ? "" : sub)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border whitespace-nowrap transition ${
                      subcategoryId === sub
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-[#1C2433] border-[#263145] text-gray-300 hover:text-white"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Additional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Sticky Save Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-base shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 touch-target"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>Save Transaction</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
