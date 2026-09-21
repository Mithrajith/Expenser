# MoneyTrack - Production-Ready Mobile-First Personal Finance Tracking Web Application

**MoneyTrack** is a full-stack, mobile-first personal finance tracking web application designed specifically for deployment on **Vercel** with **MongoDB Atlas**.

---

## 🌟 Key Features

- **Mobile-First Modern UI**: Designed inspired by modern mobile finance apps with dark mode styling, rounded cards, soft gradients, compact transaction rows, large financial typography, and smooth micro-interactions.
- **Vercel Serverless Architecture**: Operates 100% in Vercel's serverless environment with zero reliance on local persistent filesystems or long-running processes.
- **Persistent HTTP-Only Authentication**: Secure session cookies with bcrypt password hashing, 30-day "Remember me" retention, user isolation, and explicit logout.
- **Dynamic Balance Engine**: Account balances are continuously recalculated ($balance = openingBalance + income - expense + transferIn - transferOut$) across transaction additions, edits, and deletions without data drift.
- **Transfer Engine**: Supports internal account transfers (e.g. SBI → Cash) without inflating income or expense metrics.
- **Smart Suggestions**: Remembers historical transaction titles, categories, and descriptions per user.
- **SheetJS Excel Import & Export**: Interactive column mapping interface, preview, duplicate detection, and multi-sheet `.xlsx` workbook exports.
- **SQLite WASM Import & Export**: Process `.db` files client-side / serverless using `sql.js` without requiring a local SQLite database server.
- **Full JSON Backup & Restore**: Secure data backups without password hashes or authentication secrets.
- **Interactive Recharts Analytics**: Weekly & Monthly analytics with daily spending trends, month-over-month comparisons, and category donut charts with subcategory drill-down.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 & Lucide Icons
- **Analytics**: Recharts
- **Database**: MongoDB Atlas (`mongodb` native driver with cached serverless connection pooling)
- **Auth**: JOSE JWTs & HTTP-only cookies + `bcryptjs`
- **Data Import/Export**: `sheetjs` (`xlsx`) & `sql.js` (SQLite WASM)
- **Validation**: Zod

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   ├── analytics/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── import-export/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── analytics/
│   │   ├── import/
│   │   ├── export/
│   │   ├── backup/
│   │   ├── suggestions/
│   │   └── seed/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── navigation/
│   │   └── Navbar.tsx
│   └── ui/
│       └── IconHelper.tsx
├── lib/
│   ├── mongodb.ts
│   ├── db-indexes.ts
│   ├── auth.ts
│   ├── validations.ts
│   ├── default-data.ts
│   ├── balance.ts
│   ├── suggestions.ts
│   └── import-export/
│       ├── excel.ts
│       ├── sqlite.ts
│       ├── csv.ts
│       └── backup.ts
└── middleware.ts
```

---

## 🚀 Environment Variables

Copy `.env.example` to `.env.local` for local development:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/moneytrack?retryWrites=true&w=majority
MONGODB_DB=moneytrack

AUTH_SECRET=your-32-character-secret-key-here
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📦 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Unit & Business Logic Tests**:
   ```bash
   npm test
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Production Build Check**:
   ```bash
   npm run build
   ```

---

## 🌐 Vercel Deployment Guide

1. **Create MongoDB Atlas Database**:
   - Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Create a free or dedicated cluster.
   - Create a Database User with read/write access.
   - Under **Network Access**, add `0.0.0.0/0` to allow Vercel serverless connections.
   - Copy your Connection String (URI).

2. **Deploy to Vercel**:
   - Push your repository to GitHub / GitLab.
   - Import the project into [Vercel](https://vercel.com).
   - Configure Environment Variables in Vercel Project Settings:
     - `MONGODB_URI`
     - `MONGODB_DB`
     - `AUTH_SECRET`
     - `AUTH_URL` (your Vercel production URL e.g. `https://your-app.vercel.app`)
   - Click **Deploy**.

---

## 🛡️ Security & User Isolation Notes

- **User Scoping**: Every database query explicitly checks `{ userId: session.userId }`. User A can never view or modify User B's documents.
- **Passwords**: Hashed with bcrypt (salt round 10). Hashes are never returned to the frontend or exported in backups.
- **Cookies**: HTTP-only, `sameSite: 'lax'`, and `secure` in production.
