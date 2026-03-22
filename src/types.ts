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

export interface PluginSettings {
	ledgerFile: string;
	currencySymbol: string;
	currencyAfter: boolean;
	decimals: number;
	defaultAccounts: DefaultAccounts;
	archivedAccounts: string[];
	recurringTransactions: RecurringTransaction[];
	credits: Credit[];
}

export interface BlockFilterOptions {
	account: string | null;
	from: string | null;
	to: string | null;
	search: string | null;
	limit: number;
	order: 'asc' | 'desc';
	period: 'month' | 'year';
}

export interface AddTransactionData {
	date: string;
	payee: string;
	amount: number;
	toAccount: string;
	fromAccount: string;
	status: string;
}

export interface BalanceTree {
	[key: string]: BalanceTreeNode;
}

export interface BalanceTreeNode {
	_total: number;
	_children: BalanceTree;
}
