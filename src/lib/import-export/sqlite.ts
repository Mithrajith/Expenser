import initSqlJs, { Database } from "sql.js";

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs();
  }
  return sqlPromise;
}

export async function parseSqliteBuffer(buffer: ArrayBuffer): Promise<{
  tables: string[];
  tableData: Record<string, Record<string, unknown>[]>;
}> {
  const SQL = await getSql();
  const db: Database = new SQL.Database(new Uint8Array(buffer));

  // Get table names
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
  const tables: string[] = [];
  const tableData: Record<string, Record<string, unknown>[]> = {};

  if (res.length > 0) {
    const tableRows = res[0].values;
    for (const row of tableRows) {
      const tableName = row[0] as string;
      if (tableName.startsWith("sqlite_")) continue;
      tables.push(tableName);

      const dataRes = db.exec(`SELECT * FROM "${tableName}" LIMIT 1000;`);
      if (dataRes.length > 0) {
        const columns = dataRes[0].columns;
        const rows = dataRes[0].values;
        tableData[tableName] = rows.map((r) => {
          const item: Record<string, unknown> = {};
          columns.forEach((col, idx) => {
            item[col] = r[idx];
          });
          return item;
        });
      } else {
        tableData[tableName] = [];
      }
    }
  }

  db.close();
  return { tables, tableData };
}

export async function generateSqliteExport(
  transactions: Record<string, unknown>[],
  accounts: Record<string, unknown>[],
  categories: Record<string, unknown>[],
  settings: Record<string, unknown>
): Promise<Buffer> {
  const SQL = await getSql();
  const db: Database = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      currency TEXT,
      openingBalance REAL,
      currentBalance REAL
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      color TEXT
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      date TEXT,
      time TEXT,
      type TEXT,
      amount REAL,
      currency TEXT,
      accountId TEXT,
      categoryId TEXT,
      subcategory TEXT,
      title TEXT,
      description TEXT
    );

    CREATE TABLE settings (
      baseCurrency TEXT,
      appearance TEXT
    );
  `);

  // Insert settings
  db.run("INSERT INTO settings (baseCurrency, appearance) VALUES (?, ?);", [
    String(settings.baseCurrency || "INR"),
    String(settings.appearance || "dark"),
  ]);

  // Insert accounts
  for (const acc of accounts) {
    db.run(
      "INSERT INTO accounts (id, name, type, currency, openingBalance, currentBalance) VALUES (?, ?, ?, ?, ?, ?);",
      [
        String(acc._id || acc.id || ""),
        String(acc.name || ""),
        String(acc.type || ""),
        String(acc.currency || "INR"),
        Number(acc.openingBalance || 0),
        Number(acc.currentBalance || 0),
      ]
    );
  }

  // Insert categories
  for (const cat of categories) {
    db.run("INSERT INTO categories (id, name, type, color) VALUES (?, ?, ?, ?);", [
      String(cat._id || cat.id || ""),
      String(cat.name || ""),
      String(cat.type || "EXPENSE"),
      String(cat.color || ""),
    ]);
  }

  // Insert transactions
  for (const t of transactions) {
    db.run(
      "INSERT INTO transactions (id, date, time, type, amount, currency, accountId, categoryId, subcategory, title, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
      [
        String(t._id || t.id || ""),
        String(t.transactionDate || ""),
        String(t.transactionTime || ""),
        String(t.type || "EXPENSE"),
        Number(t.amount || 0),
        String(t.currency || "INR"),
        String(t.accountId || ""),
        String(t.categoryId || ""),
        String(t.subcategoryId || t.subcategory || ""),
        String(t.title || ""),
        String(t.description || ""),
      ]
    );
  }

  const binaryArray = db.export();
  db.close();
  return Buffer.from(binaryArray);
}
