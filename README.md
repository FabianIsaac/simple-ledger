# Simple Ledger

Personal finance tracking inside [Obsidian](https://obsidian.md), inspired by [ledger-cli](https://ledger-cli.org/). Track your income, expenses, transfers, and debts using double-entry bookkeeping — all stored as plain text inside your vault.

---

## Features

- **Double-entry bookkeeping** — every transaction is always balanced
- **Multiple views** — sidebar summary, full dashboard, quick-add panel, and recurring payments panel
- **Account hierarchy** — organize accounts with unlimited nesting (e.g. `Expenses:Food:Restaurants`)
- **Recurring transactions** — schedule weekly, monthly, or yearly payments and track which ones are paid
- **Credit / debt management** — calculate interest, monthly installments, and track payoff progress
- **Markdown code blocks** — embed live balance tables, transaction registers, and summaries in any note
- **Plain-text storage** — your data lives in a `.ledger` file compatible with ledger-cli
- **Customizable currency** — symbol, position, and decimal places

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

1. Open the sidebar by clicking the **wallet icon** in the left ribbon, or run `Ctrl+P` → **Simple Ledger: Abrir panel lateral**
2. Click **+ Nuevo** to add your first transaction
3. That's it — your data is saved automatically in a `.ledger` file inside your vault

---

## The Sidebar Panel

The main sidebar gives you a real-time overview of your finances:

| Section | Description |
|---------|-------------|
| **Summary cards** | Total income, total expenses, and net balance |
| **Accounts** | Hierarchical tree showing the balance of each account and sub-account |
| **Transactions** | List of recent transactions — click any row to edit it |

### Sidebar buttons

| Button | Action |
|--------|--------|
| **+ Nuevo** | Open the add-transaction form |
| **↻** | Reload data from the ledger file |
| **⚙** (next to Accounts) | Open the account manager |
| **Ver todas** | Show all transactions (appears when there are more than 10) |

---

## Adding Transactions

Click **+ Nuevo** (or run the command **Agregar transaccion**) to open the transaction form:

| Field | Description |
|-------|-------------|
| **Fecha** | Transaction date (defaults to today) |
| **Descripcion** | Name or description (e.g. "Grocery store", "March salary") |
| **Monto** | Amount in your currency |
| **Tipo** | Type: Expense, Income, or Transfer |
| **Destino** | Account receiving the money |
| **Origen** | Account the money comes from |
| **Estado** | Status: Confirmed (`*`), Pending (`!`), or Unmarked |

### Transaction types

- **Expense** — money leaves an asset account and enters an expense account
  - Example: Grocery shopping → `Expenses:Food` ← `Assets:Bank`
- **Income** — money enters an asset account from an income account
  - Example: Receiving salary → `Assets:Bank` ← `Income:Salary`
- **Transfer** — money moves between two asset accounts
  - Example: Withdrawing cash → `Assets:Cash` ← `Assets:Bank`

---

## Editing and Deleting Transactions

Click on any transaction row in the sidebar to open the edit form (a pencil icon ✎ appears on hover).

From the editor you can:
- Modify any field (date, description, amount, accounts, status)
- **Save** — updates the transaction in the ledger file
- **Delete** — removes the transaction (with a confirmation dialog)

---

## Dashboard (Main Panel)

Open the full dashboard with `Ctrl+P` → **Abrir panel central** or via the bar-chart icon in the ribbon.

The dashboard includes:
- **Filters** — date range, account, free-text search
- **Quick filter buttons** — Today / This Month / This Year / All
- **Cash flow chart** — visual income vs. expenses over time
- **Transaction table** — full filterable/sortable list
- **Account panel** — balance breakdown per account
- **Recurring panel** — upcoming scheduled payments

---

## Quick Add Panel

For fast data entry, open the Quick Add panel with `Ctrl+P` → **Agregar movimientos**.

- Select transaction type (Expense / Income / Transfer / Debt) with one click
- Fill in date, description, amount, and accounts
- **Recent items** shown below for quick repeating of common transactions

---

## Account Management

Open the account manager from the **⚙** icon in the sidebar or `Ctrl+P` → **Gestionar cuentas**.

### Account types

| Type | Prefix | Purpose | Examples |
|------|--------|---------|----------|
| **Assets** | `Activos:` | Things you own | Bank, Cash, Savings |
| **Expenses** | `Gastos:` | Where money goes | Food, Transport, Health |
| **Income** | `Ingresos:` | Where money comes from | Salary, Freelance |
| **Liabilities** | `Pasivos:` | What you owe | CreditCard, Loan |

### Actions

- **Add account** — type a name and press **+**. The prefix is added automatically if you omit it.
- **Rename account** — click the ✎ icon, edit the name inline, press Enter. All existing transactions are updated automatically.
- **Delete account** — click the × button.

### Sub-accounts

Use `:` to create hierarchies. You can nest as many levels as you need:

```
Gastos:Comida
Gastos:Comida:Restaurantes
Gastos:Comida:Supermercado
Activos:Banco:BBVA
Activos:Banco:Santander
```

The sidebar shows the aggregated balance at each parent level.

### Using credit card accounts

Liability accounts like `Pasivos:TarjetaCredito` require two specific transaction types that are available in both the transaction form and the Quick Add panel:

| Type | Destination | Source | When to use |
|------|-------------|--------|-------------|
| **Cargo tarjeta** | `Gastos:*` | `Pasivos:TarjetaCredito` | Buying something with the card |
| **Pago tarjeta** | `Pasivos:TarjetaCredito` | `Activos:Banco` | Paying the card balance |

Example flow:
1. You buy groceries with your credit card → **Cargo tarjeta**, amount `$85,000`, to `Gastos:Comida`, from `Pasivos:TarjetaCredito`
2. At the end of the month you pay the card → **Pago tarjeta**, amount `$85,000`, to `Pasivos:TarjetaCredito`, from `Activos:Banco`

The `Pasivos:TarjetaCredito` account will show a **negative** balance — this is correct in double-entry bookkeeping. The absolute value is what you owe.

---

## Recurring Transactions

Open the recurring panel with `Ctrl+P` → **Abrir panel de recurrentes** or via the repeat icon in the ribbon.

### Creating a recurring transaction

1. Click **+ Nueva** in the recurring panel
2. Fill in: name, amount, source/destination accounts, frequency, and day of the month/week
3. Save — the transaction is tracked and its next due date is calculated automatically

### Frequency options

| Frequency | Configuration |
|-----------|--------------|
| Monthly | Day of the month (1–31) |
| Weekly | Day of the week (Monday–Sunday) |
| Yearly | Month and day of the year |

### Panel tabs

| Tab | Shows |
|-----|-------|
| **All** | Every recurring transaction |
| **Pending** | Due but not yet paid this period |
| **Paid** | Already paid this period |
| **Credits** | Linked loan/credit payments |

### Summary cards

The recurring panel header shows:
- Number of pending payments
- Number of paid payments
- Total monthly commitment

---

## Credit / Debt Management

Open the credit wizard with `Ctrl+P` → **Nuevo credito**.

### Setting up a credit/loan

1. Enter the loan **name** (will become a `Pasivos:` account)
2. Enter the **principal** (amount received) and **total debt** (principal + all interest and fees)
3. Enter the **number of months** for repayment
4. Select the **asset account** payments will come from and the **payment day**
5. The wizard automatically calculates:
   - Monthly payment amount
   - Total interest / fee portion
   - Per-payment principal vs. interest split

### What gets created

- A `Pasivos:<name>` liability account
- A recurring monthly payment linked to that account
- An interest sub-account (`Gastos:Intereses:<name>`) if there is a difference between principal and total debt
- A ledger transaction recording the initial deposit to your bank

### Tracking payoff

Each time you mark a credit payment as paid, the plugin registers two postings:
- Reduction of the liability account (principal portion)
- Expense entry for the interest portion

This keeps your balance sheet accurate throughout the loan term.

---

## Markdown Code Blocks

Embed live financial reports in any Obsidian note using special code blocks. The reports update automatically whenever your ledger file changes.

### Balance

Shows the balance of each account:

````
```ledger-balance
```
````

### Register

Shows a detailed list of transactions:

````
```ledger-register
```
````

### Summary

Shows income, expenses, and net grouped by period:

````
```ledger-summary
```
````

---

### Filter options

All three block types accept filter options, one per line, in `key: value` format:

| Option | Description | Example |
|--------|-------------|---------|
| `cuenta` | Filter by account name (partial match) | `cuenta: Gastos` |
| `desde` | Start date (inclusive) | `desde: 2026/03/01` |
| `hasta` | End date (inclusive) | `hasta: 2026/03/31` |
| `mes` | Shortcut for a full calendar month | `mes: 2026/03` |
| `año` | Shortcut for a full calendar year | `año: 2026` |
| `hoy` | Shortcut for today only | `hoy` |
| `buscar` | Search in description or account name | `buscar: supermercado` |
| `limite` | Maximum number of results | `limite: 5` |
| `orden` | Sort order: `asc` or `desc` (default: `desc`) | `orden: asc` |
| `periodo` | For summary only: `mes` (monthly) or `anual` (yearly) | `periodo: anual` |

### Practical examples

**Expenses for March 2026:**
````
```ledger-balance
mes: 2026/03
cuenta: Gastos
```
````

**Last 5 food transactions:**
````
```ledger-register
cuenta: Comida
limite: 5
```
````

**Yearly summary:**
````
```ledger-summary
año: 2026
periodo: anual
```
````

**Today's transactions:**
````
```ledger-register
hoy
```
````

**Search by keyword:**
````
```ledger-register
buscar: supermercado
orden: asc
```
````

---

## Commands

All commands are accessible from the command palette (`Ctrl+P`):

| Command | Description |
|---------|-------------|
| **Agregar transaccion** | Open the add-transaction form |
| **Abrir panel lateral** | Open the main sidebar |
| **Abrir panel central** | Open the full dashboard |
| **Abrir archivo ledger** | Open the `.ledger` file for direct editing |
| **Gestionar cuentas** | Open the account manager |
| **Abrir panel de recurrentes** | Open the recurring transactions panel |
| **Agregar movimientos** | Open the quick-add panel |
| **Nuevo credito** | Open the credit/loan wizard |

---

## Settings

Go to **Settings** → **Community plugins** → **Simple Ledger**:

| Option | Description | Default |
|--------|-------------|---------|
| **Archivo de transacciones** | Path to the `.ledger` file inside your vault | `Finanzas.ledger` |
| **Simbolo de moneda** | Currency symbol to display (e.g. `$`, `€`, `£`, `CLP`) | `$` |
| **Moneda despues del numero** | Display as "100 €" instead of "$100" | Off |
| **Decimales** | Number of decimal places (use `0` for currencies like CLP) | `2` |
| **Gestionar cuentas** | Add, rename, or remove default accounts | — |

### Default accounts

The plugin ships with the following accounts:

| Category | Accounts |
|----------|----------|
| **Gastos (Expenses)** | Comida, Transporte, Hogar, Salud, Entretenimiento, Ropa, Educacion, Servicios, Otros |
| **Ingresos (Income)** | Salario, Freelance, Otros |
| **Activos (Assets)** | Banco, Efectivo, Ahorros |
| **Pasivos (Liabilities)** | TarjetaCredito, Prestamo |

All of these can be added to, renamed, or deleted from the account manager.

---

## Understanding Double-Entry Bookkeeping

Every transaction in Simple Ledger has at least two postings that cancel each other out. This guarantees your books are always balanced.

### Why is the total balance always $0?

Because that is correct. Every peso (or dollar, or euro) that enters one account must leave another:

```
Activos:Banco        +$1,000,000   (your bank balance goes up)
Ingresos:Salario     -$1,000,000   (the source is recorded)
Total = $0
```

If the total is NOT zero, there is an error in a transaction.

### How each type works internally

| Type | Debit (receives) | Credit (gives) |
|------|-----------------|----------------|
| Expense | Expense account | Asset account |
| Income | Asset account | Income account |
| Transfer | Destination asset | Source asset |

---

## The `.ledger` File Format

Your data is stored as a plain-text file compatible with [ledger-cli](https://ledger-cli.org/). You can open and edit it directly with `Ctrl+P` → **Abrir archivo ledger**, or with any text editor.

```ledger
; Comment
2026/03/01 * Salario Marzo
    Activos:Banco              $1000000
    Ingresos:Salario

2026/03/02 * Supermercado
    Gastos:Comida              $85000
    Activos:Banco

2026/03/05 * Pago cuota credito
    Pasivos:CreditoBanco       $150000
    Activos:Banco
```

### Format rules

- The first line of each transaction is: `DATE [STATUS] DESCRIPTION`
- Subsequent lines (indented) are account postings
- The last posting can omit the amount — it is calculated automatically to balance the transaction
- Status flags: `*` = confirmed, `!` = pending, no flag = unmarked
- Comments begin with `;`
- Dates use `YYYY/MM/DD` format

---

## Example: Recording a Bank Loan

1. Add a `Pasivos:CreditoBancoChile` account in the account manager (or use the credit wizard)
2. When you receive the loan (bank deposits the money):
   - Type: Transfer
   - Destination: `Activos:Banco`
   - Source: `Pasivos:CreditoBancoChile`
   - This records that your bank balance increases but so does your debt
3. When you pay a monthly installment:
   - Type: Transfer
   - Destination: `Pasivos:CreditoBancoChile`
   - Source: `Activos:Banco`
   - This records that your debt decreases along with your bank balance

Using the **credit wizard** automates steps 2 and 3 entirely.

---

## Obsidian URI Support

Simple Ledger supports [Obsidian URIs](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI) so you can register transactions from outside Obsidian — phone home screen buttons, browser bookmarks, scripts, or any other app that can open a URL.

### URI format

```
obsidian://simple-ledger?vault=VAULT_NAME&payee=DESCRIPTION&amount=AMOUNT&to=TO_ACCOUNT&from=FROM_ACCOUNT
```

### Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `vault` | Recommended | Your Obsidian vault name. Required if you have more than one vault. | `MisFinanzas` |
| `payee` | Yes | Transaction description | `Supermercado` |
| `amount` | Yes | Numeric amount — no currency symbol, no thousands separators | `85000` |
| `to` | Yes | Destination account (full name including prefix) | `Gastos:Comida` |
| `from` | Yes | Source account (full name including prefix) | `Activos:Banco` |
| `date` | No | Date in `YYYY/MM/DD` format. Defaults to today. | `2026/03/22` |
| `status` | No | `*` = confirmed, `!` = pending, omit = unmarked. Defaults to `*`. | `*` |

> **Finding your vault name:** In Obsidian, go to **Settings → About** and look at the vault name at the top, or check the folder name of your vault on disk. Spaces in the vault name must be encoded as `%20` (e.g. `vault=Mis%20Finanzas`).

### URL encoding

Account names use `:` as a separator (e.g. `Gastos:Comida`). Most tools handle this automatically, but if your environment requires strict encoding, replace `:` with `%3A` and spaces with `%20` or `+`.

| Character | Encoded |
|-----------|---------|
| `:` | `%3A` (or leave as-is in most tools) |
| space | `%20` or `+` |
| `/` in dates | `%2F` (or leave as-is in most tools) |

### Examples

**Grocery expense paid in cash:**
```
obsidian://simple-ledger?vault=MyVault&payee=Supermercado&amount=85000&to=Gastos:Comida&from=Activos:Efectivo
```

**Charge something to a credit card:**
```
obsidian://simple-ledger?vault=MyVault&payee=Netflix&amount=15000&to=Gastos:Entretenimiento&from=Pasivos:TarjetaCredito
```

**Pay the credit card:**
```
obsidian://simple-ledger?vault=MyVault&payee=Pago+tarjeta&amount=150000&to=Pasivos:TarjetaCredito&from=Activos:Banco
```

**Record salary income on a specific date:**
```
obsidian://simple-ledger?vault=MyVault&payee=Salario+Marzo&amount=1000000&to=Activos:Banco&from=Ingresos:Salario&date=2026/03/31
```

**Mark a transaction as pending:**
```
obsidian://simple-ledger?vault=MyVault&payee=Arriendo&amount=400000&to=Gastos:Hogar&from=Activos:Banco&status=!
```

If any required parameter (`payee`, `amount`, `to`, `from`) is missing, the plugin opens the transaction form so you can fill in the rest manually.

---

### Setting up iOS Shortcuts

iOS Shortcuts lets you create home screen buttons that record a transaction in one tap — ideal for coffee, transport, or any daily expense.

**Create a simple one-tap expense button:**

1. Open the **Shortcuts** app → tap **+** to create a new shortcut
2. Tap **Add action** → search for **"Open URLs"** and select it
3. Paste your URI in the URL field:
   ```
   obsidian://simple-ledger?vault=MyVault&payee=Cafe&amount=3000&to=Gastos:Comida&from=Activos:Efectivo
   ```
4. Tap the shortcut name at the top to rename it (e.g. "☕ Café")
5. Tap **Done**
6. Long-press the shortcut → **Add to Home Screen**

Now tapping that icon on your home screen registers the transaction immediately and opens Obsidian to confirm it.

**Create a shortcut that asks for the amount each time:**

1. Create a new shortcut
2. Add action **"Ask for Input"** → set type to **Number**, prompt to `Monto`
3. Add action **"Open URLs"**
4. In the URL field, tap where you want the amount and insert the **"Provided Input"** variable from the action list:
   ```
   obsidian://simple-ledger?vault=MyVault&payee=Gasto&amount=[Provided Input]&to=Gastos:Otros&from=Activos:Banco
   ```
5. Name it and add it to the Home Screen

This way the shortcut asks you for the amount before opening Obsidian.

---

### Setting up Android Shortcuts

**Using the HTTP Shortcuts app (recommended):**

1. Install [HTTP Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts) from the Play Store
2. Tap **+** → **Browser Shortcut**
3. Set the URL to your URI:
   ```
   obsidian://simple-ledger?vault=MyVault&payee=Supermercado&amount=85000&to=Gastos:Comida&from=Activos:Banco
   ```
4. Give it a name and icon
5. Long-press the shortcut in the app → **Place on Home Screen**

**Using Tasker:**

1. Create a new **Task**
2. Add action **Misc → Browse URL**
3. Set the URL to your `obsidian://simple-ledger?...` URI
4. Create a **Task Shortcut** widget on the home screen pointing to that task

---

### Browser bookmark (desktop)

On desktop you can save URIs as browser bookmarks for quick logging from your browser.

1. In your browser, create a new bookmark
2. Set the **URL** to:
   ```
   obsidian://simple-ledger?vault=MyVault&payee=Almuerzo&amount=12000&to=Gastos:Comida&from=Activos:Banco
   ```
3. Give it a name and place it in your bookmarks bar

Clicking it will switch to Obsidian and register the transaction.

---

### Scripting and automation

You can call the URI from any script. The exact method depends on your operating system:

**macOS / Linux:**
```bash
open "obsidian://simple-ledger?vault=MyVault&payee=Suscripcion&amount=9900&to=Gastos:Entretenimiento&from=Activos:Banco"
```

**Windows (PowerShell):**
```powershell
Start-Process "obsidian://simple-ledger?vault=MyVault&payee=Suscripcion&amount=9900&to=Gastos:Entretenimiento&from=Activos:Banco"
```

**Windows (CMD):**
```cmd
start obsidian://simple-ledger?vault=MyVault^&payee=Suscripcion^&amount=9900^&to=Gastos:Entretenimiento^&from=Activos:Banco
```
> Note: In CMD, escape `&` with `^`.

This makes it easy to trigger ledger entries from cron jobs, calendar reminders, or other automations.

---

## Contributing

Issues and pull requests are welcome at [github.com/FabianIsaac/simple-ledger](https://github.com/FabianIsaac/simple-ledger).

---

## License

MIT
