import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { VIEW_TYPE_LEDGER_MAIN, ACCT } from '../constants';
import { PluginSettings, Transaction, BalanceTree, AddTransactionData, RecurringTransaction, ISimpleLedgerPlugin } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount, todayStr } from '../utils/formatting';
import { isRecurringPaidThisPeriod, getNextDueDate, FREQUENCY_LABELS } from '../utils/recurring';
import { computePieData, buildPieSvg } from '../utils/pieChart';
import { buildCashflowContent } from '../utils/cashflowChart';
import { AddTransactionModal } from '../modals/AddTransactionModal';
import { ImportTransactionsModal } from '../modals/ImportTransactionsModal';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { AddRecurringModal } from '../modals/AddRecurringModal';
import { CreditWizardModal } from '../modals/CreditWizardModal';

interface Filters {
	from: string;
	to: string;
	account: string;
	search: string;
}

type Plugin = ISimpleLedgerPlugin;

/** Para el árbol de cuentas: usa el saldo real para colorear activos. */
function acctColor(fullName: string, amount: number): string {
	if (fullName.startsWith(ACCT.expenses)) return 'sl-acct-expense';
	if (fullName.startsWith(ACCT.liabilities)) return 'sl-acct-liability';
	if (fullName.startsWith(ACCT.income)) return 'sl-acct-income';
	return amount >= 0 ? 'sl-positive' : 'sl-negative';
}

/** Para etiquetas de cuenta en transacciones: activos sin color especial. */
function acctLabelColor(account: string): string {
	if (account.startsWith(ACCT.expenses)) return 'sl-label-expense';
	if (account.startsWith(ACCT.liabilities)) return 'sl-label-liability';
	if (account.startsWith(ACCT.income)) return 'sl-label-income';
	return '';
}

export class LedgerMainView extends ItemView {
	private plugin: Plugin;
	private filters: Filters;
	private collapsedAccounts: Set<string>;
	private manageOpen: boolean;
	private manageTab: 'expenses' | 'income' | 'assets' | 'liabilities';
	private chartMode: 'cashflow' | 'pie';
	private pieType: 'gastos' | 'ingresos';
	private pieLevel: 1 | 2;
	private txPage: number;
	private txSortOrder: 'desc' | 'asc';
	private filtersVisible: boolean;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
		this.filters = { from: '', to: '', account: '', search: '' };
		this.collapsedAccounts = new Set();
		this.manageOpen = false;
		this.manageTab = 'expenses';
		this.chartMode = 'cashflow';
		this.pieType = 'gastos';
		this.pieLevel = 1;
		this.txPage = 0;
		this.txSortOrder = 'desc';
		this.filtersVisible = false;
	}

	getViewType(): string { return VIEW_TYPE_LEDGER_MAIN; }
	getDisplayText(): string { return 'Simple Ledger'; }
	getIcon(): string { return 'bar-chart-2'; }

	async onOpen(): Promise<void> {
		// Restaurar filtros guardados
		const saved = this.plugin.settings.savedFilters;
		if (saved) this.filters = { ...saved };
		await this.plugin.loadTransactions();
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('sl-main-panel');

		const settings = this.plugin.settings;
		const allTxs = this.plugin.transactions ?? [];

		let txs = [...allTxs];
		if (this.filters.from) txs = txs.filter(t => t.date >= this.filters.from);
		if (this.filters.to) txs = txs.filter(t => t.date <= this.filters.to);
		if (this.filters.account) {
			const af = this.filters.account.toLowerCase();
			txs = txs.filter(t => t.postings.some(p => p.account.toLowerCase().includes(af)));
		}
		if (this.filters.search) {
			const sf = this.filters.search.toLowerCase();
			txs = txs.filter(t =>
				t.payee.toLowerCase().includes(sf) ||
				t.postings.some(p => p.account.toLowerCase().includes(sf))
			);
		}

		// Header
		const header = container.createDiv('sl-main-header');
		const titleRow = header.createDiv('sl-main-title-row');
		titleRow.createEl('h2', { text: 'Simple Ledger' });

		// Action buttons in title row
		const titleActions = titleRow.createDiv('sl-title-actions');

		const mkIconBtn = (icon: string, title: string, extraCls = '') => {
			const btn = titleActions.createEl('button', { cls: `sl-icon-btn${extraCls ? ' ' + extraCls : ''}`, attr: { title } });
			setIcon(btn, icon);
			return btn;
		};

		mkIconBtn('plus', 'Nueva transaccion', 'mod-cta').addEventListener('click', () => {
			new AddTransactionModal(this.app, this.plugin, (data) => {
				this.plugin.addTransaction(data).then(() => this.render());
			}).open();
		});
		mkIconBtn('upload', 'Importar transacciones').addEventListener('click', () => {
			new ImportTransactionsModal(this.app, this.plugin, () => this.render()).open();
		});
		mkIconBtn('refresh-cw', 'Recargar').addEventListener('click', () => {
			this.plugin.loadTransactions().then(() => this.render());
		});
		mkIconBtn('download', 'Exportar a CSV').addEventListener('click', () => this._exportCSV(txs));

		const hasActiveFilters = Object.values(this.filters).some(v => v !== '');
		const filterToggle = mkIconBtn(
			'sliders-horizontal',
			'Mostrar/ocultar filtros',
			`${this.filtersVisible ? 'sl-btn-active' : ''}${hasActiveFilters ? ' sl-btn-has-filter' : ''}`,
		);
		filterToggle.addEventListener('click', () => {
			this.filtersVisible = !this.filtersVisible;
			this.render();
		});

		if (this.filtersVisible) this._renderFilters(header, allTxs);

		// Summary cards — monthly + total
		const balances = LedgerParser.computeBalances(txs);
		const excluded = settings.excludedFromBalance ?? [];
		const isExcluded = (acct: string) => excluded.some(ex => acct === ex || acct.startsWith(ex + ':'));
		const liquid = Object.fromEntries(Object.entries(balances).filter(([k]) => !isExcluded(k)));
		const totalIncome = Object.entries(liquid).filter(([k]) => k.startsWith(ACCT.income)).reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalExpenses = Object.entries(liquid).filter(([k]) => k.startsWith(ACCT.expenses)).reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalAssets = Object.entries(liquid).filter(([k]) => k.startsWith(ACCT.assets)).reduce((s, [, v]) => s + v, 0);
		const totalLiabilities = Object.entries(liquid).filter(([k]) => k.startsWith(ACCT.liabilities)).reduce((s, [, v]) => s + Math.abs(v), 0);

		const now = new Date();
		const currentMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
		const allTxsForMonth = (this.plugin.transactions ?? []).filter(t => t.date.startsWith(currentMonth));
		const monthBalances = LedgerParser.computeBalances(allTxsForMonth);
		const monthLiquid = Object.fromEntries(Object.entries(monthBalances).filter(([k]) => !isExcluded(k)));
		const monthIncome = Object.entries(monthLiquid).filter(([k]) => k.startsWith(ACCT.income)).reduce((s, [, v]) => s + Math.abs(v), 0);
		const monthExpenses = Object.entries(monthLiquid).filter(([k]) => k.startsWith(ACCT.expenses)).reduce((s, [, v]) => s + Math.abs(v), 0);
		const monthAssets = Object.entries(monthLiquid).filter(([k]) => k.startsWith(ACCT.assets)).reduce((s, [, v]) => s + v, 0);
		// Cambio neto en deuda este mes: negativo en ledger = más deuda, positivo = pagaste
		const monthNetDebtChange = -Object.entries(monthLiquid)
			.filter(([k]) => k.startsWith(ACCT.liabilities))
			.reduce((s, [, v]) => s + v, 0);

		const cards = container.createDiv('sl-main-cards');
		this._card(cards, 'Ingresos', monthIncome, totalIncome, 'sl-card-income');
		this._card(cards, 'Gastos', monthExpenses, totalExpenses, 'sl-card-expense');
		this._card(cards, 'Balance', monthAssets, totalAssets, 'sl-card-balance');
		// Deudas: grande = saldo actual total; pequeño = cambio neto este mes
		this._card(cards, 'Deudas', totalLiabilities, monthNetDebtChange, 'sl-card-liability', 'saldo actual', 'este mes');

		// Two-column layout
		const content = container.createDiv('sl-main-content');
		const leftCol = content.createDiv('sl-main-left');
		const rightCol = content.createDiv('sl-main-right');

		this._renderChart(leftCol, allTxs, txs);
		this._renderTransactionsTable(leftCol, txs);
		this._renderAccountPanel(rightCol, balances);
		this._renderRecurring(rightCol);
	}

	applyFilters(partial: Partial<Filters>): void {
		this.filters = { ...this.filters, ...partial };
		this._saveAndRender();
	}

	private _saveAndRender(): void {
		this.txPage = 0;
		this.plugin.settings.savedFilters = { ...this.filters };
		this.plugin.saveSettings();
		this.render();
	}

	private _renderFilters(parent: HTMLElement, allTxs: Transaction[]): void {
		const bar = parent.createDiv('sl-filter-bar');
		const dateGroup = bar.createDiv('sl-filter-group');
		dateGroup.createEl('label', { text: 'Desde' });
		const fromInput = dateGroup.createEl('input', { type: 'date', cls: 'sl-filter-input' });
		fromInput.value = this.filters.from ? this.filters.from.replace(/\//g, '-') : '';
		fromInput.addEventListener('change', (e) => {
			this.filters.from = (e.target as HTMLInputElement).value.replace(/-/g, '/');
			this._saveAndRender();
		});

		const dateGroup2 = bar.createDiv('sl-filter-group');
		dateGroup2.createEl('label', { text: 'Hasta' });
		const toInput = dateGroup2.createEl('input', { type: 'date', cls: 'sl-filter-input' });
		toInput.value = this.filters.to ? this.filters.to.replace(/\//g, '-') : '';
		toInput.addEventListener('change', (e) => {
			this.filters.to = (e.target as HTMLInputElement).value.replace(/-/g, '/');
			this._saveAndRender();
		});

		const acctGroup = bar.createDiv('sl-filter-group');
		acctGroup.createEl('label', { text: 'Cuenta' });
		const acctSelect = acctGroup.createEl('select', { cls: 'sl-filter-input' });
		acctSelect.createEl('option', { value: '', text: 'Todas' });
		const allAccounts = new Set<string>();
		for (const tx of allTxs) {
			for (const p of tx.postings) allAccounts.add(p.account);
		}
		for (const acct of [...allAccounts].sort()) {
			const opt = acctSelect.createEl('option', { value: acct, text: acct });
			if (acct === this.filters.account) opt.selected = true;
		}
		acctSelect.addEventListener('change', (e) => {
			this.filters.account = (e.target as HTMLSelectElement).value;
			this._saveAndRender();
		});

		const searchGroup = bar.createDiv('sl-filter-group');
		searchGroup.createEl('label', { text: 'Buscar' });
		const searchInput = searchGroup.createEl('input', { type: 'text', placeholder: 'Descripcion...', cls: 'sl-filter-input' });
		searchInput.value = this.filters.search;
		let searchTimeout: ReturnType<typeof setTimeout>;
		searchInput.addEventListener('input', (e) => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				this.filters.search = (e.target as HTMLInputElement).value;
				this._saveAndRender();
			}, 300);
		});

		const quickGroup = bar.createDiv('sl-filter-quick');
		const quickBtns = [
			{ label: 'Hoy', fn: () => { const t = todayStr(); this.filters.from = t; this.filters.to = t; } },
			{ label: 'Este mes', fn: () => {
				const now = new Date();
				const y = now.getFullYear();
				const m = String(now.getMonth() + 1).padStart(2, '0');
				this.filters.from = `${y}/${m}/01`;
				const last = new Date(y, now.getMonth() + 1, 0).getDate();
				this.filters.to = `${y}/${m}/${String(last).padStart(2, '0')}`;
			}},
			{ label: 'Este año', fn: () => {
				const y = new Date().getFullYear();
				this.filters.from = `${y}/01/01`;
				this.filters.to = `${y}/12/31`;
			}},
			{ label: 'Todo', fn: () => { this.filters.from = ''; this.filters.to = ''; this.filters.account = ''; this.filters.search = ''; }},
		];
		for (const q of quickBtns) {
			const btn = quickGroup.createEl('button', { text: q.label, cls: 'sl-quick-btn' });
			btn.addEventListener('click', () => { q.fn(); this._saveAndRender(); });
		}

	}

	private _renderChart(parent: HTMLElement, allTxs: Transaction[], filteredTxs: Transaction[]): void {
		const section = parent.createDiv('sl-chart-section');

		// Compute chart data — both modes use the same period
		const hasDateFilter = !!(this.filters.from || this.filters.to);
		const now = new Date();
		const currentMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
		const chartTxs = hasDateFilter
			? filteredTxs
			: filteredTxs.filter(t => t.date.startsWith(currentMonth));

		// Header: title + chart switcher icons (top right)
		const chartHeader = section.createDiv('sl-chart-header');
		chartHeader.createEl('h3', { text: this.chartMode === 'cashflow' ? 'Flujo de caja' : 'Distribución' });
		const switcher = chartHeader.createDiv('sl-chart-switcher');
		for (const [mode, icon, title] of [['cashflow', 'bar-chart-2', 'Flujo de caja'], ['pie', 'pie-chart', 'Distribución']] as [string, string, string][]) {
			const btn = switcher.createEl('button', {
				cls: 'sl-icon-btn' + (this.chartMode === mode ? ' sl-btn-active' : ''),
				attr: { title },
			});
			setIcon(btn, icon);
			btn.addEventListener('click', () => { this.chartMode = mode as 'cashflow' | 'pie'; this.render(); });
		}

		// Period note
		if (!hasDateFilter) {
			const subRow = section.createDiv('sl-chart-subrow');
			subRow.createSpan({ text: 'Mes actual • Aplica un filtro de fecha para ver otro período', cls: 'sl-chart-period-note' });
		}

		if (this.chartMode === 'cashflow') {
			this._renderCashflowChart(section, chartTxs);
		} else {
			this._renderPieChart(section, chartTxs);
		}

		// Pie controls at bottom, centered (only in pie mode)
		if (this.chartMode === 'pie') {
			const pieControls = section.createDiv('sl-pie-controls-bottom');
			for (const [key, icon, title] of [['gastos', 'trending-down', 'Gastos'], ['ingresos', 'trending-up', 'Ingresos']] as [string, string, string][]) {
				const btn = pieControls.createEl('button', {
					cls: 'sl-icon-btn' + (this.pieType === key ? ' sl-btn-active' : ''),
					attr: { title },
				});
				setIcon(btn, icon);
				btn.addEventListener('click', () => { this.pieType = key as 'gastos' | 'ingresos'; this.render(); });
			}
			pieControls.createSpan({ cls: 'sl-pie-controls-sep' });
			for (const [n, icon, title] of [[1, 'list', 'Nivel 1'], [2, 'list-tree', 'Nivel 2']] as [number, string, string][]) {
				const btn = pieControls.createEl('button', {
					cls: 'sl-icon-btn' + (this.pieLevel === n ? ' sl-btn-active' : ''),
					attr: { title },
				});
				setIcon(btn, icon);
				btn.addEventListener('click', () => { this.pieLevel = n as 1 | 2; this.render(); });
			}
		}
	}

	private _renderCashflowChart(section: HTMLElement, filteredTxs: Transaction[]): void {
		buildCashflowContent(section, filteredTxs, this.plugin.settings);
	}

	private _renderPieChart(section: HTMLElement, filteredTxs: Transaction[]): void {
		const settings = this.plugin.settings;
		const balances = LedgerParser.computeBalances(filteredTxs);
		const prefix = this.pieType === 'gastos' ? ACCT.expenses : ACCT.income;
		const pieData = computePieData(balances, prefix, this.pieLevel);

		if (pieData.length === 0) {
			section.createEl('p', { text: 'Sin datos para mostrar', cls: 'sl-empty-msg' });
			return;
		}

		const svg = buildPieSvg(pieData, settings, this._shortAmount.bind(this));
		section.appendChild(svg);
	}

	private _shortAmount(val: number): string {
		const abs = Math.abs(val);
		const sign = val < 0 ? '-' : '';
		const sym = this.plugin.settings.currencySymbol;
		if (abs >= 1000000) return `${sign}${sym}${(abs / 1000000).toFixed(1)}M`;
		if (abs >= 1000) return `${sign}${sym}${(abs / 1000).toFixed(0)}K`;
		return `${sign}${sym}${abs.toFixed(0)}`;
	}

	private _renderRecurring(parent: HTMLElement): void {
		const settings = this.plugin.settings;
		const recs = settings.recurringTransactions ?? [];
		const txs = this.plugin.transactions ?? [];

		const section = parent.createDiv('sl-recurring-section');
		const recHeader = section.createDiv('sl-section-header');
		recHeader.createEl('h3', { text: 'Recurrentes' });

		const headerBtns = recHeader.createDiv('sl-rec-header-btns');
		const addBtn = headerBtns.createEl('button', { text: '+', cls: 'sl-rec-add-btn', attr: { title: 'Nueva recurrente' } });
		addBtn.addEventListener('click', () => {
			new AddRecurringModal(this.app, this.plugin, null, () => this.render()).open();
		});
		const creditBtn = headerBtns.createEl('button', { text: '🏦', cls: 'sl-rec-add-btn', attr: { title: 'Nuevo credito' } });
		creditBtn.addEventListener('click', () => {
			new CreditWizardModal(this.app, this.plugin, null, () => this.render()).open();
		});

		if (recs.length === 0) {
			section.createEl('p', { text: 'Sin recurrentes', cls: 'sl-empty-msg sl-empty-small' });
			return;
		}

		const withStatus = recs.map(rec => ({
			rec, isPaid: isRecurringPaidThisPeriod(rec, txs), nextDue: getNextDueDate(rec),
		}));

		const pending = withStatus.filter(r => !r.isPaid).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
		const paid = withStatus.filter(r => r.isPaid);

		const maxVisible = 3;
		const visiblePending = pending.slice(0, maxVisible);
		const hiddenCount = pending.length - maxVisible;

		const grid = section.createDiv('sl-recurring-grid');

		const renderCard = (item: typeof withStatus[0], showPayBtn: boolean) => {
			const { rec, isPaid, nextDue } = item;
			const isExpense = rec.toAccount.startsWith(ACCT.expenses) || rec.toAccount.startsWith(ACCT.liabilities);

			const card = grid.createDiv(`sl-rec-card ${isPaid ? 'sl-rec-paid' : 'sl-rec-pending'}`);

			const topRow = card.createDiv('sl-rec-top');
			topRow.createSpan({ text: rec.payee, cls: 'sl-rec-name' });
			const rightSide = topRow.createDiv('sl-rec-top-right');
			topRow.createSpan({
				text: fmtAmount(rec.amount, settings),
				cls: `sl-rec-amount ${isExpense ? 'sl-negative' : 'sl-positive'}`,
			});

			if (showPayBtn && !isPaid) {
				const payBtn = rightSide.createEl('button', { cls: 'sl-rec-pay-btn', attr: { title: 'Registrar pago' } });
				payBtn.innerHTML = '&#10003;';
				payBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					if (rec._isCreditPayment) {
						this.plugin.addCreditPayment(rec).then(() => this.render());
					} else {
						this.plugin.registerRecurringPayment(rec).then(() => this.render());
					}
				});
			}

			const bottomRow = card.createDiv('sl-rec-bottom');
			const infoSide = bottomRow.createDiv('sl-rec-info');
			infoSide.createSpan({ text: FREQUENCY_LABELS[rec.frequency] ?? rec.frequency, cls: 'sl-rec-freq' });
			if (!isPaid) {
				infoSide.createSpan({ text: nextDue.substring(5), cls: 'sl-rec-due' });
			} else {
				infoSide.createSpan({ text: '✓', cls: 'sl-rec-status-paid' });
			}

			const noteBtn = bottomRow.createEl('button', { text: '📄', cls: 'sl-row-action-btn sl-rec-note', attr: { title: 'Abrir nota' } });
			noteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.plugin.openRecurringNote(rec);
			});

			const editBtn = bottomRow.createEl('button', { text: '✎', cls: 'sl-row-action-btn sl-rec-edit', attr: { title: 'Editar' } });
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				new AddRecurringModal(this.app, this.plugin, rec, () => this.render()).open();
			});
		};

		for (const item of visiblePending) renderCard(item, true);

		if (hiddenCount > 0) {
			const moreBtn = grid.createEl('button', { text: `+${hiddenCount} mas pendientes`, cls: 'sl-rec-more-btn' });
			moreBtn.addEventListener('click', () => {
				moreBtn.remove();
				for (const item of pending.slice(maxVisible)) renderCard(item, true);
			});
		}

		if (paid.length > 0) {
			const paidToggle = section.createDiv('sl-rec-paid-toggle');
			const toggleBtn = paidToggle.createEl('button', {
				text: `${paid.length} pagada${paid.length > 1 ? 's' : ''} este periodo`,
				cls: 'sl-rec-toggle-btn',
			});
			const paidGrid = section.createDiv('sl-recurring-grid sl-rec-paid-grid');
			paidGrid.style.display = 'none';

			toggleBtn.addEventListener('click', () => {
				const isHidden = paidGrid.style.display === 'none';
				paidGrid.style.display = isHidden ? '' : 'none';
				toggleBtn.setText(isHidden ? 'Ocultar pagadas' : `${paid.length} pagada${paid.length > 1 ? 's' : ''} este periodo`);
			});

			// Save reference to grid before appending paid cards into the alternate grid
			const originalGrid = grid;
			for (const item of paid) {
				renderCard(item, false);
				const lastCard = originalGrid.lastChild;
				if (lastCard) paidGrid.appendChild(lastCard);
			}
		}
	}

	private _renderTransactionsTable(parent: HTMLElement, txs: Transaction[]): void {
		const PAGE_SIZE = 20;
		const section = parent.createDiv('sl-main-tx-section');
		const txHeader = section.createDiv('sl-section-header');
		txHeader.createEl('h3', { text: 'Transacciones' });
		txHeader.createSpan({ text: `(${txs.length})`, cls: 'sl-tx-count' });

		// Sort toggle button
		const sortBtn = txHeader.createEl('button', {
			cls: 'sl-icon-btn',
			attr: { title: this.txSortOrder === 'desc' ? 'Más antiguas primero' : 'Más recientes primero' },
		});
		setIcon(sortBtn, this.txSortOrder === 'desc' ? 'arrow-down-narrow-wide' : 'arrow-up-narrow-wide');
		sortBtn.addEventListener('click', () => {
			this.txSortOrder = this.txSortOrder === 'desc' ? 'asc' : 'desc';
			this.txPage = 0;
			this.render();
		});

		if (txs.length === 0) {
			section.createEl('p', { text: 'Sin transacciones para los filtros seleccionados', cls: 'sl-empty-msg' });
			return;
		}

		const settings = this.plugin.settings;
		const dir = this.txSortOrder === 'desc' ? -1 : 1;
		const sorted = [...txs].sort((a, b) => {
			const dateCmp = a.date.localeCompare(b.date) * dir;
			if (dateCmp !== 0) return dateCmp;
			return (a.lineStart - b.lineStart) * dir;
		});
		const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
		if (this.txPage >= totalPages) this.txPage = Math.max(0, totalPages - 1);

		const pageSlice = sorted.slice(this.txPage * PAGE_SIZE, (this.txPage + 1) * PAGE_SIZE);

		const list = section.createDiv('sl-tx-list-main');
		for (const tx of pageSlice) {
			const posPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
			const totalAmt = tx.postings
				.filter(p => (p.amount ?? 0) > 0)
				.reduce((s, p) => s + (p.amount ?? 0), 0);
			const isExpense = posPosting && posPosting.account.startsWith(ACCT.expenses);
			const isLiability = posPosting && posPosting.account.startsWith(ACCT.liabilities);
			const amtColor = (isExpense || isLiability) ? 'sl-negative' : 'sl-positive';

			const item = list.createDiv('sl-tx-item');

			const left = item.createDiv('sl-tx-item-left');
			const topRow = left.createDiv('sl-tx-item-top');
			const dateSpan = topRow.createSpan({ text: tx.date, cls: 'sl-tx-item-date sl-tx-item-date-link', attr: { title: 'Abrir nota diaria' } });
			dateSpan.addEventListener('click', (e) => {
				e.stopPropagation();
				this._openDailyNote(tx.date);
			});
			const payeeSpan = topRow.createSpan({ text: tx.payee, cls: 'sl-tx-item-payee' });
			if (tx.notes) {
				payeeSpan.setAttribute('title', tx.notes);
				topRow.createSpan({ text: 'ⓘ', cls: 'sl-tx-item-note-icon', attr: { title: tx.notes } });
			}

			if (tx.postings.length <= 2) {
				const negPosting = tx.postings.find(p => (p.amount ?? 0) < 0) ?? tx.postings[1];
				const bottomRow = left.createDiv('sl-tx-item-bottom');
				const negAcct = negPosting?.account ?? '';
				const posAcct = posPosting?.account ?? '';
				bottomRow.createSpan({ text: negAcct, cls: `sl-tx-item-account ${acctLabelColor(negAcct)}` });
				bottomRow.createSpan({ text: '→', cls: 'sl-tx-item-arrow' });
				bottomRow.createSpan({ text: posAcct, cls: `sl-tx-item-account ${acctLabelColor(posAcct)}` });
			} else {
				const postingsContainer = left.createDiv('sl-tx-item-postings');
				for (const p of tx.postings) {
					const pRow = postingsContainer.createDiv('sl-tx-posting-row');
					pRow.createSpan({ text: p.account, cls: `sl-tx-posting-account ${acctLabelColor(p.account)}` });
					if (p.amount !== null) {
						const sign = p.amount >= 0 ? '+' : '';
						pRow.createSpan({
							text: sign + fmtAmount(p.amount, settings),
							cls: `sl-tx-posting-amount ${p.amount >= 0 ? 'sl-positive' : 'sl-negative'}`,
						});
					}
				}
			}

			const right = item.createDiv('sl-tx-item-right');
			right.createDiv({ text: fmtAmount(totalAmt, settings), cls: `sl-tx-item-amount ${amtColor}` });

			const actions = right.createDiv('sl-tx-item-actions');
			const editBtn = actions.createEl('button', { text: '✎', cls: 'sl-row-action-btn', attr: { title: 'Editar' } });
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				new EditTransactionModal(
					this.app, this.plugin, tx,
					(oldTx, newData) => { this.plugin.updateTransaction(oldTx, newData).then(() => this.render()); },
					(txToDelete) => { this.plugin.deleteTransaction(txToDelete).then(() => this.render()); }
				).open();
			});
			const delBtn = actions.createEl('button', { text: '×', cls: 'sl-row-action-btn sl-row-del', attr: { title: 'Eliminar' } });
			delBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				new ConfirmDeleteModal(this.app, tx.payee, () => {
					this.plugin.deleteTransaction(tx).then(() => this.render());
				}).open();
			});
		}

		this._renderPagination(section, this.txPage, totalPages, (p) => { this.txPage = p; this.render(); });
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


	private _renderAccountPanel(parent: HTMLElement, balances: Record<string, number>): void {
		const section = parent.createDiv('sl-main-accounts');
		const accHeader = section.createDiv('sl-section-header');
		accHeader.createEl('h3', { text: 'Cuentas' });
		const gearBtn = accHeader.createEl('button', {
			text: this.manageOpen ? '✕' : '⚙',
			cls: 'sl-gear-btn',
			attr: { title: this.manageOpen ? 'Cerrar' : 'Gestionar cuentas' },
		});
		gearBtn.addEventListener('click', () => {
			this.manageOpen = !this.manageOpen;
			this.render();
		});

		if (this.manageOpen) {
			this._renderManagePanel(section);
			return;
		}

		const excl = (this.plugin.settings.excludedFromBalance ?? []) as string[];
		const isExcluded = (acct: string) => excl.some((ex: string) => acct === ex || acct.startsWith(ex + ':'));
		const tree = LedgerParser.computeBalanceTree(balances);
		this._renderAccountTree(section, tree, 0, '', isExcluded);
	}

	private _renderAccountTree(container: HTMLElement, tree: BalanceTree, depth: number, prefix: string, isExcluded: (a: string) => boolean = () => false): void {
		const settings = this.plugin.settings;
		for (const [key, node] of Object.entries(tree)) {
			const fullName = prefix ? `${prefix}:${key}` : key;
			const hasChildren = Object.keys(node._children).length > 0;
			const isCollapsed = this.collapsedAccounts.has(fullName);
			const excluded = isExcluded(fullName);

			const row = container.createDiv(`sl-acct-row${excluded ? ' sl-acct-excluded' : ''}`);
			row.style.paddingLeft = `${depth * 16 + 8}px`;

			if (hasChildren) {
				const chevron = row.createSpan({ cls: 'sl-acct-chevron', text: isCollapsed ? '▶' : '▼' });
				chevron.addEventListener('click', (e) => {
					e.stopPropagation();
					if (this.collapsedAccounts.has(fullName)) {
						this.collapsedAccounts.delete(fullName);
					} else {
						this.collapsedAccounts.add(fullName);
					}
					this.render();
				});
			} else {
				row.createSpan({ cls: 'sl-acct-chevron-placeholder' });
			}

			const nameSpan = row.createSpan({ text: key, cls: 'sl-acct-name sl-acct-clickable' });
			nameSpan.addEventListener('click', () => {
				this.filters.account = fullName;
				this.render();
			});

			row.createSpan({
				text: fmtAmount(node._total, settings),
				cls: `sl-acct-bal ${acctColor(fullName, node._total)}`,
			});

			if (hasChildren && !isCollapsed) {
				this._renderAccountTree(container, node._children, depth + 1, fullName, isExcluded);
			}
		}
	}

	private _renderManagePanel(parent: HTMLElement): void {
		const panel = parent.createDiv('sl-manage-panel');
		const settings = this.plugin.settings;

		const categories: { key: 'expenses' | 'income' | 'assets' | 'liabilities'; label: string; prefix: string }[] = [
			{ key: 'expenses',    label: 'Gastos',    prefix: 'Gastos' },
			{ key: 'income',      label: 'Ingresos',  prefix: 'Ingresos' },
			{ key: 'assets',      label: 'Activos',   prefix: 'Activos' },
			{ key: 'liabilities', label: 'Pasivos',   prefix: 'Pasivos' },
		];

		// Tabs
		const tabs = panel.createDiv('sl-manage-tabs');
		for (const cat of categories) {
			const tab = tabs.createEl('button', { text: cat.label, cls: `sl-manage-tab${this.manageTab === cat.key ? ' sl-manage-tab-active' : ''}` });
			tab.addEventListener('click', () => {
				this.manageTab = cat.key;
				this.render();
			});
		}

		const currentCat = categories.find(c => c.key === this.manageTab)!;
		const accounts = settings.defaultAccounts[this.manageTab];
		const sorted = [...accounts].sort();

		// Account list
		const excluded = settings.excludedFromBalance ?? [];
		const list = panel.createDiv('sl-manage-list');
		for (const acct of sorted) {
			const isExcl = excluded.includes(acct);
			const row = list.createDiv('sl-manage-acct-row');
			const nameSpan = row.createSpan({ text: acct, cls: `sl-manage-acct-name${isExcl ? ' sl-manage-acct-excl' : ''}` });

			const exclBtn = row.createEl('button', {
				text: isExcl ? '⊘' : '◎',
				cls: 'sl-row-action-btn',
				attr: { title: isExcl ? 'Incluir en balance' : 'Excluir del balance' },
			});
			exclBtn.addEventListener('click', () => {
				if (isExcl) {
					settings.excludedFromBalance = excluded.filter(e => e !== acct);
				} else {
					excluded.push(acct);
				}
				this.plugin.saveSettings();
				this.render();
			});

			const editBtn = row.createEl('button', { text: '✎', cls: 'sl-row-action-btn', attr: { title: 'Renombrar' } });
			editBtn.addEventListener('click', () => {
				const input = document.createElement('input');
				input.type = 'text';
				input.value = acct;
				input.className = 'sl-rename-input';
				nameSpan.replaceWith(input);
				input.focus();
				input.select();
				const save = () => {
					const newName = input.value.trim();
					if (newName && newName !== acct) {
						const idx = accounts.indexOf(acct);
						if (idx !== -1) accounts[idx] = newName;
						this.plugin.renameAccount(acct, newName);
					} else {
						this.plugin.saveSettings();
					}
					this.render();
				};
				input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') this.render(); });
				input.addEventListener('blur', save);
			});

			const delBtn = row.createEl('button', { text: '×', cls: 'sl-row-action-btn sl-row-del', attr: { title: 'Eliminar' } });
			delBtn.addEventListener('click', () => {
				settings.defaultAccounts[this.manageTab] = accounts.filter(a => a !== acct);
				this.plugin.saveSettings();
				this.render();
			});
		}

		// Add row
		const addRow = panel.createDiv('sl-manage-add-row');
		const prefixSelect = addRow.createEl('select', { cls: 'sl-manage-prefix-select' });
		for (const cat of categories) {
			const opt = prefixSelect.createEl('option', { value: cat.prefix, text: cat.prefix });
			if (cat.key === this.manageTab) opt.selected = true;
		}
		addRow.createSpan({ text: ':', cls: 'sl-manage-sep' });
		const nameInput = addRow.createEl('input', { type: 'text', placeholder: 'NuevaCuenta', cls: 'sl-manage-name-input' });
		const addBtn = addRow.createEl('button', { text: '+ Agregar', cls: 'sl-quick-btn' });
		addBtn.addEventListener('click', () => {
			const sub = nameInput.value.trim();
			if (!sub) return;
			const full = `${prefixSelect.value}:${sub}`;
			// Add to the category matching the prefix
			const targetCat = categories.find(c => c.prefix === prefixSelect.value);
			if (!targetCat) return;
			const list = settings.defaultAccounts[targetCat.key];
			if (!list.includes(full)) {
				list.push(full);
				this.plugin.saveSettings();
			}
			this.render();
		});
		nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
	}

	private _card(
		parent: HTMLElement,
		title: string,
		bigAmount: number,
		smallAmount: number,
		cls: string,
		bigLabel = 'este mes',
		smallLabel = 'total',
	): void {
		const s = this.plugin.settings;
		const card = parent.createDiv(`sl-card ${cls}`);
		card.createDiv({ text: title, cls: 'sl-card-title' });
		card.createDiv({ text: fmtAmount(bigAmount, s), cls: 'sl-card-amount' });
		card.createDiv({ text: bigLabel, cls: 'sl-card-sublabel' });
		card.createDiv({ cls: 'sl-card-divider' });
		const totalRow = card.createDiv('sl-card-total-row');
		totalRow.createSpan({ text: fmtAmount(smallAmount, s), cls: 'sl-card-total-amount' });
		totalRow.createSpan({ text: smallLabel, cls: 'sl-card-total-label' });
	}

	private async _openDailyNote(date: string): Promise<void> {
		// date is YYYY/MM/DD
		const app = this.app as any;

		// Read config from Daily Notes core plugin or Periodic Notes community plugin
		const corePlugin = app.internalPlugins?.plugins?.['daily-notes']?.instance;
		const periodicPlugin = app.plugins?.plugins?.['periodic-notes'];

		let format = 'YYYY-MM-DD';
		let folder = '';

		if (corePlugin?.options) {
			format = corePlugin.options.format || format;
			folder = corePlugin.options.folder || folder;
		} else if (periodicPlugin?.settings?.daily) {
			format = periodicPlugin.settings.daily.format || format;
			folder = periodicPlugin.settings.daily.folder || folder;
		}

		// moment is globally available in Obsidian
		const m = (window as any).moment(date.replace(/\//g, '-'), 'YYYY-MM-DD');
		const fileName = m.format(format) + '.md';
		const filePath = folder ? `${folder.replace(/\/$/, '')}/${fileName}` : fileName;

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file) {
			await this.app.workspace.openLinkText(filePath, '', false);
		} else {
			new Notice(`No existe nota diaria para ${date}`);
		}
	}

	private _exportCSV(txs: Transaction[]): void {
		const settings = this.plugin.settings;
		const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

		const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
		const rows: string[] = ['Fecha,Descripcion,Cuenta destino,Cuenta origen,Monto,Estado'];

		for (const tx of sorted) {
			const pos = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
			const neg = tx.postings.find(p => (p.amount ?? 0) < 0) ?? tx.postings[1];
			const amt = Math.abs(pos?.amount ?? 0);
			rows.push([
				escape(tx.date),
				escape(tx.payee),
				escape(pos?.account ?? ''),
				escape(neg?.account ?? ''),
				amt.toFixed(settings.decimals),
				escape(tx.status),
			].join(','));
		}

		const csv = rows.join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		new Notice(`CSV exportado: ${sorted.length} transacciones`);
	}

	async onClose(): Promise<void> {}
}
