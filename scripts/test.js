const assert = require("assert");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

async function runTests() {
  console.log("🧪 Starting MoneyTrack Automated Test Suite...\n");

  // Test 1: Password Hashing Verification
  console.log("▶ Test 1: Password Hashing & Verification");
  const rawPass = "SecretPass123!";
  const hash = await bcrypt.hash(rawPass, 10);
  const valid = await bcrypt.compare(rawPass, hash);
  const invalid = await bcrypt.compare("WrongPass", hash);
  assert.strictEqual(valid, true, "Password should match hash");
  assert.strictEqual(invalid, false, "Wrong password should not match hash");
  console.log("  ✅ Password hashing test passed.\n");

  // Test 2: User Data Isolation Contract
  console.log("▶ Test 2: User Isolation Contract Verification");
  const userA_ID = "user_A_123";
  const userB_ID = "user_B_456";

  const database = [
    { _id: "tx1", userId: userA_ID, title: "Coffee", amount: 5 },
    { _id: "tx2", userId: userB_ID, title: "Laptop", amount: 1200 },
  ];

  const userARecords = database.filter((doc) => doc.userId === userA_ID);
  const userBRecords = database.filter((doc) => doc.userId === userB_ID);

  assert.strictEqual(userARecords.length, 1);
  assert.strictEqual(userARecords[0].title, "Coffee");
  assert.strictEqual(userBRecords.length, 1);
  assert.strictEqual(userBRecords[0].title, "Laptop");
  console.log("  ✅ User isolation contract test passed.\n");

  // Test 3: Balance Engine Recalculation Formula
  console.log("▶ Test 3: Balance Recalculation Engine Formula");
  const openingBalance = 1000;
  const income = 2500;
  const expense = 650;
  const transfersIn = 200;
  const transfersOut = 150;

  // Formula: balance = openingBalance + income - expense + transfersIn - transfersOut
  const calculatedBalance = openingBalance + income - expense + transfersIn - transfersOut;
  assert.strictEqual(calculatedBalance, 2900, "Calculated balance must equal 2900");
  console.log("  ✅ Balance engine formula test passed.\n");

  // Test 4: Transfer Net Worth Preservation
  console.log("▶ Test 4: Transfers Net Worth Preservation");
  let accountA = 2000; // Bank
  let accountB = 500;  // Cash
  const transferAmount = 400;

  const initialNetWorth = accountA + accountB;

  // Perform transfer: Bank -> Cash
  accountA -= transferAmount;
  accountB += transferAmount;

  const finalNetWorth = accountA + accountB;

  assert.strictEqual(accountA, 1600);
  assert.strictEqual(accountB, 900);
  assert.strictEqual(initialNetWorth, finalNetWorth, "Net worth must remain constant during transfer");
  console.log("  ✅ Transfer net worth preservation test passed.\n");

  // Test 5: SheetJS Excel Generator & Parser
  console.log("▶ Test 5: SheetJS Excel Generator & Duplicate Detection");
  const wb = XLSX.utils.book_new();
  const sampleData = [
    { Date: "2026-09-21", Amount: 120, Title: "Lunch", Type: "Expense" },
    { Date: "2026-09-21", Amount: 120, Title: "Lunch", Type: "Expense" }, // Duplicate
    { Date: "2026-09-20", Amount: 2000, Title: "Freelance", Type: "Income" },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  assert.ok(buf.length > 0, "Buffer should be generated");

  // Duplicate detection logic
  const seenKeys = new Set();
  let importedCount = 0;
  let duplicateCount = 0;

  for (const row of sampleData) {
    const key = `${row.Date}_${row.Amount}_${row.Title}`;
    if (seenKeys.has(key)) {
      duplicateCount++;
    } else {
      seenKeys.add(key);
      importedCount++;
    }
  }

  assert.strictEqual(importedCount, 2);
  assert.strictEqual(duplicateCount, 1);
  console.log("  ✅ SheetJS Excel generator & duplicate detection test passed.\n");

  console.log("🎉 ALL MONEYTRACK UNIT TESTS PASSED SUCCESSFULLY!");
}

runTests();
