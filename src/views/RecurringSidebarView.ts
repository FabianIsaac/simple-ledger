import { ItemView, WorkspaceLeaf } from 'obsidian';
import { t } from '../i18n';
import { VIEW_TYPE_RECURRING, ACCT } from '../constants';
import { PluginSettings, Transaction, RecurringTransaction, Credit, AddTransactionData, ISimpleLedgerPlugin } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount, todayStr } from '../utils/formatting';
import { isRecurringPaidThisPeriod, getNextDueDate, FREQUENCY_LABELS } from '../utils/recurring';
import { AddRecurringModal } from '../modals/AddRecurringModal';
import { CreditWizardModal } from '../modals/CreditWizardModal';

type Plugin = ISimpleLedgerPlugin;

export class RecurringSidebarView extends ItemView {
	private plugin: Plugin;
	private filter: string;
	private sortBy: string;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
		this.filter = 'all';
		this.sortBy = 'due';
	}

	getViewType(): string { return VIEW_TYPE_RECURRING; }
	getDisplayText(): string { return t('view_rec_title'); }
	getIcon(): string { return 'repeat'; }

	async onOpen(): Promise<void> {
		await this.plugin.loadTransactions();
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('sl-rec-sidebar');

		const settings = this.plugin.settings;
		const recs = settings.recurringTransactions ?? [];
		const credits = settings.credits ?? [];
		const txs = this.plugin.transactions ?? [];

		// Header
		const header = container.createDiv('sl-rec-sb-header');
		header.createEl('h3', { text: t('view_rec_title') });
		const headerBtns = header.createDiv('sl-header-btns');
		const addBtn = headerBtns.createEl('button', { text: t('view_rec_btn_new'), cls: 'sl-header-btn mod-cta' });
		addBtn.addEventListener('click', () => {
			new AddRecurringModal(this.app, this.plugin, null, () => this.render()).open();
		});
		const creditBtn = headerBtns.createEl('button', { text: '🏦', cls: 'sl-header-btn', attr: { title: t('view_rec_btn_new_credit') } });
		creditBtn.addEventListener('click', () => {
			new CreditWizardModal(this.app, this.plugin, null, () => this.render()).open();
		});
		const refreshBtn = headerBtns.createEl('button', { text: '↻', cls: 'sl-header-btn', attr: { title: t('common_reload') } });
		refreshBtn.addEventListener('click', () => {
			this.plugin.loadTransactions().then(() => this.render());
		});

		// Summary cards
		const withStatus = recs.map(rec => {
			const isPaid = isRecurringPaidThisPeriod(rec, txs);
			return { rec, isPaid, nextDue: getNextDueDate(rec, txs) };
		});
		const pendingCount = withStatus.filter(r => !r.isPaid).length;
		const paidCount = withStatus.filter(r => r.isPaid).length;
		const totalMonthly = recs
			.filter(r => r.toAccount.startsWith(ACCT.expenses) || r.toAccount.startsWith(ACCT.liabilities))
			.reduce((s, r) => s + (r.frequency === 'monthly' ? r.amount : r.frequency === 'weekly' ? r.amount * 4 : r.amount / 12), 0);
		const totalIncomeMonthly = recs
			.filter(r => r.toAccount.startsWith(ACCT.assets) && r.fromAccount.startsWith(ACCT.income))
			.reduce((s, r) => s + (r.frequency === 'monthly' ? r.amount : r.frequency === 'weekly' ? r.amount * 4 : r.amount / 12), 0);

		const summaryCards = container.createDiv('sl-rec-sb-summary');
		this._miniCard(summaryCards, t('view_rec_mini_pending'), String(pendingCount), 'sl-rec-sb-warn');
		this._miniCard(summaryCards, t('view_rec_mini_paid'), String(paidCount), 'sl-rec-sb-ok');
		this._miniCard(summaryCards, t('view_rec_mini_expenses_month'), fmtAmount(totalMonthly, settings), 'sl-rec-sb-expense');
		this._miniCard(summaryCards, t('view_rec_mini_income_month'), fmtAmount(totalIncomeMonthly, settings), 'sl-rec-sb-income');

		// Filter tabs
		const tabs = container.createDiv('sl-rec-sb-tabs');
		const tabDefs = [
			{ key: 'all', label: t('view_rec_tab_all', { n: recs.length }) },
			{ key: 'pending', label: t('view_rec_tab_pending', { n: pendingCount }) },
			{ key: 'paid', label: t('view_rec_tab_paid', { n: paidCount }) },
			{ key: 'credits', label: t('view_rec_tab_credits', { n: credits.length }) },
		];
		for (const t of tabDefs) {
			const tab = tabs.createEl('button', {
				text: t.label,
				cls: `sl-rec-sb-tab ${this.filter === t.key ? 'sl-rec-sb-tab-active' : ''}`,
			});
			tab.addEventListener('click', () => { this.filter = t.key; this.render(); });
		}

		// Sort
		const sortRow = container.createDiv('sl-rec-sb-sort');
		sortRow.createSpan({ text: t('view_rec_sort_label'), cls: 'sl-rec-sb-sort-label' });
		const sortOpts = [
			{ key: 'due', label: t('view_rec_sort_due') },
			{ key: 'name', label: t('view_rec_sort_name') },
			{ key: 'amount', label: t('view_rec_sort_amount') },
		];
		for (const s of sortOpts) {
			const btn = sortRow.createEl('button', {
				text: s.label,
				cls: `sl-rec-sb-sort-btn ${this.sortBy === s.key ? 'sl-rec-sb-sort-active' : ''}`,
			});
			btn.addEventListener('click', () => { this.sortBy = s.key; this.render(); });
		}

		// Content
		if (this.filter === 'credits') {
			this._renderCredits(container, credits, txs);
		} else {
			this._renderRecurringList(container, withStatus);
		}
	}

	private _renderRecurringList(container: HTMLElement, withStatus: { rec: RecurringTransaction; isPaid: boolean; nextDue: string }[]): void {
		let items = withStatus;
		if (this.filter === 'pending') items = items.filter(r => !r.isPaid);
		if (this.filter === 'paid') items = items.filter(r => r.isPaid);

		if (this.sortBy === 'due') items.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
		if (this.sortBy === 'name') items.sort((a, b) => a.rec.payee.localeCompare(b.rec.payee));
		if (this.sortBy === 'amount') items.sort((a, b) => b.rec.amount - a.rec.amount);

		const list = container.createDiv('sl-rec-sb-list');

		if (items.length === 0) {
			list.createEl('p', { text: t('view_rec_empty'), cls: 'sl-empty-msg sl-empty-small' });
			return;
		}

		const settings = this.plugin.settings;
		for (const item of items) {
			const { rec, isPaid, nextDue } = item;
			const isExpense = rec.toAccount.startsWith(ACCT.expenses) || rec.toAccount.startsWith(ACCT.liabilities);
			const isCredit = rec._isCreditPayment;

			const card = list.createDiv(`sl-rec-sb-card ${isPaid ? 'sl-rec-paid' : 'sl-rec-pending'}`);

			const row1 = card.createDiv('sl-rec-sb-row1');
			const nameDiv = row1.createDiv('sl-rec-sb-name-col');
			nameDiv.createSpan({ text: rec.payee, cls: 'sl-rec-sb-name' });
			if (isCredit) {
				nameDiv.createSpan({ text: t('view_rec_badge_credit'), cls: 'sl-rec-sb-badge sl-rec-sb-badge-credit' });
			}
			row1.createSpan({
				text: fmtAmount(rec.amount, settings),
				cls: `sl-rec-sb-amount ${isExpense ? 'sl-negative' : 'sl-positive'}`,
			});

			const row2 = card.createDiv('sl-rec-sb-row2');
			row2.createSpan({ text: rec.fromAccount, cls: 'sl-rec-sb-acct' });
			row2.createSpan({ text: '→', cls: 'sl-rec-sb-arrow' });
			row2.createSpan({ text: rec.toAccount, cls: 'sl-rec-sb-acct' });

			const row3 = card.createDiv('sl-rec-sb-row3');
			const metaDiv = row3.createDiv('sl-rec-sb-meta');
			metaDiv.createSpan({ text: FREQUENCY_LABELS[rec.frequency] ?? rec.frequency, cls: 'sl-rec-freq' });
			if (isPaid) {
				metaDiv.createSpan({ text: t('view_rec_paid_badge'), cls: 'sl-rec-sb-paid-badge' });
			} else {
				const today = todayStr();
				const isOverdue = nextDue < today;
				metaDiv.createSpan({
					text: (isOverdue ? t('view_rec_overdue') : '') + nextDue.substring(5),
					cls: 'sl-rec-due' + (isOverdue ? ' sl-rec-overdue' : ''),
				});
			}

			if (isCredit && rec._principalPortion && rec._interestPortion) {
				const breakdown = card.createDiv('sl-rec-sb-breakdown');
				breakdown.createSpan({ text: `Capital: ${fmtAmount(rec._principalPortion, settings)}`, cls: 'sl-rec-sb-detail' });
				breakdown.createSpan({ text: `Interes: ${fmtAmount(rec._interestPortion, settings)}`, cls: 'sl-rec-sb-detail sl-negative' });
			}

			const actions = row3.createDiv('sl-rec-sb-actions');
			if (!isPaid) {
				const payBtn = actions.createEl('button', { cls: 'sl-rec-pay-btn', attr: { title: t('common_register_payment') } });
				payBtn.innerHTML = '&#10003;';
				payBtn.addEventListener('click', () => {
					if (rec._isCreditPayment) {
						this.plugin.addCreditPayment(rec).then(() => this.render());
					} else {
						this.plugin.registerRecurringPayment(rec).then(() => this.render());
					}
				});
			}
			const noteBtn = actions.createEl('button', { text: '📄', cls: 'sl-row-action-btn', attr: { title: t('common_open_note') } });
			noteBtn.addEventListener('click', () => {
				this.plugin.openRecurringNote(rec);
			});
			const editBtn = actions.createEl('button', { text: '✎', cls: 'sl-row-action-btn', attr: { title: t('common_edit') } });
			editBtn.addEventListener('click', () => {
				if (isCredit) {
					const credit = this.plugin.settings.credits.find(c => c.id === rec._creditId);
					if (credit) {
						new CreditWizardModal(this.app, this.plugin, credit, () => this.render()).open();
					}
				} else {
					new AddRecurringModal(this.app, this.plugin, rec, () => this.render()).open();
				}
			});
		}
	}

	private _renderCredits(container: HTMLElement, credits: Credit[], txs: Transaction[]): void {
		const list = container.createDiv('sl-rec-sb-list');
		const settings = this.plugin.settings;

		if (credits.length === 0) {
			list.createEl('p', { text: 'Sin creditos. Usa 🏦 para crear uno.', cls: 'sl-empty-msg sl-empty-small' });
			return;
		}

		for (const credit of credits) {
			const card = list.createDiv('sl-rec-sb-card sl-credit-card');

			const row1 = card.createDiv('sl-rec-sb-row1');
			row1.createSpan({ text: credit.name, cls: 'sl-rec-sb-name' });
			row1.createSpan({ text: fmtAmount(credit.totalDebt, settings), cls: 'sl-rec-sb-amount sl-negative' });

			const debtAccount = `Pasivos:${credit.name.replace(/\s+/g, '')}`;
			const balances = LedgerParser.computeBalances(txs);
			const currentDebt = Math.abs(balances[debtAccount] ?? 0);
			const principal = credit.principal;
			const paidAmount = principal - currentDebt;
			const totalDebt = credit.totalDebt;
			const progress = totalDebt > 0 ? Math.min(1, Math.max(0, paidAmount / totalDebt)) : 0;

			const progressSection = card.createDiv('sl-credit-progress');
			const progressBar = progressSection.createDiv('sl-credit-bar');
			const progressFill = progressBar.createDiv('sl-credit-bar-fill');
			progressFill.style.width = `${(progress * 100).toFixed(1)}%`;
			const progressLabel = progressSection.createDiv('sl-credit-progress-label');
			const remaining = totalDebt - paidAmount;
			progressLabel.createSpan({ text: `${fmtAmount(paidAmount, settings)} pagado`, cls: 'sl-positive' });
			progressLabel.createSpan({ text: `${(progress * 100).toFixed(0)}%`, cls: 'sl-credit-pct' });
			progressLabel.createSpan({ text: `${fmtAmount(remaining, settings)} restante`, cls: 'sl-negative' });

			const details = card.createDiv('sl-credit-details');
			const detailRows: [string, string][] = [
				['Recibido', fmtAmount(credit.principal, settings)],
				['Intereses', fmtAmount(credit.interestTotal, settings)],
				['Cuota mensual', fmtAmount(credit.monthlyPayment, settings)],
				['Plazo', `${credit.months} meses`],
				['Dia de pago', `${credit.dayOfMonth ?? 5} de cada mes`],
			];
			for (const [label, val] of detailRows) {
				const row = details.createDiv('sl-credit-detail-row');
				row.createSpan({ text: label });
				row.createSpan({ text: val, cls: 'sl-credit-detail-val' });
			}

			const actRow = card.createDiv('sl-credit-actions');
			const editBtn = actRow.createEl('button', { text: 'Editar', cls: 'sl-quick-btn' });
			editBtn.addEventListener('click', () => {
				new CreditWizardModal(this.app, this.plugin, credit, () => this.render()).open();
			});

			const recForCredit = this.plugin.settings.recurringTransactions.find(r => r._creditId === credit.id);
			if (recForCredit) {
				const isPaid = isRecurringPaidThisPeriod(recForCredit, txs);
				if (!isPaid) {
					const payBtn = actRow.createEl('button', { text: 'Pagar cuota', cls: 'sl-rec-pay-btn-text' });
					payBtn.addEventListener('click', () => {
						this.plugin.addCreditPayment(recForCredit).then(() => this.render());
					});
				} else {
					actRow.createSpan({ text: '✓ Cuota pagada', cls: 'sl-rec-sb-paid-badge' });
				}
				const noteBtn = actRow.createEl('button', { text: '📄', cls: 'sl-quick-btn', attr: { title: 'Abrir nota' } });
				noteBtn.addEventListener('click', () => {
					this.plugin.openRecurringNote(recForCredit);
				});
			}
		}
	}

	private _miniCard(parent: HTMLElement, label: string, value: string, cls: string): void {
		const card = parent.createDiv(`sl-rec-sb-mini ${cls}`);
		card.createDiv({ text: value, cls: 'sl-rec-sb-mini-val' });
		card.createDiv({ text: label, cls: 'sl-rec-sb-mini-label' });
	}

	async onClose(): Promise<void> {}
}
