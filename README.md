# MoneyCapy

MoneyCapy is a personal finance management desktop application for **Windows**. It helps you track expenses, income, credit cards, and bank accounts — all in one place, with support for multiple user profiles.

---

## What it does

Centralizes your entire financial life: records and categorizes expenses, tracks recurring or one-time income, monitors credit card invoices and bank account balances, and generates charts and analytics by period.

---

## Features

### Expenses
- Types: **one-time**, **installment**, **recurring (subscription)**, and **loan**
- Mark as paid per month
- Anticipate payments or pause temporarily
- Link to category, tag, store, bank account, or credit card
- Monthly value override

### Income
- Recurring and one-time income
- Mark as received per month, with date
- Link to categories, tags, and stores
- Monthly value override and temporary pause

### Bank Accounts
- Checking and savings accounts
- Monthly balance recording
- Breakdown of linked expenses (installments, loans, subscriptions)

### Credit Cards
- Encrypted card details (number, expiry, holder)
- Available/used limit tracking
- Configurable billing and due date cycles
- Pay full invoice for a month in one click

### Multiple Profiles
- Separate finances per person within the same app
- Quick profile switching

### Categories, Tags & Stores
- Organize expenses and income with custom colors and icons
- Cross-filtering by type, period, and classification

### Dashboard
- Monthly overview: total expenses, income, and balance
- Configurable drag-and-drop widgets
- Upcoming due dates, top expenses, card and account summaries

### Insights (Analytics)
- Time-series charts: daily, weekly, monthly, yearly
- Period comparisons
- Distribution by categories, tags, and income type

### Settings
- Light/dark theme
- Language (Portuguese BR and English)
- Date and currency format
- Custom colors per section
- Configurable business day (holidays, weekdays)
- Password protection
- Auto-start and minimize to tray
- Backup/restore and CSV export

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop UI | React 18 + TypeScript + Tailwind CSS |
| Desktop App | Electron 33 |
| Database | SQLite (sql.js) |
| Charts | Recharts |
| Icons | Lucide React |
| Build / Installer | electron-builder (NSIS) |

---

## Running Locally

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build

# Generate .exe installer
npm run package
```

The installer will be generated at `dist/moneycapy-1.0.0-setup.exe`.
