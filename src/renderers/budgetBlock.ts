import { ISimpleLedgerPlugin, Budget, Transaction } from '../types';
import { fmtAmount } from '../utils/formatting';
import { t } from '../i18n';

type Plugin = ISimpleLedgerPlugin & { transactions: Transaction[] };

interface BudgetBlockOptions {
	account: string | null;
	period: 'monthly' | 'yearly' | 'both' | null;
	title: string | null;
}

function parseOptions(source: string): BudgetBlockOptions {
	const opts: BudgetBlockOptions = { account: null, period: null, title: null };
	for (const line of source.split('\n')) {
		const m = line.trim().match(/^(\w+)\s*[:=]\s*(.+)$/);
		if (!m) continue;
		const key = (m[1] ?? '').toLowerCase();
		const val = (m[2] ?? '').trim();
		if (key === 'account') opts.account = val;
		else if (key === 'period') {
			const v = val.toLowerCase();
			opts.period = v === 'yearly' || v === 'annual' || v === 'year' ? 'yearly'
				: v === 'both' || v === 'all' ? 'both'
				: 'monthly';
		}
		else if (key === 'title') opts.title = val;
	}
	return opts;
}

function calcSpent(budget: Budget, transactions: Transaction[]): number {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const prefix = budget.period === 'monthly' ? `${year}/${month}` : `${year}`;
	return transactions
		.filter(tx => tx.date.startsWith(prefix))
		.flatMap(tx => tx.postings)
		.filter(p => p.account === budget.account || p.account.startsWith(budget.account + ':'))
		.reduce((sum, p) => sum + (p.amount ?? 0), 0);
}

function renderSingleBudget(container: HTMLElement, budget: Budget, spent: number, plugin: Plugin): void {
	const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
	const over = spent > budget.amount;
	const warn = !over && pct >= 75;
	const realPct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;

	const card = container.createDiv({ cls: 'sl-codeblock-budget-card' });

	const top = card.createDiv({ cls: 'sl-budget-card-top' });
	top.createEl('span', { text: budget.account, cls: 'sl-budget-account' });
	const amtInfo = top.createDiv({ cls: 'sl-budget-amounts' });
	amtInfo.createEl('span', {
		text: fmtAmount(spent, plugin.settings),
		cls: `sl-budget-spent ${over ? 'sl-budget-over-text' : ''}`,
	});
	amtInfo.createEl('span', { text: ` ${t('view_budget_of')} `, cls: 'sl-budget-of' });
	amtInfo.createEl('span', { text: fmtAmount(budget.amount, plugin.settings), cls: 'sl-budget-limit' });

	const track = card.createDiv({ cls: 'sl-budget-bar-track' });
	const fill = track.createDiv({ cls: 'sl-budget-bar-fill' });
	fill.style.width = `${pct}%`;
	fill.addClass(over ? 'sl-budget-bar-over' : warn ? 'sl-budget-bar-warn' : 'sl-budget-bar-ok');

	const bottom = card.createDiv({ cls: 'sl-budget-card-bottom' });
	const diff = Math.abs(budget.amount - spent);
	bottom.createEl('span', {
		text: `${fmtAmount(diff, plugin.settings)} ${over ? t('view_budget_over') : t('view_budget_remaining')}`,
		cls: `sl-budget-tag ${over ? 'sl-budget-tag-over' : warn ? 'sl-budget-tag-warn' : 'sl-budget-tag-ok'}`,
	});
	bottom.createEl('span', { text: `${realPct}%`, cls: 'sl-budget-pct' });
}

export function renderBudgetBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const opts = parseOptions(source);
	const allBudgets = plugin.settings.budgets ?? [];
	const txs = plugin.transactions ?? [];

	const container = el.createDiv({ cls: 'sl-codeblock sl-codeblock-budget' });

	if (opts.title) {
		container.createEl('h4', { text: opts.title, cls: 'sl-codeblock-budget-title' });
	}

	const budgets = allBudgets.filter(b => {
		const matchAccount = !opts.account
			|| b.account === opts.account
			|| b.account.startsWith(opts.account + ':')
			|| b.account.toLowerCase().includes(opts.account.toLowerCase());
		const matchPeriod = !opts.period || opts.period === 'both'
			|| (opts.period === 'monthly' && b.period === 'monthly')
			|| (opts.period === 'yearly' && b.period === 'yearly');
		return matchAccount && matchPeriod;
	});

	if (budgets.length === 0) {
		container.createEl('p', { text: t('view_budget_empty'), cls: 'sl-empty-msg' });
		return;
	}

	const hasMonthly = budgets.some(b => b.period === 'monthly');
	const hasYearly = budgets.some(b => b.period === 'yearly');
	const showSections = hasMonthly && hasYearly && (!opts.period || opts.period === 'both');

	if (showSections) {
		if (hasMonthly) {
			container.createEl('p', { text: t('view_budget_section_monthly'), cls: 'sl-codeblock-budget-section' });
			for (const b of budgets.filter(b => b.period === 'monthly')) {
				renderSingleBudget(container, b, calcSpent(b, txs), plugin);
			}
		}
		if (hasYearly) {
			container.createEl('p', { text: t('view_budget_section_yearly'), cls: 'sl-codeblock-budget-section' });
			for (const b of budgets.filter(b => b.period === 'yearly')) {
				renderSingleBudget(container, b, calcSpent(b, txs), plugin);
			}
		}
	} else {
		for (const b of budgets) {
			renderSingleBudget(container, b, calcSpent(b, txs), plugin);
		}
	}
}
