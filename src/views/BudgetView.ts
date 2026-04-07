import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { ISimpleLedgerPlugin, Budget, Transaction } from '../types';
import { VIEW_TYPE_BUDGET } from '../constants';
import { t } from '../i18n';
import { fmtAmount } from '../utils/formatting';

type Plugin = ISimpleLedgerPlugin & { transactions: Transaction[] };

export class BudgetView extends ItemView {
	private plugin: Plugin;
	private expandedId: string | null = null; // which card is in edit mode
	private showAddForm = false;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return VIEW_TYPE_BUDGET; }
	getDisplayText(): string { return t('view_budget_title'); }
	getIcon(): string { return 'target'; }

	async onOpen(): Promise<void> {
		await this.plugin.loadTransactions();
		this.render();
	}

	render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('sl-budget-view');

		// ── Header ─────────────────────────────────────────────────────────────
		const header = root.createDiv({ cls: 'sl-budget-header' });
		header.createEl('h2', { text: t('view_budget_title') });
		const addBtn = header.createEl('button', {
			text: this.showAddForm ? '✕' : t('view_budget_btn_add'),
			cls: `sl-budget-add-btn ${this.showAddForm ? 'sl-btn-secondary' : 'sl-btn-primary'}`,
		});
		addBtn.addEventListener('click', () => {
			this.showAddForm = !this.showAddForm;
			this.expandedId = null;
			this.render();
		});

		// ── Inline add form ─────────────────────────────────────────────────────
		if (this.showAddForm) {
			this._renderForm(root, null);
		}

		const budgets = this.plugin.settings.budgets ?? [];

		if (budgets.length === 0 && !this.showAddForm) {
			root.createEl('p', { text: t('view_budget_empty'), cls: 'sl-budget-empty' });
			return;
		}

		// ── Monthly section ─────────────────────────────────────────────────────
		const monthly = budgets.filter(b => b.period === 'monthly');
		if (monthly.length > 0) {
			root.createEl('h3', { text: t('view_budget_section_monthly'), cls: 'sl-budget-section-title' });
			const list = root.createDiv({ cls: 'sl-budget-list' });
			for (const b of monthly) this._renderCard(list, b);
		}

		// ── Yearly section ──────────────────────────────────────────────────────
		const yearly = budgets.filter(b => b.period === 'yearly');
		if (yearly.length > 0) {
			root.createEl('h3', { text: t('view_budget_section_yearly'), cls: 'sl-budget-section-title' });
			const list = root.createDiv({ cls: 'sl-budget-list' });
			for (const b of yearly) this._renderCard(list, b);
		}
	}

	// ── Budget card (with optional inline edit) ──────────────────────────────

	private _renderCard(container: HTMLElement, budget: Budget): void {
		const spent = this._calcSpent(budget);
		const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
		const over = spent > budget.amount;
		const warn = !over && pct >= 75;
		const isExpanded = this.expandedId === budget.id;

		const card = container.createDiv({
			cls: `sl-budget-card ${isExpanded ? 'sl-budget-card-expanded' : ''}`,
		});

		// ─ Summary row (always visible) ──────────────────────────────────────
		const summary = card.createDiv({ cls: 'sl-budget-summary' });
		summary.addEventListener('click', () => {
			this.expandedId = isExpanded ? null : budget.id;
			this.showAddForm = false;
			this.render();
		});

		const top = summary.createDiv({ cls: 'sl-budget-card-top' });
		top.createEl('span', { text: budget.account, cls: 'sl-budget-account' });

		const amtInfo = top.createDiv({ cls: 'sl-budget-amounts' });
		amtInfo.createEl('span', {
			text: fmtAmount(spent, this.plugin.settings),
			cls: `sl-budget-spent ${over ? 'sl-budget-over-text' : ''}`,
		});
		amtInfo.createEl('span', { text: ` ${t('view_budget_of')} `, cls: 'sl-budget-of' });
		amtInfo.createEl('span', {
			text: fmtAmount(budget.amount, this.plugin.settings),
			cls: 'sl-budget-limit',
		});

		const track = summary.createDiv({ cls: 'sl-budget-bar-track' });
		const fill = track.createDiv({ cls: 'sl-budget-bar-fill' });
		fill.style.width = `${pct}%`;
		fill.addClass(over ? 'sl-budget-bar-over' : warn ? 'sl-budget-bar-warn' : 'sl-budget-bar-ok');

		const bottom = summary.createDiv({ cls: 'sl-budget-card-bottom' });
		const diff = Math.abs(budget.amount - spent);
		bottom.createEl('span', {
			text: `${fmtAmount(diff, this.plugin.settings)} ${over ? t('view_budget_over') : t('view_budget_remaining')}`,
			cls: `sl-budget-tag ${over ? 'sl-budget-tag-over' : warn ? 'sl-budget-tag-warn' : 'sl-budget-tag-ok'}`,
		});
		const realPct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
		bottom.createEl('span', { text: `${realPct}%`, cls: 'sl-budget-pct' });

		// ─ Inline edit form (expanded only) ──────────────────────────────────
		if (isExpanded) {
			this._renderForm(card, budget);
		}
	}

	// ── Shared form renderer (add / edit) ────────────────────────────────────

	private _renderForm(container: HTMLElement, budget: Budget | null): void {
		const isEdit = budget !== null;
		const form = container.createDiv({ cls: 'sl-budget-form' });

		// Account
		const rowAcct = form.createDiv({ cls: 'sl-form-row' });
		rowAcct.createEl('label', { text: t('modal_budget_lbl_account') });
		const allAccounts = this._getAllAccounts();
		const acctInput = rowAcct.createEl('input', { type: 'text' });
		acctInput.placeholder = t('modal_budget_ph_account');
		acctInput.value = budget?.account ?? '';
		acctInput.setAttribute('list', 'sl-budget-acct-list');
		const dl = rowAcct.createEl('datalist');
		dl.id = 'sl-budget-acct-list';
		for (const a of allAccounts) { const o = dl.createEl('option'); o.value = a; }

		// Amount
		const rowAmt = form.createDiv({ cls: 'sl-form-row' });
		rowAmt.createEl('label', { text: t('modal_budget_lbl_amount') });
		const amtInput = rowAmt.createEl('input', { type: 'number' });
		amtInput.value = budget && budget.amount > 0 ? String(budget.amount) : '';
		amtInput.min = '0';
		amtInput.step = '1';

		// Period
		const rowPeriod = form.createDiv({ cls: 'sl-form-row' });
		rowPeriod.createEl('label', { text: t('modal_budget_lbl_period') });
		const periodSel = rowPeriod.createEl('select');
		const optM = periodSel.createEl('option', { text: t('modal_budget_period_monthly') });
		optM.value = 'monthly';
		const optY = periodSel.createEl('option', { text: t('modal_budget_period_yearly') });
		optY.value = 'yearly';
		periodSel.value = budget?.period ?? 'monthly';

		// Buttons
		const btnRow = form.createDiv({ cls: 'sl-budget-form-btns' });

		if (isEdit) {
			const delBtn = btnRow.createEl('button', {
				text: t('modal_budget_btn_delete'),
				cls: 'sl-btn-danger',
			});
			delBtn.addEventListener('click', async () => {
				this.plugin.settings.budgets = this.plugin.settings.budgets.filter(b => b.id !== budget!.id);
				await this.plugin.saveSettings();
				new Notice(t('notice_budget_deleted'));
				this.expandedId = null;
				this.render();
			});
		}

		const saveBtn = btnRow.createEl('button', {
			text: t('modal_budget_btn_save'),
			cls: 'sl-btn-primary',
		});
		saveBtn.addEventListener('click', async () => {
			const account = acctInput.value.trim();
			const amount = parseFloat(amtInput.value);
			const period = periodSel.value as 'monthly' | 'yearly';

			if (!account || isNaN(amount) || amount <= 0) {
				new Notice(t('notice_budget_invalid'));
				return;
			}

			if (isEdit) {
				const idx = this.plugin.settings.budgets.findIndex(b => b.id === budget!.id);
				if (idx >= 0) {
					this.plugin.settings.budgets[idx] = { ...budget!, account, amount, period };
				}
			} else {
				this.plugin.settings.budgets.push({
					id: Date.now().toString(),
					account,
					amount,
					period,
				});
			}

			await this.plugin.saveSettings();
			new Notice(t('notice_budget_saved'));
			this.showAddForm = false;
			this.expandedId = null;
			this.render();
		});
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	private _calcSpent(budget: Budget): number {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const prefix = budget.period === 'monthly' ? `${year}/${month}` : `${year}`;
		return this.plugin.transactions
			.filter(tx => tx.date.startsWith(prefix))
			.flatMap(tx => tx.postings)
			.filter(p => p.account === budget.account || p.account.startsWith(budget.account + ':'))
			.reduce((sum, p) => sum + (p.amount ?? 0), 0);
	}

	private _getAllAccounts(): string[] {
		const set = new Set<string>();
		for (const list of Object.values(this.plugin.settings.defaultAccounts)) {
			for (const a of list) set.add(a);
		}
		for (const tx of this.plugin.transactions) {
			for (const p of tx.postings) set.add(p.account);
		}
		return [...set].sort();
	}
}
