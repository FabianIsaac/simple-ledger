import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LEDGER, ACCT } from '../constants';
import { PluginSettings, Transaction, BalanceTree, AddTransactionData, ISimpleLedgerPlugin } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount } from '../utils/formatting';
import { AddTransactionModal } from '../modals/AddTransactionModal';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { ManageAccountsModal } from '../modals/ManageAccountsModal';

type Plugin = ISimpleLedgerPlugin;

const PAGE_SIZE = 10;

function acctColor(fullName: string, amount: number): string {
	if (fullName.startsWith(ACCT.expenses)) return 'sl-acct-expense';
	if (fullName.startsWith(ACCT.liabilities)) return 'sl-acct-liability';
	if (fullName.startsWith(ACCT.income)) return 'sl-acct-income';
	return amount >= 0 ? 'sl-positive' : 'sl-negative';
}

export class LedgerSidebarView extends ItemView {
	private plugin: Plugin;
	private txPage: number;
	private treeCollapsed: boolean;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
		this.txPage = 0;
		this.treeCollapsed = false;
	}

	getViewType(): string { return VIEW_TYPE_LEDGER; }
	getDisplayText(): string { return 'Simple Ledger'; }
	getIcon(): string { return 'wallet'; }

	async onOpen(): Promise<void> {
		await this.plugin.loadTransactions();
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('simple-ledger-sidebar');

		const settings = this.plugin.settings;
		const txs = this.plugin.transactions ?? [];
		const now = new Date();
		const currentMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

		// Header
		const header = container.createDiv('sl-sidebar-header');
		header.createEl('h3', { text: 'Simple Ledger' });

		const btnBar = header.createDiv('sl-header-btns');
		const addBtn = btnBar.createEl('button', { text: '+ Nuevo', cls: 'sl-header-btn mod-cta' });
		addBtn.addEventListener('click', () => {
			new AddTransactionModal(this.app, this.plugin, (data) => {
				this.plugin.addTransaction(data);
			}).open();
		});
		const refreshBtn = btnBar.createEl('button', { text: '↻', cls: 'sl-header-btn', attr: { title: 'Recargar' } });
		refreshBtn.addEventListener('click', () => {
			this.plugin.loadTransactions().then(() => this.render());
		});

		const balances = LedgerParser.computeBalances(txs);
		const tree = LedgerParser.computeBalanceTree(balances);

		if (Object.keys(tree).length === 0) {
			const empty = container.createDiv('sl-empty');
			empty.createEl('p', { text: 'No hay transacciones aun.' });
			empty.createEl('p', { text: 'Usa el boton "+ Nuevo" para empezar.' });
			return;
		}

		// Summary cards
		const excluded = settings.excludedFromBalance ?? [];
		const isExcluded = (acct: string) => excluded.some(ex => acct === ex || acct.startsWith(ex + ':'));
		const liquid = Object.fromEntries(Object.entries(balances).filter(([k]) => !isExcluded(k)));
		const summary = container.createDiv('sl-summary');
		const totalIncome = Object.entries(liquid)
			.filter(([k]) => k.startsWith(ACCT.income))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalExpenses = Object.entries(liquid)
			.filter(([k]) => k.startsWith(ACCT.expenses))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalAssets = Object.entries(liquid)
			.filter(([k]) => k.startsWith(ACCT.assets))
			.reduce((s, [, v]) => s + v, 0);

		this._createCard(summary, 'Ingresos', totalIncome, 'sl-card-income');
		this._createCard(summary, 'Gastos', totalExpenses, 'sl-card-expense');
		this._createCard(summary, 'Balance', totalAssets, 'sl-card-balance');

		// Monthly summary
		const monthLabel = now.toLocaleString('es', { month: 'long', year: 'numeric' });
		const monthTxs = txs.filter(tx => tx.date.startsWith(currentMonth));
		const monthBalances = LedgerParser.computeBalances(monthTxs);
		const monthIncome = Object.entries(monthBalances)
			.filter(([k]) => k.startsWith(ACCT.income))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const monthExpenses = Object.entries(monthBalances)
			.filter(([k]) => k.startsWith(ACCT.expenses))
			.reduce((s, [, v]) => s + Math.abs(v), 0);

		const monthSection = container.createDiv('sl-month-section');
		monthSection.createDiv({ text: monthLabel, cls: 'sl-month-label' });
		const monthSummary = monthSection.createDiv('sl-summary sl-summary-month');
		this._createCard(monthSummary, 'Ingresos mes', monthIncome, 'sl-card-income');
		this._createCard(monthSummary, 'Gastos mes', monthExpenses, 'sl-card-expense');
		const monthNet = monthIncome - monthExpenses;
		this._createCard(monthSummary, 'Neto mes', monthNet, monthNet >= 0 ? 'sl-card-balance' : 'sl-card-expense');

		// Account tree
		const treeSection = container.createDiv('sl-tree-section');
		const treeHeader = treeSection.createDiv('sl-section-header');
		treeHeader.createEl('h4', { text: 'Cuentas' });
		const treeActions = treeHeader.createDiv('sl-section-header-actions');
		const collapseBtn = treeActions.createEl('button', {
			text: this.treeCollapsed ? '▶' : '▼',
			cls: 'sl-gear-btn',
			attr: { title: this.treeCollapsed ? 'Expandir todo' : 'Colapsar todo' },
		});
		collapseBtn.addEventListener('click', () => { this.treeCollapsed = !this.treeCollapsed; this.render(); });
		const gearBtn = treeActions.createEl('button', { text: '⚙', cls: 'sl-gear-btn', attr: { title: 'Gestionar cuentas' } });
		gearBtn.addEventListener('click', () => {
			new ManageAccountsModal(this.app, this.plugin).open();
		});
		this._renderTree(treeSection, tree, 0, '', this.treeCollapsed);

		// Recent transactions — paginadas
		const sorted = [...txs].reverse();
		const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
		if (this.txPage >= totalPages) this.txPage = Math.max(0, totalPages - 1);

		const recentSection = container.createDiv('sl-recent-section');
		const recentHeader = recentSection.createDiv('sl-section-header');
		recentHeader.createEl('h4', { text: 'Transacciones' });
		recentHeader.createSpan({ text: `(${txs.length})`, cls: 'sl-tx-count' });

		const txList = recentSection.createDiv('sl-tx-list');
		const pageSlice = sorted.slice(this.txPage * PAGE_SIZE, (this.txPage + 1) * PAGE_SIZE);
		for (const tx of pageSlice) {
			const wrapper = txList.createDiv('sl-tx-wrapper');
			const row = wrapper.createDiv('sl-tx-row sl-tx-clickable');
			row.createSpan({ text: tx.date, cls: 'sl-tx-date' });
			row.createSpan({ text: tx.payee, cls: 'sl-tx-payee' });
			const mainPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
			if (mainPosting && mainPosting.amount !== null) {
				row.createSpan({
					text: fmtAmount(mainPosting.amount, settings),
					cls: `sl-tx-amount ${(mainPosting.amount ?? 0) >= 0 ? 'sl-positive' : 'sl-negative'}`,
				});
			}
			row.createSpan({ text: '✎', cls: 'sl-tx-edit-icon' });
			if (tx.notes) {
				wrapper.createDiv({ text: tx.notes, cls: 'sl-tx-note-text' });
			}
			row.addEventListener('click', () => {
				new EditTransactionModal(
					this.app, this.plugin, tx,
					(oldTx, newData) => {
						this.plugin.updateTransaction(oldTx, newData).then(() => this.render());
					},
					(txToDelete) => {
						this.plugin.deleteTransaction(txToDelete).then(() => this.render());
					}
				).open();
			});
		}

		this._renderPagination(recentSection, this.txPage, totalPages, (p) => { this.txPage = p; this.render(); });
	}

	private _renderPagination(parent: HTMLElement, page: number, totalPages: number, onChange: (p: number) => void): void {
		if (totalPages <= 1) return;
		const bar = parent.createDiv('sl-pagination');

		const prev = bar.createEl('button', { text: '‹', cls: 'sl-page-btn', attr: { title: 'Anterior' } });
		prev.disabled = page === 0;
		prev.addEventListener('click', () => onChange(page - 1));

		const maxBtns = 5;
		let start = Math.max(0, page - Math.floor(maxBtns / 2));
		const end = Math.min(totalPages - 1, start + maxBtns - 1);
		start = Math.max(0, end - maxBtns + 1);

		if (start > 0) {
			const b = bar.createEl('button', { text: '1', cls: 'sl-page-btn' });
			b.addEventListener('click', () => onChange(0));
			if (start > 1) bar.createSpan({ text: '…', cls: 'sl-page-ellipsis' });
		}
		for (let i = start; i <= end; i++) {
			const b = bar.createEl('button', { text: String(i + 1), cls: `sl-page-btn${i === page ? ' sl-page-active' : ''}` });
			b.addEventListener('click', () => onChange(i));
		}
		if (end < totalPages - 1) {
			if (end < totalPages - 2) bar.createSpan({ text: '…', cls: 'sl-page-ellipsis' });
			const b = bar.createEl('button', { text: String(totalPages), cls: 'sl-page-btn' });
			b.addEventListener('click', () => onChange(totalPages - 1));
		}

		const next = bar.createEl('button', { text: '›', cls: 'sl-page-btn', attr: { title: 'Siguiente' } });
		next.disabled = page >= totalPages - 1;
		next.addEventListener('click', () => onChange(page + 1));
	}

	private _createCard(parent: HTMLElement, title: string, amount: number, cls: string): void {
		const card = parent.createDiv(`sl-card ${cls}`);
		card.createDiv({ text: title, cls: 'sl-card-title' });
		card.createDiv({ text: fmtAmount(amount, this.plugin.settings), cls: 'sl-card-amount' });
	}

	private _renderTree(container: HTMLElement, tree: BalanceTree, depth: number, prefix = '', collapsed = false): void {
		const settings = this.plugin.settings;
		for (const [key, node] of Object.entries(tree)) {
			const fullName = prefix ? `${prefix}:${key}` : key;
			const row = container.createDiv('sl-tree-row');
			row.style.paddingLeft = `${depth * 16 + 8}px`;
			row.createSpan({ text: key, cls: 'sl-tree-label' });
			row.createSpan({
				text: fmtAmount(node._total, settings),
				cls: `sl-tree-amount ${acctColor(fullName, node._total)}`,
			});
			const hasChildren = Object.keys(node._children).length > 0;
			if (hasChildren && !collapsed) {
				this._renderTree(container, node._children, depth + 1, fullName, false);
			}
		}
	}

	async onClose(): Promise<void> {}
}
