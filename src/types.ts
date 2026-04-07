export interface Posting {
	account: string;
	amount: number | null;
	currency: string;
	amountFormatted?: string;
}

export interface Transaction {
	date: string;
	status: string;
	payee: string;
	notes?: string;
	postings: Posting[];
	lineStart: number;
	lineEnd: number;
}

export interface RecurringTransaction {
	id: string;
	payee: string;
	amount: number;
	toAccount: string;
	fromAccount: string;
	frequency: 'monthly' | 'weekly' | 'yearly';
	dayOfMonth?: number;
	dayOfWeek?: number;
	monthOfYear?: number;
	status: string;
	_isCreditPayment?: boolean;
	_creditId?: string;
	_principalPortion?: number;
	_interestPortion?: number;
	_interestAccount?: string;
}

export interface Credit {
	id: string;
	name: string;
	principal: number;
	totalDebt: number;
	interestTotal: number;
	monthlyPayment: number;
	months: number;
	startDate: string;
	fromAsset: string;
	dayOfMonth?: number;
	paidMonths?: number;
}

export interface DefaultAccounts {
	expenses: string[];
	income: string[];
	assets: string[];
	liabilities: string[];
}

export interface AccountPrefixes {
	expenses: string;
	income: string;
	assets: string;
	liabilities: string;
}

export interface PluginSettings {
	ledgerFile: string;
	currencySymbol: string;
	currencyAfter: boolean;
	decimals: number;
	thousandSeparator: string;
	recurringNotesFolder: string;
	accountPrefixes: AccountPrefixes;
	defaultAccounts: DefaultAccounts;
	archivedAccounts: string[];
	excludedFromBalance: string[];
	recurringTransactions: RecurringTransaction[];
	credits: Credit[];
	budgets: Budget[];
	savedFilters: {
		from: string;
		to: string;
		account: string;
		search: string;
	};
	showStatusBarDebts: boolean;
	statusBarLookaheadDays: number;
}

export interface BlockFilterOptions {
	account: string | null;
	from: string | null;
	to: string | null;
	search: string | null;
	limit: number;
	order: 'asc' | 'desc';
	period: 'month' | 'year';
	type: 'expenses' | 'income' | 'assets' | 'liabilities';
	level: 1 | 2;
}

/**
 * Interfaz unificada del plugin. Usada por vistas, modales y renderers
 * como tipo del parámetro `plugin`, en lugar de definir una interfaz local
 * en cada archivo.
 */
export interface ISimpleLedgerPlugin {
	settings: PluginSettings;
	transactions: Transaction[];
	loadTransactions(): Promise<Transaction[]>;
	saveSettings(): Promise<void>;
	addTransaction(data: AddTransactionData): Promise<void>;
	addMultiPostingTransaction(data: MultiPostingTransactionData): Promise<void>;
	updateTransaction(oldTx: Transaction, newData: AddTransactionData): Promise<void>;
	deleteTransaction(tx: Transaction): Promise<void>;
	addCreditPayment(rec: RecurringTransaction): Promise<void>;
	registerRecurringPayment(rec: RecurringTransaction): Promise<void>;
	openRecurringNote(rec: RecurringTransaction): Promise<void>;
	createRecurringNote(rec: RecurringTransaction): Promise<void>;
	renameAccount(oldName: string, newName: string): Promise<void>;
}

export interface AddTransactionData {
	date: string;
	payee: string;
	amount: number;
	toAccount: string;
	fromAccount: string;
	status: string;
	notes?: string;
}

export interface MultiPostingRow {
	account: string;
	amount: number | null; // null = auto-balance (one row allowed)
}

export interface MultiPostingTransactionData {
	date: string;
	payee: string;
	status: string;
	notes?: string;
	postings: MultiPostingRow[];
}

export interface Budget {
	id: string;
	account: string;
	amount: number;
	period: 'monthly' | 'yearly';
}

export interface BalanceTree {
	[key: string]: BalanceTreeNode;
}

export interface BalanceTreeNode {
	_total: number;
	_children: BalanceTree;
}
