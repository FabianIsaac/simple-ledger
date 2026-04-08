# Simple Ledger

Personal finance tracking inside [Obsidian](https://obsidian.md), inspired by [ledger-cli](https://ledger-cli.org/). Track your income, expenses, transfers, and debts using double-entry bookkeeping — all stored as plain text inside your vault.

---

## Features

- **Double-entry bookkeeping** — every transaction is always balanced
- **Multiple views** — sidebar summary, full dashboard, accounts panel, quick-add panel, recurring payments panel, and budgets panel
- **Account hierarchy** — organize accounts with unlimited nesting (e.g. `Expenses:Food:Restaurants`)
- **Recurring transactions** — schedule weekly, monthly, or yearly payments and track which ones are paid
- **Credit / debt management** — calculate interest, monthly installments, and track payoff progress
- **Budgets** — set monthly or yearly spending limits per account and track progress inline
- **Transaction notes** — attach a note to any transaction for extra context
- **Charts** — cash flow chart (daily bars + cumulative net line), donut pie chart, and grouped bar chart; all embeddable as code blocks in any note
- **Import transactions** — paste ledger-formatted text and preview before saving; includes an AI prompt helper to generate entries from bank emails
- **Export to CSV** — download a filtered or full transaction list as a spreadsheet
- **Inline account management** — add, rename, delete, and configure accounts directly in the panel without leaving the view
- **Excluded-from-balance accounts** — mark accounts like pension/AFP funds so they are tracked but not counted in your liquid balance cards
- **Semantic account coloring** — expenses, income, and liabilities each have a distinct color in the account tree and transaction list, adapting automatically to your Obsidian theme
- **Markdown code blocks** — embed live balance tables, transaction registers, summaries, charts, budgets, and debt lists in any note
- **Plain-text storage** — your data lives in a `.ledger` file compatible with ledger-cli
- **Customizable currency** — symbol, position, and decimal places
- **Bilingual** — full English and Spanish support; language follows your Obsidian locale setting
- **Obsidian URI support** — register transactions from outside Obsidian via URL (home screen shortcuts, browser bookmarks, scripts)

---

## Installation

### From the Obsidian Community Plugins directory

1. Open Obsidian → **Settings** → **Community plugins**
2. Make sure **Restricted mode** is off
3. Click **Browse** and search for **Simple Ledger**
4. Click **Install** and then **Enable**

### Manual installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/FabianIsaac/simple-ledger/releases)
2. Create a folder at `<your vault>/.obsidian/plugins/simple-ledger/`
3. Copy the three files into that folder
4. Go to **Settings** → **Community plugins** and enable **Simple Ledger**

---

## Getting Started

1. Click the **wallet icon** in the left ribbon to open the sidebar panel
2. Click **+ New** to add your first transaction
3. That's it — your data is saved automatically in a `.ledger` file inside your vault

---

## The Sidebar Panel

The main sidebar gives you a real-time overview of your finances:

| Section | Description |
|---------|-------------|
| **Summary cards** | Total income, total expenses, and net balance for the current month |
| **Account tree** | Hierarchical tree showing each account's balance, color-coded by type |
| **Recent transactions** | Paginated list of transactions — click any row to edit |

---

## Adding Transactions

Click **+ New** (or run the command **New transaction**) to open the transaction form:

| Field | Description |
|-------|-------------|
| **Date** | Transaction date (defaults to today) |
| **Description** | Name or description (e.g. "Grocery store", "March salary") |
| **Amount** | Amount in your currency |
| **Type** | Expense, Income, or Transfer |
| **To** | Account receiving the money |
| **From** | Account the money comes from |
| **Status** | Confirmed (`*`), Pending (`!`), or Unmarked |
| **Notes** | Optional free-text note |

### Transaction types

- **Expense** — money leaves an asset account and enters an expense account
  - Example: `Expenses:Food` ← `Assets:Bank`
- **Income** — money enters an asset account from an income account
  - Example: `Assets:Bank` ← `Income:Salary`
- **Transfer** — money moves between two asset accounts
  - Example: `Assets:Cash` ← `Assets:Bank`

---

## Dashboard (Main Panel)

Open with the bar-chart icon in the ribbon or via the command palette.

The dashboard includes:
- **Filter bar** — date range, account, and free-text search
- **Quick filter buttons** — Today / This Month / This Year / All
- **Summary cards** — month income, month expenses, total assets, total liabilities
- **Charts** — toggle between cash flow and distribution pie chart
- **Transaction list** — card layout with date, payee, accounts, and amount; click any row to edit
- **Account panel** — balance breakdown per account; click ⚙ to open the inline account manager

### Charts

| Mode | Description |
|------|-------------|
| **Cash flow** | Bar chart of daily income/expenses with a cumulative net line |
| **Distribution** | Donut pie chart breaking down spending or income by account |

Pie chart controls:
- **Type** — Expenses or Income
- **Level 1** — top-level sub-accounts (e.g. `Food`, `Transport`)
- **Level 2** — deeper sub-accounts (e.g. `Food:Restaurants`, `Food:Supermarket`)

If there are more than 9 categories, the smallest are grouped as **Others**. Hover a slice to see the exact amount and percentage.

---

## Accounts Panel

Open with the landmark icon in the ribbon or via **Manage accounts** in the command palette.

Shows summary cards for **Net Worth**, **Total Assets**, and **Total Liabilities** — each with an info button (ⓘ) that explains exactly how the value is calculated and lists the individual accounts that compose it.

Below the cards, accounts are listed by category (Assets, Liabilities, Income, Expenses) with:
- Current balance
- Monthly flow (this month vs last month)
- 6-month sparkline
- Full transaction history when you expand an account

---

## Recurring Transactions Panel

Open via the calendar icon in the ribbon or the command palette.

### Creating a recurring transaction

1. Click **+ New** in the recurring panel
2. Fill in: name, amount, source/destination accounts, frequency, and due day
3. Save — the next due date is calculated automatically

### Frequency options

| Frequency | Configuration |
|-----------|--------------|
| Monthly | Day of the month (1–31) |
| Weekly | Day of the week (Monday–Sunday) |
| Yearly | Month and day of the year |

### Due date indicators

- **Overdue** (past due, unpaid) — shown with a red ⚠ warning
- **Due today** — highlighted in orange
- **Upcoming** — shown with the future date

---

## Budgets Panel

Open with the target icon in the ribbon or via the command palette.

### Creating a budget

1. Click **New budget** in the panel header
2. Set the account to track, the limit amount, and the period (monthly or yearly)
3. Save — the panel immediately shows spending progress

Each budget card shows:
- A progress bar (green → yellow → red as you approach the limit)
- Amount spent vs. the limit
- Remaining amount or how much you've exceeded the limit

### Editing and deleting

Click any budget card to expand an inline edit form — no modal required. You can change the account, amount, or period, or delete the budget.

---

## Credit / Debt Management

Open the credit wizard via the command palette → **New credit**.

### Setting up a credit/loan

1. Enter the loan name (becomes a `Liabilities:` account)
2. Enter the principal (amount received) and total debt (principal + all interest)
3. Enter the number of months and the asset account payments come from
4. The wizard calculates: monthly payment, interest portion, and per-payment principal/interest split

### Tracking payoff

Each credit payment records two postings automatically:
- Reduction of the liability (principal portion)
- Expense entry for the interest (goes to `Expenses:Interest:<name>`)

---

## Account Management

Accounts can be managed from:
- The **Accounts panel** → click ⚙ next to any category
- The **Dashboard** → click ⚙ in the account tree section
- The command palette → **Manage accounts**

### Account types and prefixes

| Type | Default prefix | Purpose | Color |
|------|---------------|---------|-------|
| Expenses | `Expenses:` | Where money goes | Red |
| Income | `Income:` | Where money comes from | Green |
| Assets | `Assets:` | Things you own | Neutral |
| Liabilities | `Liabilities:` | What you owe | Orange |

> The prefixes are configurable in Settings → Simple Ledger → Account prefixes. Language presets for English and Spanish are available.

### Actions

- **Add** — type a name and press **+**
- **Rename** — click ✎, edit inline, press Enter. All existing transactions update automatically.
- **Delete** — click ×
- **Exclude from balance** — click ◎ to toggle. Excluded accounts are still tracked and shown, but not counted in summary cards (useful for pension/AFP accounts).

### Sub-accounts

Use `:` to create hierarchies:

```
Expenses:Food
Expenses:Food:Restaurants
Expenses:Food:Supermarket
Assets:Bank:BBVA
Assets:Bank:Santander
```

---

## Markdown Code Blocks

Embed live financial reports in any Obsidian note. Reports update automatically when your ledger file changes.

### Available blocks

| Block | Description |
|-------|-------------|
| `ledger-balance` | Balance table per account |
| `ledger-register` | Detailed transaction list |
| `ledger-summary` | Income, expenses, and net grouped by period |
| `ledger-pie` | Donut pie chart by account |
| `ledger-cashflow` | Daily bars + cumulative net line |
| `ledger-bar` | Grouped income vs expenses per period |
| `ledger-debts` | Upcoming recurring payments and debts |
| `ledger-budget` | Budget progress bars |

### Filter options

All block types accept options in `key: value` format, one per line. Keys are in English:

| Option | Applies to | Description | Example |
|--------|-----------|-------------|---------|
| `account` | all | Filter by account name (partial match) | `account: Expenses` |
| `from` | all | Start date (inclusive) | `from: 2026/03/01` |
| `to` | all | End date (inclusive) | `to: 2026/03/31` |
| `month` | all | Shortcut for a full calendar month | `month: 2026/03` |
| `year` | all | Shortcut for a full calendar year | `year: 2026` |
| `today` | all | Shortcut for today only (no value needed) | `today` |
| `search` | all | Search in description or account name | `search: supermarket` |
| `limit` | balance, register | Maximum number of results | `limit: 5` |
| `order` | balance, register | Sort order: `asc` or `desc` (default: `desc`) | `order: asc` |
| `period` | summary, bar | Group by `month` or `year` | `period: year` |
| `type` | pie | Account type: `expenses`, `income`, `assets`, `liabilities` | `type: income` |
| `level` | pie | Grouping depth: `1` = top, `2` = sub-accounts | `level: 2` |

### Practical examples

**Expenses for March 2026:**
````
```ledger-balance
month: 2026/03
account: Expenses
```
````

**Last 5 food transactions:**
````
```ledger-register
account: Food
limit: 5
```
````

**Yearly summary:**
````
```ledger-summary
year: 2026
period: year
```
````

**Today's transactions:**
````
```ledger-register
today
```
````

**Expense breakdown for the current month:**
````
```ledger-pie
type: expenses
level: 1
month: 2026/03
```
````

**Income sources for the year:**
````
```ledger-pie
type: income
year: 2026
```
````

**Cash flow for Q1 2026:**
````
```ledger-cashflow
from: 2026/01/01
to: 2026/03/31
```
````

**Monthly income vs expenses:**
````
```ledger-bar
year: 2026
period: month
```
````

**Yearly comparison (all time):**
````
```ledger-bar
period: year
```
````

**Upcoming payments:**
````
```ledger-debts
```
````

**Budget progress for all accounts:**
````
```ledger-budget
```
````

**Budget for a specific account:**
````
```ledger-budget
account: Expenses:Food
period: monthly
```
````

---

## Settings

Go to **Settings** → **Community plugins** → **Simple Ledger**:

| Option | Description | Default |
|--------|-------------|---------|
| **Ledger file** | Path to the `.ledger` file inside your vault | `Finances.ledger` |
| **Currency symbol** | Symbol to display (e.g. `$`, `€`, `£`) | `$` |
| **Currency after number** | Display as `100 €` instead of `$100` | Off |
| **Decimal places** | Decimal places to show (use `0` for currencies like CLP) | `2` |
| **Thousand separator** | Character used to separate thousands | `,` |
| **Account prefixes** | Prefix for each account type | `Expenses:`, `Income:`, `Assets:`, `Liabilities:` |
| **Status bar** | Show upcoming payments in the Obsidian status bar | On |
| **Lookahead days** | How many days ahead to show in the status bar | `7` |

### Language presets

Settings include **ES** and **EN** preset buttons that configure all account prefixes and default accounts to the chosen language in one click. A confirmation dialog warns you if you have existing transactions, since renaming prefixes does not update historical data automatically.

---

## Understanding Double-Entry Bookkeeping

Every transaction has at least two postings that cancel each other out — this guarantees your books are always balanced.

```
Assets:Bank          +$1,000    (bank balance goes up)
Income:Salary        -$1,000    (source is recorded)
Total = $0
```

If the total is NOT zero, there is an error in a transaction.

| Type | Debit (receives) | Credit (gives) |
|------|-----------------|----------------|
| Expense | Expense account | Asset account |
| Income | Asset account | Income account |
| Transfer | Destination asset | Source asset |

---

## The `.ledger` File Format

Your data is stored as plain text compatible with [ledger-cli](https://ledger-cli.org/):

```ledger
; Comment
2026/03/01 * March Salary
    ; Bi-weekly deposit
    Assets:Bank              $1,000.00
    Income:Salary

2026/03/02 * Supermarket
    Expenses:Food            $85.00
    Assets:Bank

2026/03/05 * Loan payment
    Liabilities:BankLoan     $150.00
    Assets:Bank
```

### Format rules

- First line: `DATE [STATUS] DESCRIPTION`
- A `;` line immediately after the date line is a **note** for that transaction
- Indented lines are account postings
- The last posting can omit the amount — it auto-balances
- Status: `*` = confirmed, `!` = pending, no flag = unmarked
- Dates use `YYYY/MM/DD` format

---

## Obsidian URI Support

Register transactions from outside Obsidian via URL — home screen shortcuts, browser bookmarks, scripts, or any app that can open a URL.

### URI format

```
obsidian://simple-ledger?vault=VAULT_NAME&payee=DESCRIPTION&amount=AMOUNT&to=TO_ACCOUNT&from=FROM_ACCOUNT
```

### Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `vault` | Recommended | Your Obsidian vault name | `MyFinances` |
| `payee` | Yes | Transaction description | `Supermarket` |
| `amount` | Yes | Numeric amount — no symbol, no separators | `85000` |
| `to` | Yes | Destination account (full name) | `Expenses:Food` |
| `from` | Yes | Source account (full name) | `Assets:Bank` |
| `date` | No | Date in `YYYY/MM/DD` format. Defaults to today. | `2026/03/22` |
| `status` | No | `*` confirmed, `!` pending. Defaults to `*`. | `*` |

If any required parameter is missing, the plugin opens the transaction form so you can fill in the rest manually.

### Examples

```
obsidian://simple-ledger?vault=MyVault&payee=Supermarket&amount=85&to=Expenses:Food&from=Assets:Bank
obsidian://simple-ledger?vault=MyVault&payee=Netflix&amount=15&to=Expenses:Entertainment&from=Liabilities:CreditCard
obsidian://simple-ledger?vault=MyVault&payee=Card+payment&amount=150&to=Liabilities:CreditCard&from=Assets:Bank
```

### iOS Shortcuts

1. Open **Shortcuts** → **+** → Add action **Open URLs**
2. Paste your URI in the URL field
3. (Optional) Add an **Ask for Input** action before it to prompt for the amount each time
4. Name it, tap **Done**, and add it to your home screen

### Android

Use the **HTTP Shortcuts** app: create a **Browser Shortcut** with your URI and place it on your home screen.

### Scripts

```bash
# macOS / Linux
open "obsidian://simple-ledger?vault=MyVault&payee=Coffee&amount=3&to=Expenses:Food&from=Assets:Cash"

# Windows (PowerShell)
Start-Process "obsidian://simple-ledger?vault=MyVault&payee=Coffee&amount=3&to=Expenses:Food&from=Assets:Cash"
```

---

## Commands

All commands are accessible from the command palette (`Ctrl+P`) and can be assigned keyboard shortcuts:

| Command | Description |
|---------|-------------|
| New transaction | Open the add-transaction form |
| New multi-posting transaction | Add a transaction with multiple account splits |
| Open sidebar | Open the main sidebar |
| Open dashboard | Open the full dashboard |
| Open ledger file | Open the `.ledger` file for direct editing |
| Manage accounts | Open the account manager |
| Open recurring panel | Open the recurring transactions panel |
| Open quick add panel | Open the quick-add panel |
| Open accounts panel | Open the accounts panel |
| Open budgets panel | Open the budgets panel |
| New credit | Open the credit/loan wizard |
| Filter: current month | Filter dashboard to current month |
| Filter: current year | Filter dashboard to current year |
| Filter: expenses only | Filter dashboard to expense accounts |
| Filter: income only | Filter dashboard to income accounts |
| Clear filters | Reset all dashboard filters |

---

## Contributing

Issues and pull requests are welcome at [github.com/FabianIsaac/simple-ledger](https://github.com/FabianIsaac/simple-ledger).

---

## License

MIT
