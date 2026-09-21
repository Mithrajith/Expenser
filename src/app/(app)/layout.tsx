import React from "react";
import { Navbar } from "@/components/navigation/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0E14] md:flex text-gray-100">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-8 max-w-7xl mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 md:pt-6">
        {children}
      </main>
    </div>
  );
}
