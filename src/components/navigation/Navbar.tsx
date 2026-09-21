"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ReceiptText,
  Plus,
  BarChart3,
  MoreHorizontal,
  Wallet,
  Tags,
  FileSpreadsheet,
  Settings,
  LogOut,
  X,
} from "lucide-react";

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navItems = [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Trans", href: "/transactions", icon: ReceiptText },
    { label: "Add", href: "/transactions/new", icon: Plus, isAddButton: true },
    { label: "Stats", href: "/analytics", icon: BarChart3 },
    { label: "More", href: "#more", icon: MoreHorizontal, isMore: true },
  ];

  const desktopSidebarItems = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Transactions", href: "/transactions", icon: ReceiptText },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Accounts", href: "/accounts", icon: Wallet },
    { label: "Categories", href: "/categories", icon: Tags },
    { label: "Import / Export", href: "/import-export", icon: FileSpreadsheet },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#141A24] border-r border-[#263145] h-screen sticky top-0 p-4 justify-between z-30">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-[#263145]">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/20">
              MT
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-wide">MoneyTrack</h1>
              <p className="text-xs text-gray-400">Personal Finance</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            <Link
              href="/transactions/new"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/25 hover:opacity-95 transition active:scale-98 mb-4 touch-target"
            >
              <Plus className="w-5 h-5" />
              <span>Add Transaction</span>
            </Link>

            {desktopSidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition touch-target ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                      : "text-gray-400 hover:text-gray-200 hover:bg-[#1C2433]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div className="pt-4 border-t border-[#263145]">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition touch-target"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-nav z-40 px-2 py-1.5 flex items-center justify-around border-t border-[#263145]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isAddButton) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center -mt-6 w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 text-white shadow-xl shadow-blue-500/40 border-4 border-[#0B0E14] active:scale-90 transition touch-target"
                aria-label="Add Transaction"
              >
                <Plus className="w-7 h-7" />
              </Link>
            );
          }

          if (item.isMore) {
            return (
              <button
                key={item.label}
                onClick={() => setShowMoreMenu(true)}
                className="flex flex-col items-center justify-center w-14 py-1 text-xs text-gray-400 hover:text-gray-200 touch-target"
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-14 py-1 text-xs transition touch-target ${
                isActive ? "text-blue-400 font-semibold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile More Sheet */}
      {showMoreMenu && (
        <div className="md:hidden fixed inset-0 z-50 glass-card bg-black/70 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#141A24] rounded-t-3xl border-t border-[#263145] p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <h2 className="text-lg font-bold text-white">More Options</h2>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 text-gray-400 hover:text-white rounded-full bg-[#1C2433]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link
                href="/accounts"
                onClick={() => setShowMoreMenu(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#1C2433] border border-[#263145] hover:border-blue-500/40 text-center"
              >
                <Wallet className="w-6 h-6 text-blue-400" />
                <span className="text-sm font-medium text-white">Accounts</span>
              </Link>
              <Link
                href="/categories"
                onClick={() => setShowMoreMenu(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#1C2433] border border-[#263145] hover:border-blue-500/40 text-center"
              >
                <Tags className="w-6 h-6 text-emerald-400" />
                <span className="text-sm font-medium text-white">Categories</span>
              </Link>
              <Link
                href="/import-export"
                onClick={() => setShowMoreMenu(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#1C2433] border border-[#263145] hover:border-blue-500/40 text-center"
              >
                <FileSpreadsheet className="w-6 h-6 text-purple-400" />
                <span className="text-sm font-medium text-white">Import / Export</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setShowMoreMenu(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#1C2433] border border-[#263145] hover:border-blue-500/40 text-center"
              >
                <Settings className="w-6 h-6 text-cyan-400" />
                <span className="text-sm font-medium text-white">Settings</span>
              </Link>
            </div>

            <button
              onClick={() => {
                setShowMoreMenu(false);
                setShowLogoutModal(true);
              }}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/25 transition mt-4 touch-target"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Log out of MoneyTrack?</h3>
            <p className="text-sm text-gray-400">
              You will be signed out of your session on this device.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-[#1C2433] text-gray-300 font-medium hover:bg-[#263145] transition touch-target"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition touch-target"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
