import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LEDGER_MAIN } from '../constants';
import { PluginSettings, Transaction, BalanceTree, AddTransactionData, RecurringTransaction } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount, todayStr } from '../utils/formatting';
import { isRecurringPaidThisPeriod, getNextDueDate, FREQUENCY_LABELS } from '../utils/recurring';
import { AddTransactionModal } from '../modals/AddTransactionModal';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { ManageAccountsModal } from '../modals/ManageAccountsModal';
import { AddRecurringModal } from '../modals/AddRecurringModal';
import { CreditWizardModal } from '../modals/CreditWizardModal';

interface Filters {
	from: string;
	to: string;
	account: string;
	search: string;
}

interface Plugin {
	settings: PluginSettings;
	transactions: Transaction[];
	loadTransactions(): Promise<Transaction[]>;
	addTransaction(data: AddTransactionData): Promise<void>;
	updateTransaction(oldTx: Transaction, newData: AddTransactionData): Promise<void>;
	deleteTransaction(tx: Transaction): Promise<void>;
	addCreditPayment(rec: RecurringTransaction): Promise<void>;
	renameAccount(oldName: string, newName: string): Promise<void>;
	saveSettings(): Promise<void>;
}

export class LedgerMainView extends ItemView {
	private plugin: Plugin;
	private filters: Filters;
	private showArchived: boolean;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
		this.filters = { from: '', to: '', account: '', search: '' };
		this.showArchived = false;
	}

	getViewType(): string { return VIEW_TYPE_LEDGER_MAIN; }
	getDisplayText(): string { return 'Ledger'; }
	getIcon(): string { return 'bar-chart-2'; }

	async onOpen(): Promise<void> {
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
		const addBtn = titleRow.createEl('button', { text: '+ Nueva transaccion', cls: 'mod-cta sl-main-add-btn' });
		addBtn.addEventListener('click', () => {
			new AddTransactionModal(this.app, this.plugin, (data) => {
				this.plugin.addTransaction(data).then(() => this.render());
			}).open();
		});

		this._renderFilters(header, allTxs);

		// Summary cards
		const balances = LedgerParser.computeBalances(txs);
		const totalIncome = Object.entries(balances).filter(([k]) => k.startsWith('Ingresos')).reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalExpenses = Object.entries(balances).filter(([k]) => k.startsWith('Gastos')).reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalAssets = Object.entries(balances).filter(([k]) => k.startsWith('Activos')).reduce((s, [, v]) => s + v, 0);
		const totalLiabilities = Object.entries(balances).filter(([k]) => k.startsWith('Pasivos')).reduce((s, [, v]) => s + Math.abs(v), 0);

		const cards = container.createDiv('sl-main-cards');
		this._card(cards, 'Ingresos', totalIncome, 'sl-card-income');
		this._card(cards, 'Gastos', totalExpenses, 'sl-card-expense');
		this._card(cards, 'Balance', totalAssets, 'sl-card-balance');
		this._card(cards, 'Deudas', totalLiabilities, 'sl-card-liability');

		// Two-column layout
		const content = container.createDiv('sl-main-content');
		const leftCol = content.createDiv('sl-main-left');
		const rightCol = content.createDiv('sl-main-right');

		this._renderChart(leftCol, allTxs, txs);
		this._renderTransactionsTable(leftCol, txs);
		this._renderAccountPanel(rightCol, balances);
		this._renderRecurring(rightCol);
	}

	private _renderFilters(parent: HTMLElement, allTxs: Transaction[]): void {
		const bar = parent.createDiv('sl-filter-bar');

		const dateGroup = bar.createDiv('sl-filter-group');
		dateGroup.createEl('label', { text: 'Desde' });
		const fromInput = dateGroup.createEl('input', { type: 'date', cls: 'sl-filter-input' });
		fromInput.value = this.filters.from ? this.filters.from.replace(/\//g, '-') : '';
		fromInput.addEventListener('change', (e) => {
			this.filters.from = (e.target as HTMLInputElement).value.replace(/-/g, '/');
			this.render();
		});

		const dateGroup2 = bar.createDiv('sl-filter-group');
		dateGroup2.createEl('label', { text: 'Hasta' });
		const toInput = dateGroup2.createEl('input', { type: 'date', cls: 'sl-filter-input' });
		toInput.value = this.filters.to ? this.filters.to.replace(/\//g, '-') : '';
		toInput.addEventListener('change', (e) => {
			this.filters.to = (e.target as HTMLInputElement).value.replace(/-/g, '/');
			this.render();
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
			this.render();
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
				this.render();
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
			btn.addEventListener('click', () => { q.fn(); this.render(); });
		}
	}

	private _renderChart(parent: HTMLElement, allTxs: Transaction[], filteredTxs: Transaction[]): void {
		const section = parent.createDiv('sl-chart-section');
		section.createEl('h3', { text: 'Flujo de caja' });

		if (filteredTxs.length === 0) {
			section.createEl('p', { text: 'Sin datos para mostrar', cls: 'sl-empty-msg' });
			return;
		}

		const settings = this.plugin.settings;
		const sorted = [...filteredTxs].sort((a, b) => a.date.localeCompare(b.date));
		const dailyData: Record<string, { income: number; expenses: number }> = {};
		for (const tx of sorted) {
			if (!dailyData[tx.date]) dailyData[tx.date] = { income: 0, expenses: 0 };
			const day = dailyData[tx.date]!;
			for (const p of tx.postings) {
				if (p.account.startsWith('Ingresos') && p.amount !== null) {
					day.income += Math.abs(p.amount);
				} else if (p.account.startsWith('Gastos') && p.amount !== null) {
					day.expenses += Math.abs(p.amount);
				}
			}
		}

		const dates = Object.keys(dailyData).sort();
		if (dates.length === 0) return;

		const points: { date: string; net: number; income: number; expenses: number }[] = [];
		let cumulative = 0;
		for (const d of dates) {
			const day = dailyData[d]!;
			cumulative += day.income - day.expenses;
			points.push({ date: d, net: cumulative, income: day.income, expenses: day.expenses });
		}

		const chartW = 700; const chartH = 200;
		const padL = 60; const padR = 20; const padT = 20; const padB = 40;
		const plotW = chartW - padL - padR;
		const plotH = chartH - padT - padB;

		const nets = points.map(p => p.net);
		const minVal = Math.min(0, ...nets);
		const maxVal = Math.max(0, ...nets);
		const range = maxVal - minVal || 1;

		const xScale = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
		const yScale = (v: number) => padT + plotH - ((v - minVal) / range) * plotH;

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', `0 0 ${chartW} ${chartH}`);
		svg.setAttribute('class', 'sl-chart-svg');

		const gridLines = 4;
		for (let i = 0; i <= gridLines; i++) {
			const y = padT + (i / gridLines) * plotH;
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', String(padL)); line.setAttribute('x2', String(chartW - padR));
			line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
			line.setAttribute('class', 'sl-chart-grid');
			svg.appendChild(line);
			const val = maxVal - (i / gridLines) * range;
			const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			label.setAttribute('x', String(padL - 8)); label.setAttribute('y', String(y + 4));
			label.setAttribute('class', 'sl-chart-label');
			label.textContent = this._shortAmount(val);
			svg.appendChild(label);
		}

		if (minVal < 0) {
			const zeroY = yScale(0);
			const zLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			zLine.setAttribute('x1', String(padL)); zLine.setAttribute('x2', String(chartW - padR));
			zLine.setAttribute('y1', String(zeroY)); zLine.setAttribute('y2', String(zeroY));
			zLine.setAttribute('class', 'sl-chart-zero');
			svg.appendChild(zLine);
		}

		const barW = Math.max(2, plotW / points.length * 0.35);
		for (let i = 0; i < points.length; i++) {
			const p = points[i]!;
			if (p.income > 0) {
				const barH = (p.income / range) * plotH;
				const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				rect.setAttribute('x', String(xScale(i) - barW));
				rect.setAttribute('y', String(yScale(0) - barH));
				rect.setAttribute('width', String(barW));
				rect.setAttribute('height', String(barH));
				rect.setAttribute('class', 'sl-chart-bar-income');
				svg.appendChild(rect);
			}
			if (p.expenses > 0) {
				const barH = (p.expenses / range) * plotH;
				const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				rect.setAttribute('x', String(xScale(i)));
				rect.setAttribute('y', String(yScale(0) - barH));
				rect.setAttribute('width', String(barW));
				rect.setAttribute('height', String(barH));
				rect.setAttribute('class', 'sl-chart-bar-expense');
				svg.appendChild(rect);
			}
		}

		if (points.length > 1) {
			const pathParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.net)}`);
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', pathParts.join(' '));
			path.setAttribute('class', 'sl-chart-line');
			svg.appendChild(path);
		}

		for (let i = 0; i < points.length; i++) {
			const p = points[i]!;
			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', String(xScale(i)));
			circle.setAttribute('cy', String(yScale(p.net)));
			circle.setAttribute('r', '4');
			circle.setAttribute('class', 'sl-chart-dot');
			const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
			title.textContent = `${p.date}\nIngresos: ${fmtAmount(p.income, settings)}\nGastos: ${fmtAmount(p.expenses, settings)}\nNeto acum: ${fmtAmount(p.net, settings)}`;
			circle.appendChild(title);
			svg.appendChild(circle);
		}

		const labelIndices = points.length <= 3
			? points.map((_, i) => i)
			: [0, Math.floor(points.length / 2), points.length - 1];
		for (const i of labelIndices) {
			const p = points[i];
			if (!p) continue;
			const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			label.setAttribute('x', String(xScale(i)));
			label.setAttribute('y', String(chartH - 5));
			label.setAttribute('class', 'sl-chart-date-label');
			label.textContent = p.date.substring(5);
			svg.appendChild(label);
		}

		const legend = section.createDiv('sl-chart-legend');
		const legInc = legend.createSpan({ cls: 'sl-legend-item' });
		legInc.createSpan({ cls: 'sl-legend-swatch sl-legend-income' });
		legInc.createSpan({ text: ' Ingresos' });
		const legExp = legend.createSpan({ cls: 'sl-legend-item' });
		legExp.createSpan({ cls: 'sl-legend-swatch sl-legend-expense' });
		legExp.createSpan({ text: ' Gastos' });
		const legNet = legend.createSpan({ cls: 'sl-legend-item' });
		legNet.createSpan({ cls: 'sl-legend-swatch sl-legend-net' });
		legNet.createSpan({ text: ' Neto acumulado' });

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
			const isExpense = rec.toAccount.startsWith('Gastos') || rec.toAccount.startsWith('Pasivos');

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
						this.plugin.addTransaction({
							date: todayStr(), payee: rec.payee, amount: rec.amount,
							toAccount: rec.toAccount, fromAccount: rec.fromAccount, status: rec.status ?? '*',
						}).then(() => this.render());
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
		const section = parent.createDiv('sl-main-tx-section');
		const txHeader = section.createDiv('sl-section-header');
		txHeader.createEl('h3', { text: 'Transacciones' });
		txHeader.createSpan({ text: `(${txs.length})`, cls: 'sl-tx-count' });

		if (txs.length === 0) {
			section.createEl('p', { text: 'Sin transacciones para los filtros seleccionados', cls: 'sl-empty-msg' });
			return;
		}

		const settings = this.plugin.settings;
		const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));

		const table = section.createEl('table', { cls: 'sl-table sl-main-table' });
		const thead = table.createEl('thead');
		const hr = thead.createEl('tr');
		hr.createEl('th', { text: 'Fecha' });
		hr.createEl('th', { text: 'Descripcion' });
		hr.createEl('th', { text: 'Destino' });
		hr.createEl('th', { text: 'Origen' });
		hr.createEl('th', { text: 'Monto', cls: 'sl-th-right' });
		hr.createEl('th', { text: '', cls: 'sl-th-actions' });

		const tbody = table.createEl('tbody');
		const pageSize = 20;
		let showing = pageSize;

		const renderRows = (limit: number) => {
			tbody.empty();
			const visible = sorted.slice(0, limit);
			for (const tx of visible) {
				const tr = tbody.createEl('tr', { cls: 'sl-main-tx-row' });
				tr.createEl('td', { text: tx.date, cls: 'sl-td-date' });
				tr.createEl('td', { text: tx.payee, cls: 'sl-td-payee' });

				const posPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
				const negPosting = tx.postings.find(p => (p.amount ?? 0) < 0) ?? tx.postings[1];
				tr.createEl('td', { text: posPosting?.account ?? '', cls: 'sl-td-account' });
				tr.createEl('td', { text: negPosting?.account ?? '', cls: 'sl-td-account' });

				const amt = posPosting?.amount ?? 0;
				const isExpense = posPosting && posPosting.account.startsWith('Gastos');
				const isLiability = posPosting && posPosting.account.startsWith('Pasivos');
				const amtColor = (isExpense || isLiability) ? 'sl-negative' : 'sl-positive';
				tr.createEl('td', {
					text: fmtAmount(Math.abs(amt), settings),
					cls: `sl-td-right ${amtColor}`,
				});

				const actTd = tr.createEl('td', { cls: 'sl-td-actions' });
				const editBtn = actTd.createEl('button', { text: '✎', cls: 'sl-row-action-btn', attr: { title: 'Editar' } });
				editBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					new EditTransactionModal(
						this.app, this.plugin, tx,
						(oldTx, newData) => { this.plugin.updateTransaction(oldTx, newData).then(() => this.render()); },
						(txToDelete) => { this.plugin.deleteTransaction(txToDelete).then(() => this.render()); }
					).open();
				});
				const delBtn = actTd.createEl('button', { text: '×', cls: 'sl-row-action-btn sl-row-del', attr: { title: 'Eliminar' } });
				delBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					new ConfirmDeleteModal(this.app, tx.payee, () => {
						this.plugin.deleteTransaction(tx).then(() => this.render());
					}).open();
				});
			}
		};
		renderRows(showing);

		if (sorted.length > pageSize) {
			const moreBtn = section.createEl('button', { text: `Mostrar mas (${sorted.length - pageSize} restantes)`, cls: 'sl-show-all-btn' });
			moreBtn.addEventListener('click', () => {
				showing = sorted.length;
				renderRows(showing);
				moreBtn.remove();
			});
		}
	}

	private _renderAccountPanel(parent: HTMLElement, balances: Record<string, number>): void {
		const section = parent.createDiv('sl-main-accounts');
		const accHeader = section.createDiv('sl-section-header');
		accHeader.createEl('h3', { text: 'Cuentas' });
		const gearBtn = accHeader.createEl('button', { text: '⚙', cls: 'sl-gear-btn', attr: { title: 'Gestionar cuentas' } });
		gearBtn.addEventListener('click', () => {
			new ManageAccountsModal(this.app, this.plugin).open();
		});

		const settings = this.plugin.settings;
		const archived = settings.archivedAccounts ?? [];
		const tree = LedgerParser.computeBalanceTree(balances);

		const allAccounts = new Set<string>();
		for (const cat of Object.values(settings.defaultAccounts)) {
			for (const a of cat) allAccounts.add(a);
		}
		for (const acct of Object.keys(balances)) allAccounts.add(acct);

		const activeSection = section.createDiv('sl-acct-group');
		activeSection.createEl('h4', { text: 'Activas' });
		this._renderAccountTree(activeSection, tree, 0, '', archived, false);

		const archivedAccts = archived.filter(a => allAccounts.has(a) || balances[a] !== undefined);
		if (archivedAccts.length > 0 || this.showArchived) {
			const archSection = section.createDiv('sl-acct-group');
			const archHeader = archSection.createDiv('sl-section-header');
			archHeader.createEl('h4', { text: `Archivadas (${archivedAccts.length})` });
			const toggleBtn = archHeader.createEl('button', {
				text: this.showArchived ? 'Ocultar' : 'Mostrar',
				cls: 'sl-quick-btn',
			});
			toggleBtn.addEventListener('click', () => {
				this.showArchived = !this.showArchived;
				this.render();
			});

			if (this.showArchived) {
				for (const acct of archivedAccts.sort()) {
					const row = archSection.createDiv('sl-acct-row sl-acct-archived');
					row.createSpan({ text: acct, cls: 'sl-acct-name' });
					const bal = balances[acct] ?? 0;
					row.createSpan({
						text: fmtAmount(bal, settings),
						cls: `sl-acct-bal ${bal >= 0 ? 'sl-positive' : 'sl-negative'}`,
					});
					const unarchBtn = row.createEl('button', { text: 'Restaurar', cls: 'sl-quick-btn', attr: { title: 'Desarchivar' } });
					unarchBtn.addEventListener('click', () => {
						this.plugin.settings.archivedAccounts = archived.filter(x => x !== acct);
						this.plugin.saveSettings();
						this.render();
					});
				}
			}
		}
	}

	private _renderAccountTree(
		container: HTMLElement,
		tree: BalanceTree,
		depth: number,
		prefix: string,
		archived: string[],
		isArchived: boolean
	): void {
		const settings = this.plugin.settings;
		for (const [key, node] of Object.entries(tree)) {
			const fullName = prefix ? `${prefix}:${key}` : key;
			if (archived.includes(fullName) && !isArchived) continue;

			const row = container.createDiv('sl-acct-row');
			row.style.paddingLeft = `${depth * 16 + 8}px`;
			const nameSpan = row.createSpan({ text: key, cls: 'sl-acct-name' });
			row.createSpan({
				text: fmtAmount(node._total, settings),
				cls: `sl-acct-bal ${node._total >= 0 ? 'sl-positive' : 'sl-negative'}`,
			});

			const archBtn = row.createEl('button', { text: '📦', cls: 'sl-archive-btn', attr: { title: 'Archivar cuenta' } });
			archBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (!this.plugin.settings.archivedAccounts.includes(fullName)) {
					this.plugin.settings.archivedAccounts.push(fullName);
					this.plugin.saveSettings();
					this.render();
				}
			});

			nameSpan.addClass('sl-acct-clickable');
			nameSpan.addEventListener('click', () => {
				this.filters.account = fullName;
				this.render();
			});

			const hasChildren = Object.keys(node._children).length > 0;
			if (hasChildren) {
				this._renderAccountTree(container, node._children, depth + 1, fullName, archived, isArchived);
			}
		}
	}

	private _card(parent: HTMLElement, title: string, amount: number, cls: string): void {
		const card = parent.createDiv(`sl-card ${cls}`);
		card.createDiv({ text: title, cls: 'sl-card-title' });
		card.createDiv({ text: fmtAmount(amount, this.plugin.settings), cls: 'sl-card-amount' });
	}

	async onClose(): Promise<void> {}
}
