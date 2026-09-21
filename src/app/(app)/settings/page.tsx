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
  Lock,
  Mail,
  Edit3,
  Eye,
  EyeOff,
  Save,
  Key,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; baseCurrency: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("INR");

  // Password update state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Eye icon toggles
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Save feedback state
  const [saving, setSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Dev seed state
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
          setName(data.user.name || "");
          setEmail(data.user.email || "");
          setBaseCurrency(data.user.baseCurrency || "INR");
        }
      } catch (err) {
        console.error("Load user error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (showPasswordSection) {
      if (!currentPassword) {
        setProfileError("Please enter your current password to set a new password");
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setProfileError("New password must be at least 6 characters long");
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileError("New passwords do not match");
        return;
      }
    }

    try {
      setSaving(true);
      const body: Record<string, string> = {
        name,
        email,
        baseCurrency,
      };

      if (showPasswordSection && newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setUser(data.user);
      setProfileSuccess("Profile updated successfully!");

      // Clear password fields if changed
      if (showPasswordSection) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
      }

      setTimeout(() => setProfileSuccess(""), 4000);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError("An unexpected error occurred");
      }
    } finally {
      setSaving(false);
    }
  };

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
        <p className="text-xs text-gray-400">Manage your profile, credentials & preferences</p>
      </div>

      {/* Editable User Profile & Password Card */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#263145] pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-xl font-bold text-white shadow-lg">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{user?.name || "User"}</h3>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-xl">
            Editable Profile
          </span>
        </div>

        {profileSuccess && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* User Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Full Name / Username
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
              />
            </div>
          </div>

          {/* Base Currency */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Base Currency
            </label>
            <div className="relative">
              <Coins className="w-5 h-5 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm appearance-none cursor-pointer"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Password Change Toggle Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition"
            >
              <Key className="w-4 h-4" />
              <span>{showPasswordSection ? "Cancel Password Change" : "Change Password?"}</span>
            </button>
          </div>

          {/* Password Change Fields */}
          {showPasswordSection && (
            <div className="p-4 rounded-2xl bg-[#1C2433]/70 border border-[#263145] space-y-3.5 animate-fadeIn">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Update Password</span>
              </h4>

              {/* Current Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#141A24] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    aria-label={showCurrentPass ? "Hide password" : "Show password"}
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#141A24] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    aria-label={showNewPass ? "Hide password" : "Show password"}
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#141A24] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    aria-label={showConfirmPass ? "Hide password" : "Show password"}
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Preferences Section */}
      <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-base text-white border-b border-[#263145] pb-3">Preferences</h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5 text-cyan-400" />
            <div>
              <p className="text-sm font-semibold text-white">Active Currency</p>
              <p className="text-xs text-gray-400">Selected currency display</p>
            </div>
          </div>
          <span className="text-sm font-bold text-cyan-400 px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            {user?.baseCurrency || "INR"}
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
