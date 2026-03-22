# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development build with watch mode (inline source maps)
npm run build        # Type-check + production build (minified, no source maps)
npm run package      # Build + copy main.js, manifest.json, styles.css to dist/
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
```

To run a single test file:
```bash
npx vitest run src/__tests__/parser/LedgerParser.test.ts
```

## Architecture

This is an **Obsidian plugin** for double-entry bookkeeping. The build outputs a single CommonJS `main.js` bundle (via esbuild) that Obsidian loads directly.

### Data Flow

1. **Load**: Vault `.ledger` file → `LedgerParser.parse()` → `Transaction[]` stored in `plugin.transactions`
2. **Modify**: User action → Modal → `plugin.addTransaction()` / `updateTransaction()` / `deleteTransaction()`
3. **Persist**: Write back to `.ledger` file (line-based to preserve line numbers for edits/deletes)
4. **Refresh**: Reload transactions → notify all views to re-render

### Key Files

- [src/main.ts](src/main.ts) — Plugin entry point. Registers views, commands, URI handler, markdown code block processors, and owns all data mutation methods.
- [src/types.ts](src/types.ts) — All TypeScript interfaces (`Transaction`, `Posting`, `RecurringTransaction`, `Credit`, `PluginSettings`, `BlockFilterOptions`).
- [src/parser/LedgerParser.ts](src/parser/LedgerParser.ts) — Regex-based parser for ledger-cli format. Also handles `computeBalances()` and `computeBalanceTree()` for account hierarchy aggregation.
- [src/views/](src/views/) — Four `ItemView` subclasses that render HTML into Obsidian panels. Views read `plugin.transactions` and call `LedgerParser` methods directly.
- [src/modals/](src/modals/) — `Modal` subclasses for user input. Receive callbacks from views and call plugin data methods on submit.
- [src/renderers/](src/renderers/) — Process `ledger-balance`, `ledger-register`, `ledger-summary` code blocks in notes.
- [src/utils/](src/utils/) — Stateless helpers: `formatting.ts` (currency/date), `filters.ts` (transaction filtering/grouping), `recurring.ts` (recurring payment logic).

### Ledger File Format

Plain-text, ledger-cli compatible:
```
2026/03/22 * Description
    Gastos:Comida              $85,000
    Activos:Banco
```
- `*` = confirmed, `!` = pending
- Last posting auto-balances (no amount needed)
- Account hierarchy uses `:` separator (e.g., `Gastos:Comida:Restaurantes`)
- Transactions store `startLine`/`endLine` for in-place edits

### Recurring & Credit Features

- **Recurring transactions** are stored in plugin settings (not in the ledger file). They match against actual transactions by payee + amount.
- **Credits/loans** use a multi-step wizard (`CreditWizardModal`) that calculates monthly payments and creates an interest expense account. Loan metadata stored in settings.

### Obsidian Integration Points

- **URI handler**: `obsidian://simple-ledger?payee=&amount=&to=&from=`
- **Code blocks**: `ledger-balance`, `ledger-register`, `ledger-summary` — all support filter params (`cuenta`, `desde`, `hasta`, `mes`, `año`, `buscar`, `limite`, `orden`, `periodo`)
- **Views registered**: `ledger-sidebar`, `ledger-main`, `ledger-recurring`, `ledger-quickadd`

### Build Notes

- `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, and Node built-ins are all marked external in esbuild.
- Output format is CJS (required by Obsidian), even though the source uses ESM.
- Tests run in Node environment (no browser/Obsidian API available in tests — mock as needed).
