import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

function escapePdfText(value: unknown) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function formatMoney(amount: number, currency?: string) {
  const value = Number.isFinite(amount) ? amount.toLocaleString("en-IN") : "0";
  return currency ? `${value} ${currency}` : value;
}

function formatRangeLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "All dates";

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} to ${endDate}`;
  }

  return `${formatter.format(start)} to ${formatter.format(end)}`;
}

function getCategoryLabel(transaction: Record<string, any>, categoryLookup: Map<string, string>) {
  const categoryId = transaction.categoryId ? String(transaction.categoryId) : "";
  const categoryName = transaction.categoryName || (categoryId ? categoryLookup.get(categoryId) : "") || "";
  const subcategory = transaction.subcategoryName || transaction.subcategoryId || "";
  return subcategory ? `${categoryName} / ${subcategory}` : categoryName || "";
}

function getAccountLabel(transaction: Record<string, any>, accountLookup: Map<string, string>) {
  const accountId = transaction.accountId ? String(transaction.accountId) : "";
  return transaction.accountName || (accountId ? accountLookup.get(accountId) : "") || "";
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";

  const db = await getDb();
  const userObjectId = new ObjectId(session.id);

  const dateMatch: Record<string, unknown> = { userId: userObjectId };
  if (startDate || endDate) {
    dateMatch.transactionDate = {};
    if (startDate) (dateMatch.transactionDate as Record<string, string>).$gte = startDate;
    if (endDate) (dateMatch.transactionDate as Record<string, string>).$lte = endDate;
  }

  const [transactions, accounts, categories] = await Promise.all([
    db.collection("transactions").find(dateMatch).sort({ transactionDate: -1, transactionTime: -1 }).toArray(),
    db.collection("accounts").find({ userId: userObjectId }).toArray(),
    db.collection("categories").find({ userId: userObjectId }).toArray(),
  ]);

  const accountLookup = new Map<string, string>(accounts.map((account) => [String(account._id), account.name || ""]));
  const categoryLookup = new Map<string, string>(categories.map((category) => [String(category._id), category.name || ""]));

  const income = transactions.filter((tx) => tx.type === "INCOME").reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const expense = transactions.filter((tx) => tx.type === "EXPENSE").reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const net = income - expense;
  const titleRange = formatRangeLabel(startDate, endDate);

  const tableColumns = [
    { key: "date", label: "Date", width: 58 },
    { key: "time", label: "Time", width: 44 },
    { key: "type", label: "Type", width: 52 },
    { key: "title", label: "Title", width: 126 },
    { key: "category", label: "Category", width: 98 },
    { key: "account", label: "Account", width: 95 },
    { key: "amount", label: "Amount", width: 58 },
  ] as const;

  const tableWidth = tableColumns.reduce((sum, column) => sum + column.width, 0);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const renderTableHeader = () => {
    const headerHeight = 22;
    let x = doc.page.margins.left;
    const y = doc.y;

    doc.save();
    doc.fillColor("#111827").rect(x, y, tableWidth, headerHeight).fill("#E5E7EB");
    doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold");

    for (const column of tableColumns) {
      doc.text(column.label, x + 4, y + 6, { width: column.width - 8, align: column.key === "amount" ? "right" : "left" });
      x += column.width;
    }

    doc.restore();
    doc.y = y + headerHeight;
  };

  const ensureSpace = (neededHeight: number) => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + neededHeight <= bottomLimit) return;
    doc.addPage();
    renderTableHeader();
  };

  const renderRow = (transaction: Record<string, any>) => {
    const rowData = {
      date: escapePdfText(transaction.transactionDate || ""),
      time: escapePdfText(transaction.transactionTime || ""),
      type: escapePdfText(transaction.type || ""),
      title: escapePdfText(transaction.title || ""),
      category: escapePdfText(getCategoryLabel(transaction, categoryLookup)),
      account: escapePdfText(getAccountLabel(transaction, accountLookup)),
      amount: escapePdfText(formatMoney(Number(transaction.amount || 0), transaction.currency || "")),
    };

    const rowPadding = 4;
    const rowHeights = [
      doc.heightOfString(rowData.date, { width: tableColumns[0].width - rowPadding * 2 }),
      doc.heightOfString(rowData.time, { width: tableColumns[1].width - rowPadding * 2 }),
      doc.heightOfString(rowData.type, { width: tableColumns[2].width - rowPadding * 2 }),
      doc.heightOfString(rowData.title, { width: tableColumns[3].width - rowPadding * 2 }),
      doc.heightOfString(rowData.category, { width: tableColumns[4].width - rowPadding * 2 }),
      doc.heightOfString(rowData.account, { width: tableColumns[5].width - rowPadding * 2 }),
      doc.heightOfString(rowData.amount, { width: tableColumns[6].width - rowPadding * 2 }),
    ];
    const rowHeight = Math.max(22, ...rowHeights) + 6;

    ensureSpace(rowHeight + 2);

    let x = doc.page.margins.left;
    const y = doc.y;
    const isIncome = transaction.type === "INCOME";
    const isTransfer = transaction.type === "TRANSFER";

    doc.save();
    doc.fillColor(doc.page.width % 2 === 0 ? "#FFFFFF" : "#F9FAFB");
    doc.rect(x, y, tableWidth, rowHeight).fillAndStroke("#FFFFFF", "#D1D5DB");
    doc.restore();

    const cells = [
      { key: "date", value: rowData.date },
      { key: "time", value: rowData.time },
      { key: "type", value: rowData.type },
      { key: "title", value: rowData.title },
      { key: "category", value: rowData.category },
      { key: "account", value: rowData.account },
      { key: "amount", value: rowData.amount },
    ];

    cells.forEach((cell, index) => {
      const column = tableColumns[index];
      const cellX = x;
      const cellTextOptions = {
        width: column.width - rowPadding * 2,
        align: column.key === "amount" ? "right" : "left",
      } as const;

      if (column.key === "type") {
        doc.fontSize(8).font("Helvetica-Bold").fillColor(isIncome ? "#047857" : isTransfer ? "#0369A1" : "#B91C1C");
      } else if (column.key === "amount") {
        doc.fontSize(8).font("Helvetica-Bold").fillColor(isIncome ? "#047857" : isTransfer ? "#0369A1" : "#B91C1C");
      } else {
        doc.fontSize(8).font("Helvetica").fillColor("#111827");
      }

      doc.text(cell.value, cellX + rowPadding, y + 5, cellTextOptions);
      x += column.width;
    });

    doc.y = y + rowHeight;
  };

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).fillColor("#111827").text("MoneyTrack Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#4B5563").text(`Range: ${titleRange}`, { align: "center" });
    doc.moveDown(0.8);

    doc.fontSize(14).fillColor("#111827").text("Summary");
    doc.moveDown(0.2);
    const summaryRows = [
      ["Transactions", String(transactions.length)],
      ["Income", income.toLocaleString("en-IN")],
      ["Expense", expense.toLocaleString("en-IN")],
      ["Net", net.toLocaleString("en-IN")],
      ["Accounts", String(accounts.length)],
      ["Categories", String(categories.length)],
    ];

    summaryRows.forEach(([label, value]) => {
      doc.fontSize(11).fillColor("#111827").text(`${label}: ${value}`);
    });

    doc.moveDown(1);
    doc.fontSize(14).fillColor("#111827").text("Transactions");
    doc.moveDown(0.2);
    renderTableHeader();

    if (transactions.length === 0) {
      doc.fontSize(10).fillColor("#6B7280").text("No transactions found for the selected range.");
    } else {
      transactions.forEach((tx) => renderRow(tx as Record<string, any>));
    }

    doc.end();
  });

  const fileName = `moneytrack_report_${new Date().toISOString().substring(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}