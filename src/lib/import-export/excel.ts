import * as XLSX from "xlsx";

export interface ColumnMapping {
  date: string;
  type: string;
  amount: string;
  account: string;
  category: string;
  subcategory?: string;
  title?: string;
  description?: string;
  currency?: string;
}

export function parseExcelBuffer(buffer: ArrayBuffer): { sheets: string[]; previewData: Record<string, unknown>[] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

  return {
    sheets: workbook.SheetNames,
    previewData: jsonData.slice(0, 50),
  };
}

export function generateExcelWorkbook(
  transactions: Record<string, unknown>[],
  accounts: Record<string, unknown>[],
  categories: Record<string, unknown>[],
  summary: Record<string, unknown>[]
): Buffer {
  const wb = XLSX.utils.book_new();

  const wsTrans = XLSX.utils.json_to_sheet(transactions);
  const wsAcc = XLSX.utils.json_to_sheet(accounts);
  const wsCat = XLSX.utils.json_to_sheet(categories);
  const wsSum = XLSX.utils.json_to_sheet(summary);

  XLSX.utils.book_append_sheet(wb, wsTrans, "Transactions");
  XLSX.utils.book_append_sheet(wb, wsAcc, "Accounts");
  XLSX.utils.book_append_sheet(wb, wsCat, "Categories");
  XLSX.utils.book_append_sheet(wb, wsSum, "Monthly Summary");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
