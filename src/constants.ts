import { AccountPrefixes, PluginSettings } from './types';

export const PLUGIN_ID = 'simple-ledger';

/**
 * Prefijos canónicos de las categorías de cuentas.
 * Es mutable — se actualiza en onload() desde plugin.settings.accountPrefixes.
 * Todo el código que importa ACCT recibe automáticamente el valor configurado.
 */
export const ACCT = {
	income: 'Ingresos',
	expenses: 'Gastos',
	assets: 'Activos',
	liabilities: 'Pasivos',
};

/** Actualiza ACCT desde las settings del plugin. Llamar en onload(). */
export function setACCT(prefixes: AccountPrefixes): void {
	ACCT.income = prefixes.income;
	ACCT.expenses = prefixes.expenses;
	ACCT.assets = prefixes.assets;
	ACCT.liabilities = prefixes.liabilities;
}

export const DEFAULT_PREFIXES_ES: AccountPrefixes = {
	expenses: 'Gastos',
	income: 'Ingresos',
	assets: 'Activos',
	liabilities: 'Pasivos',
};

export const DEFAULT_PREFIXES_EN: AccountPrefixes = {
	expenses: 'Expenses',
	income: 'Income',
	assets: 'Assets',
	liabilities: 'Liabilities',
};

export const DEFAULT_ACCOUNTS_ES = {
	expenses: ['Gastos:Comida', 'Gastos:Transporte', 'Gastos:Hogar', 'Gastos:Salud', 'Gastos:Entretenimiento', 'Gastos:Ropa', 'Gastos:Educacion', 'Gastos:Servicios', 'Gastos:Otros'],
	income: ['Ingresos:Salario', 'Ingresos:Freelance', 'Ingresos:Otros'],
	assets: ['Activos:Banco', 'Activos:Efectivo', 'Activos:Ahorros'],
	liabilities: ['Pasivos:TarjetaCredito', 'Pasivos:Prestamo'],
};

export const DEFAULT_ACCOUNTS_EN = {
	expenses: ['Expenses:Food', 'Expenses:Transport', 'Expenses:Housing', 'Expenses:Health', 'Expenses:Entertainment', 'Expenses:Clothing', 'Expenses:Education', 'Expenses:Services', 'Expenses:Other'],
	income: ['Income:Salary', 'Income:Freelance', 'Income:Other'],
	assets: ['Assets:Bank', 'Assets:Cash', 'Assets:Savings'],
	liabilities: ['Liabilities:CreditCard', 'Liabilities:Loan'],
};

export const VIEW_TYPE_LEDGER = 'simple-ledger-view';
export const VIEW_TYPE_LEDGER_MAIN = 'simple-ledger-main-view';
export const VIEW_TYPE_RECURRING = 'simple-ledger-recurring-view';
export const VIEW_TYPE_QUICK_ADD = 'simple-ledger-quick-add';
export const VIEW_TYPE_ACCOUNTS = 'simple-ledger-accounts';
export const VIEW_TYPE_BUDGET = 'simple-ledger-budget';

export const DEFAULT_SETTINGS: PluginSettings = {
	ledgerFile: 'Finanzas.ledger',
	currencySymbol: '$',
	currencyAfter: false,
	decimals: 2,
	thousandSeparator: '.',
	recurringNotesFolder: 'Finanzas/Recurrentes',
	accountPrefixes: { ...DEFAULT_PREFIXES_ES },
	defaultAccounts: { ...DEFAULT_ACCOUNTS_ES },
	archivedAccounts: [],
	excludedFromBalance: [],
	recurringTransactions: [],
	credits: [],
	budgets: [],
	savedFilters: { from: '', to: '', account: '', search: '' },
	showStatusBarDebts: true,
	statusBarLookaheadDays: 7,
};
