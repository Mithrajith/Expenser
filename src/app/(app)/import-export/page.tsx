"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Database,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function ImportExportPage() {
  const [activeTab, setActiveTab] = useState<"excel" | "sqlite" | "csv" | "backup">("excel");

  // Excel state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    date: "",
    type: "",
    amount: "",
    account: "",
    category: "",
    title: "",
  });

  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    totalRows?: number;
    importedCount?: number;
    duplicateCount?: number;
    tables?: string[];
  } | null>(null);
  const [error, setError] = useState("");

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setError("");
    setImportResult(null);

    // Get preview
    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await fetch("/api/import/excel", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setSampleRows(data.sampleRows || []);
        if (data.sampleRows && data.sampleRows.length > 0) {
          const headers = Object.keys(data.sampleRows[0]);
          setExcelHeaders(headers);

          // Auto-guess mapping
          setColumnMapping({
            date: headers.find((h) => /date/i.test(h)) || headers[0] || "",
            type: headers.find((h) => /type|income|expense/i.test(h)) || headers[1] || "",
            amount: headers.find((h) => /amount|gbp|inr|usd/i.test(h)) || headers[2] || "",
            account: headers.find((h) => /account|bank/i.test(h)) || "",
            category: headers.find((h) => /cat/i.test(h)) || "",
            title: headers.find((h) => /note|title|desc/i.test(h)) || headers[3] || "",
          });
        }
      }
    } catch (err) {
      console.error("Preview error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteExcelImport = async () => {
    if (!excelFile) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", excelFile);
    formData.append("mapping", JSON.stringify(columnMapping));

    try {
      const res = await fetch("/api/import/excel", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import");
      setImportResult(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSqliteImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/sqlite", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import SQLite file");
      setImportResult(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/csv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import CSV");
      setImportResult(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Restoring a backup will overwrite your current transactions & accounts. Continue?")) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/backup/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore backup");
      alert("Backup restored successfully!");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Import & Export Data</h2>
        <p className="text-xs text-gray-400">Migrate your transactions via Excel, SQLite WASM, CSV or full JSON Backups</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#141A24] rounded-2xl border border-[#263145] overflow-x-auto no-scrollbar">
        {[
          { key: "excel", label: "Excel (.xlsx)", icon: FileSpreadsheet },
          { key: "sqlite", label: "SQLite (.db)", icon: Database },
          { key: "csv", label: "CSV File", icon: FileText },
          { key: "backup", label: "Full Backup", icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                setImportResult(null);
                setError("");
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
                activeTab === tab.key ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {importResult && (
        <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
            <CheckCircle2 className="w-5 h-5" />
            <span>Import Completed Successfully!</span>
          </div>
          <div className="text-xs text-gray-300 space-y-1 pl-7">
            {importResult.totalRows !== undefined && <p>Total rows parsed: {importResult.totalRows}</p>}
            {importResult.importedCount !== undefined && <p>Records imported: {importResult.importedCount}</p>}
            {importResult.duplicateCount !== undefined && <p>Duplicates skipped: {importResult.duplicateCount}</p>}
          </div>
        </div>
      )}

      {/* Tab 1: Excel Import / Export */}
      {activeTab === "excel" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Excel Upload Card */}
            <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                <span>Import Excel Spreadsheet</span>
              </h3>

              <div className="border-2 border-dashed border-[#263145] hover:border-blue-500/50 rounded-2xl p-6 text-center space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-gray-500 mx-auto" />
                <p className="text-sm font-semibold text-gray-300">Upload .xlsx or .xls file</p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileChange}
                  className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
              </div>

              {/* Column Mapping Section if headers exist */}
              {excelHeaders.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-[#263145]">
                  <h4 className="text-sm font-bold text-white">Match Columns:</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-gray-400 block mb-1">Date</label>
                      <select
                        value={columnMapping.date}
                        onChange={(e) => setColumnMapping({ ...columnMapping, date: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                      >
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-400 block mb-1">Amount</label>
                      <select
                        value={columnMapping.amount}
                        onChange={(e) => setColumnMapping({ ...columnMapping, amount: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                      >
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-400 block mb-1">Type (Income/Expense)</label>
                      <select
                        value={columnMapping.type}
                        onChange={(e) => setColumnMapping({ ...columnMapping, type: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                      >
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-400 block mb-1">Title / Note</label>
                      <select
                        value={columnMapping.title}
                        onChange={(e) => setColumnMapping({ ...columnMapping, title: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                      >
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteExcelImport}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Run Excel Import"}
                  </button>
                </div>
              )}
            </div>

            {/* Export Card */}
            <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Download className="w-5 h-5 text-emerald-400" />
                  <span>Export Excel Workbook</span>
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Download a structured multi-sheet .xlsx workbook containing your Transactions, Accounts, Categories, and Monthly Summary.
                </p>
              </div>

              <a
                href="/api/export/excel"
                download
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm text-center shadow-lg transition"
              >
                Download Excel Workbook
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: SQLite Import / Export */}
      {activeTab === "sqlite" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              <span>Import SQLite (.db)</span>
            </h3>
            <p className="text-xs text-gray-400">
              Upload a .db file. It will be parsed client-side / in serverless using sql.js WASM engine into MongoDB documents.
            </p>
            <input
              type="file"
              accept=".db, .sqlite, .sqlite3"
              onChange={handleSqliteImport}
              className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white"
            />
          </div>

          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                <span>Export SQLite Database</span>
              </h3>
              <p className="text-xs text-gray-400 mt-2">
                Generate a portable .db file containing transactions, accounts, and categories without auth credentials.
              </p>
            </div>
            <a
              href="/api/export/sqlite"
              download
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm text-center shadow-lg transition"
            >
              Download SQLite (.db)
            </a>
          </div>
        </div>
      )}

      {/* Tab 3: CSV Import / Export */}
      {activeTab === "csv" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              <span>Import CSV</span>
            </h3>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white"
            />
          </div>

          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                <span>Export CSV</span>
              </h3>
            </div>
            <a
              href="/api/export/csv"
              download
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm text-center shadow-lg transition"
            >
              Download CSV
            </a>
          </div>
        </div>
      )}

      {/* Tab 4: Full Backup & Restore */}
      {activeTab === "backup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-cyan-400" />
                <span>Create Full Backup</span>
              </h3>
              <p className="text-xs text-gray-400 mt-2">
                Generates a JSON backup file containing all accounts, categories, and transactions (excluding password hashes).
              </p>
            </div>
            <a
              href="/api/backup/export"
              download
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm text-center shadow-lg transition"
            >
              Export JSON Backup
            </a>
          </div>

          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              <span>Restore Backup</span>
            </h3>
            <p className="text-xs text-gray-400">
              Upload a previously exported JSON backup file to restore your entire database.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleBackupRestore}
              className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-600 file:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
