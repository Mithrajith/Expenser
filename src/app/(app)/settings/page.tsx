"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Coins,
  Moon,
  LogOut,
  Sparkles,
  Loader2,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  X,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; baseCurrency: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // Reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Load user error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setSeedSuccess(true);
        setTimeout(() => setSeedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Seed error:", err);
    } finally {
      setSeeding(false);
    }
  };

  const handleResetData = async () => {
    try {
      setResetting(true);
      const res = await fetch("/api/user/reset", { method: "POST" });
      if (res.ok) {
        setShowResetModal(false);
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Settings</h2>
        <p className="text-xs text-gray-400">Manage your profile, preferences & data reset options</p>
      </div>

      {/* Profile Section */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-xl font-bold text-white shadow-lg">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">{user?.name || "User"}</h3>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-base text-white border-b border-[#263145] pb-3">Preferences</h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-sm font-semibold text-white">Base Currency</p>
              <p className="text-xs text-gray-400">Default currency display</p>
            </div>
          </div>
          <span className="text-sm font-bold text-cyan-400 px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            {user?.baseCurrency || "INR"} (₹)
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#263145]/60">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-sm font-semibold text-white">Appearance</p>
              <p className="text-xs text-gray-400">Modern dark finance theme</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-gray-400 px-3 py-1 rounded-xl bg-[#1C2433]">
            Dark (Default)
          </span>
        </div>
      </div>

      {/* Data Reset & Management */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-base text-white border-b border-[#263145] pb-3 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          <span>Data Management & Reset</span>
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Reset All Data</p>
            <p className="text-xs text-gray-400">Wipe all transactions, accounts, categories & restore defaults</p>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 font-semibold text-xs transition"
          >
            Reset All Data
          </button>
        </div>
      </div>

      {/* Dev Testing Tools */}
      {process.env.NODE_ENV !== "production" && (
        <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-3">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>Developer Utilities</span>
          </h3>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Seed sample transactions for quick local testing</p>
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Seed Test Data"}
            </button>
          </div>

          {seedSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sample transactions seeded successfully!</span>
            </div>
          )}
        </div>
      )}

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-base hover:bg-red-500/25 transition active:scale-98 touch-target"
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out of MoneyTrack</span>
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-white text-lg">Reset All Data?</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              This will permanently erase all your transactions, custom categories, and accounts, restoring default categories and accounts. This action cannot be undone.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3 rounded-xl bg-[#1C2433] text-gray-300 font-medium hover:bg-[#263145] text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleResetData}
                disabled={resetting}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
