"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2, Check, Copy } from "lucide-react";

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

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [txRes, accRes, catRes] = await Promise.all([
          fetch(`/api/transactions/${id}`),
          fetch("/api/accounts"),
          fetch("/api/categories"),
        ]);

        if (accRes.ok) {
          const accData = await accRes.json();
          setAccounts(accData.accounts || []);
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData.categories || []);
        }

        if (txRes.ok) {
          const txData = await txRes.json();
          const tx = txData.transaction;
          setType(tx.type);
          setAmount(String(tx.amount));
          setCurrency(tx.currency || "INR");
          setTitle(tx.title || "");
          setDescription(tx.description || "");
          setAccountId(tx.accountId ? tx.accountId.toString() : "");
          setToAccountId(tx.toAccountId ? tx.toAccountId.toString() : "");
          setCategoryId(tx.categoryId ? tx.categoryId.toString() : "");
          setSubcategoryId(tx.subcategoryId || "");
          setDate(tx.transactionDate);
          setTime(tx.transactionTime);
        } else {
          setError("Transaction not found");
        }
      } catch (err) {
        console.error("Load edit transaction error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        type,
        amount: numAmount,
        currency,
        accountId,
        toAccountId: type === "TRANSFER" ? toAccountId : undefined,
        categoryId: type !== "TRANSFER" ? categoryId : undefined,
        subcategoryId: type !== "TRANSFER" ? subcategoryId : undefined,
        title,
        description,
        transactionDate: date,
        transactionTime: time,
      };

      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save changes");
      }

      router.push("/transactions");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete transaction");

      router.push("/transactions");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading details...</p>
      </div>
    );
  }

  const symbol = "₹";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-2xl bg-[#141A24] border border-[#263145] text-gray-300 hover:text-white transition touch-target"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Edit Transaction</h2>
            <p className="text-xs text-gray-400">Update transaction details</p>
          </div>
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition touch-target"
          title="Delete Transaction"
        >
          <Trash2 className="w-5 h-5" />
        </button>
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

        {/* Amount Input */}
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 text-center space-y-2 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Amount</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-gray-400">{symbol}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full max-w-xs text-4xl sm:text-5xl font-black text-white bg-transparent text-center focus:outline-none"
            />
          </div>
        </div>

        {/* Form Fields Card */}
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Title / Note</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 active:scale-98 touch-target"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>Save Changes</span>
          </button>
        </div>
      </form>

      {/* Delete Warning Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-xl font-bold text-white">Delete this transaction?</h3>
            <p className="text-sm text-gray-400">
              This will update your account balance and analytics recalculations automatically.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl bg-[#1C2433] text-gray-300 font-medium hover:bg-[#263145]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
