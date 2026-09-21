"use client";

import React, { useEffect, useState } from "react";
import { Plus, Loader2, Wallet, Building2, CreditCard, Banknote, Edit2, Trash2, X } from "lucide-react";
import { IconHelper } from "@/components/ui/IconHelper";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  icon: string;
  color: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState("BANK");
  const [currency, setCurrency] = useState("INR");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [icon, setIcon] = useState("Building2");
  const [color, setColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error("Fetch accounts error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openCreateModal = () => {
    setEditingAcc(null);
    setName("");
    setType("BANK");
    setCurrency("INR");
    setOpeningBalance("0");
    setIcon("Building2");
    setColor("#3B82F6");
    setShowModal(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setCurrency(acc.currency || "INR");
    setOpeningBalance(String(acc.openingBalance || 0));
    setIcon(acc.icon || "Wallet");
    setColor(acc.color || "#3B82F6");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        type,
        currency,
        openingBalance: parseFloat(openingBalance) || 0,
        icon,
        color,
      };

      const url = editingAcc ? `/api/accounts/${editingAcc.id}` : "/api/accounts";
      const method = editingAcc ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        fetchAccounts();
      }
    } catch (err) {
      console.error("Save account error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account? Only accounts with 0 transactions can be deleted.")) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete account");
      }
    } catch (err) {
      console.error("Delete account error:", err);
    }
  };

  const totalNetWorth = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const symbol = "₹";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Accounts</h2>
          <p className="text-xs text-gray-400">Manage your banks, cash, wallets and cards</p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition touch-target"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Net Worth Summary Card */}
      <div className="gradient-balance rounded-3xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Net Worth</p>
          <h3 className="text-3xl font-extrabold text-white mt-1">
            {symbol}
            {totalNetWorth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </h3>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
          <Wallet className="w-6 h-6" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          <p className="text-xs text-gray-400">Loading your accounts...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-[#141A24] border border-[#263145] hover:border-blue-500/40 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: acc.color || "#3B82F6" }}
                  >
                    <IconHelper name={acc.icon || "Building2"} className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">{acc.name}</h4>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{acc.type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(acc)}
                    className="p-1.5 text-gray-400 hover:text-blue-400 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#263145]/60 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-gray-500">Opening: {symbol}{acc.openingBalance.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-400">Current Balance</p>
                </div>
                <span className="text-xl font-black text-white">
                  {symbol}
                  {acc.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <h3 className="font-bold text-white text-lg">{editingAcc ? "Edit Account" : "Add Account"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SBI Savings"
                  className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="CASH">Cash</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="WALLET">Wallet</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Opening Balance</label>
                  <input
                    type="number"
                    step="any"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#1C2433] text-gray-300 font-medium hover:bg-[#263145]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
