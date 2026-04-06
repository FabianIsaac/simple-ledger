import { App, Modal, Notice } from 'obsidian';
import { Credit, ISimpleLedgerPlugin } from '../types';
import { t } from '../i18n';
import { generateId } from '../utils/recurring';
import { calculateCreditMonthlyAmounts } from '../utils/creditCalc';
import { todayStr, fmtAmount } from '../utils/formatting';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

type Plugin = ISimpleLedgerPlugin;

export class CreditWizardModal extends Modal {
	private plugin: Plugin;
	private onSave: () => void;
	private isEditing: boolean;
	private credit: Credit;

	constructor(app: App, plugin: Plugin, existingCredit: Credit | null, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
		this.isEditing = !!existingCredit;
		this.credit = existingCredit ? { ...existingCredit } : {
			id: generateId(),
			name: '',
			principal: 0,
			totalDebt: 0,
			interestTotal: 0,
			monthlyPayment: 0,
			months: 12,
			startDate: todayStr(),
			fromAsset: 'Activos:Banco',
			dayOfMonth: 5,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');
		contentEl.createEl('h2', { text: this.isEditing ? t('modal_credit_edit_title') : t('modal_credit_new_title') });

		const sym = this.plugin.settings.currencySymbol;

		// Name
		const nameRow = contentEl.createDiv('sl-form-row');
		nameRow.createEl('label', { text: t('modal_credit_lbl_name') });
		const nameInput = nameRow.createEl('input', { type: 'text', placeholder: t('modal_credit_ph_name') });
		nameInput.value = this.credit.name;
		nameInput.addEventListener('input', (e) => { this.credit.name = (e.target as HTMLInputElement).value; });

		// Principal
		const principalRow = contentEl.createDiv('sl-form-row');
		principalRow.createEl('label', { text: t('modal_credit_lbl_principal', { sym }) });
		principalRow.createEl('small', { text: t('modal_credit_hint_principal'), cls: 'sl-form-hint' });
		const principalInput = principalRow.createEl('input', { type: 'number', attr: { step: '1', min: '0' } });
		principalInput.value = String(this.credit.principal || '');
		principalInput.addEventListener('input', (e) => {
			this.credit.principal = parseFloat((e.target as HTMLInputElement).value) || 0;
			this._recalculate(contentEl);
		});

		// Total debt
		const totalRow = contentEl.createDiv('sl-form-row');
		totalRow.createEl('label', { text: t('modal_credit_lbl_total', { sym }) });
		totalRow.createEl('small', { text: t('modal_credit_hint_total'), cls: 'sl-form-hint' });
		const totalInput = totalRow.createEl('input', { type: 'number', attr: { step: '1', min: '0' } });
		totalInput.value = String(this.credit.totalDebt || '');
		totalInput.addEventListener('input', (e) => {
			this.credit.totalDebt = parseFloat((e.target as HTMLInputElement).value) || 0;
			this._recalculate(contentEl);
		});

		// Months
		const monthsRow = contentEl.createDiv('sl-form-row');
		monthsRow.createEl('label', { text: t('modal_credit_lbl_months') });
		const monthsInput = monthsRow.createEl('input', { type: 'number', attr: { min: '1', max: '360' } });
		monthsInput.value = String(this.credit.months);
		monthsInput.addEventListener('input', (e) => {
			this.credit.months = parseInt((e.target as HTMLInputElement).value) || 12;
			this._recalculate(contentEl);
		});

		// Day of month
		const dayRow = contentEl.createDiv('sl-form-row');
		dayRow.createEl('label', { text: t('modal_credit_lbl_day') });
		const dayInput = dayRow.createEl('input', { type: 'number', attr: { min: '1', max: '31' } });
		dayInput.value = String(this.credit.dayOfMonth ?? 5);
		dayInput.addEventListener('input', (e) => {
			this.credit.dayOfMonth = parseInt((e.target as HTMLInputElement).value) || 5;
		});

		// Start date
		const dateRow = contentEl.createDiv('sl-form-row');
		dateRow.createEl('label', { text: t('modal_credit_lbl_start_date') });
		const dateInput = dateRow.createEl('input', { type: 'date' });
		dateInput.value = this.credit.startDate.replace(/\//g, '-');
		dateInput.addEventListener('change', (e) => {
			this.credit.startDate = (e.target as HTMLInputElement).value.replace(/-/g, '/');
		});

		// Source asset
		const assetRow = contentEl.createDiv('sl-form-row');
		assetRow.createEl('label', { text: t('modal_credit_lbl_pay_account') });
		const assetSelect = assetRow.createEl('select');
		const assets = this.plugin.settings.defaultAccounts.assets ?? [];
		for (const a of assets) {
			const opt = assetSelect.createEl('option', { value: a, text: a });
			if (a === this.credit.fromAsset) opt.selected = true;
		}
		assetSelect.addEventListener('change', (e) => {
			this.credit.fromAsset = (e.target as HTMLSelectElement).value;
		});

		// Summary
		const summaryDiv = contentEl.createDiv('sl-credit-summary');
		summaryDiv.id = 'sl-credit-summary';
		this._recalculate(contentEl);

		// Buttons
		const btnRow = contentEl.createDiv('sl-form-row sl-edit-btn-row');
		if (this.isEditing) {
			const delBtn = btnRow.createEl('button', { text: t('common_delete'), cls: 'sl-delete-btn' });
			delBtn.addEventListener('click', (e) => {
				e.preventDefault();
				new ConfirmDeleteModal(this.app, this.credit.name, () => {
					this.plugin.settings.credits = this.plugin.settings.credits.filter(c => c.id !== this.credit.id);
					this.plugin.settings.recurringTransactions = this.plugin.settings.recurringTransactions.filter(
						r => r.id !== `credit-${this.credit.id}`
					);
					this.plugin.saveSettings();
					this.onSave();
					this.close();
				}).open();
			});
		}
		const saveBtn = btnRow.createEl('button', {
			text: this.isEditing ? t('common_save_changes') : t('modal_credit_btn_create'),
			cls: 'mod-cta sl-submit-btn',
		});
		saveBtn.addEventListener('click', (e) => {
			e.preventDefault();
			if (!this.credit.name.trim()) { new Notice(t('notice_credit_write_name')); return; }
			const principal = this.credit.principal;
			const totalDebt = this.credit.totalDebt;
			if (!principal || principal <= 0) { new Notice(t('notice_credit_invalid_principal')); return; }
			if (!totalDebt || totalDebt <= 0) { new Notice(t('notice_credit_invalid_total')); return; }

			this.credit.interestTotal = totalDebt - principal;
			const { monthlyTotal } = calculateCreditMonthlyAmounts(principal, totalDebt, this.credit.months);
			this.credit.monthlyPayment = monthlyTotal;
			this.credit.name = this.credit.name.trim();

			this._createCreditEntries();
			this.onSave();
			this.close();
		});

		setTimeout(() => nameInput.focus(), 50);
	}

	private _recalculate(contentEl: HTMLElement): void {
		const summary = contentEl.querySelector('#sl-credit-summary') as HTMLElement | null;
		if (!summary) return;
		summary.empty();

		const principal = this.credit.principal;
		const totalDebt = this.credit.totalDebt;
		const months = this.credit.months || 12;
		const sym = this.plugin.settings.currencySymbol;

		if (principal > 0 && totalDebt > 0) {
			const interest = totalDebt - principal;
			const { monthlyTotal: monthly, monthlyInterest: interestPerMonth, monthlyPrincipal: principalPerMonth } =
				calculateCreditMonthlyAmounts(principal, totalDebt, months);

			summary.createEl('h4', { text: t('modal_credit_summary_title') });
			const table = summary.createEl('div', { cls: 'sl-credit-summary-table' });
			const rows: [string, string][] = [
				[t('modal_credit_row_principal'), `${sym}${principal.toLocaleString()}`],
				[t('modal_credit_row_interest'), `${sym}${interest.toLocaleString()}`],
				[t('modal_credit_row_total'), `${sym}${totalDebt.toLocaleString()}`],
				[t('modal_credit_row_monthly'), `${sym}${monthly.toLocaleString()}`],
				['', ''],
				[t('modal_credit_row_registered_as'), ''],
				[t('modal_credit_row_capital'), `${sym}${principalPerMonth.toLocaleString()}`],
				[t('modal_credit_row_interest_cost'), `${sym}${interestPerMonth.toLocaleString()}`],
			];
			for (const [label, val] of rows) {
				if (!label && !val) { table.createEl('hr'); continue; }
				const row = table.createDiv('sl-credit-row');
				row.createSpan({ text: label, cls: val ? '' : 'sl-credit-label-bold' });
				if (val) row.createSpan({ text: val, cls: 'sl-credit-val' });
			}
		}
	}

	private _createCreditEntries(): void {
		const c = this.credit;
		const settings = this.plugin.settings;

		const debtAccount = `Pasivos:${c.name.replace(/\s+/g, '')}`;
		const interestAccount = `Gastos:Intereses:${c.name.replace(/\s+/g, '')}`;
		if (!settings.defaultAccounts.liabilities.includes(debtAccount)) {
			settings.defaultAccounts.liabilities.push(debtAccount);
		}
		if (!settings.defaultAccounts.expenses.includes(interestAccount)) {
			settings.defaultAccounts.expenses.push(interestAccount);
		}

		const credits = settings.credits;
		const idx = credits.findIndex(x => x.id === c.id);
		if (idx >= 0) {
			credits[idx] = c;
		} else {
			credits.push(c);
		}

		if (!this.isEditing) {
			this.plugin.addTransaction({
				date: c.startDate,
				payee: `${c.name} - Desembolso`,
				amount: c.principal,
				toAccount: c.fromAsset,
				fromAccount: debtAccount,
				status: '*',
			});
		}

		const { monthlyPrincipal, monthlyInterest, monthlyTotal } =
			calculateCreditMonthlyAmounts(c.principal, c.principal + c.interestTotal, c.months);

		settings.recurringTransactions = settings.recurringTransactions.filter(r => r.id !== `credit-${c.id}`);
		settings.recurringTransactions.push({
			id: `credit-${c.id}`,
			payee: `${c.name} - Cuota`,
			amount: monthlyTotal,
			toAccount: debtAccount,
			fromAccount: c.fromAsset,
			frequency: 'monthly',
			dayOfMonth: c.dayOfMonth,
			status: '*',
			_isCreditPayment: true,
			_creditId: c.id,
			_principalPortion: monthlyPrincipal,
			_interestPortion: monthlyInterest,
			_interestAccount: interestAccount,
		});

		settings.credits = credits;
		this.plugin.saveSettings();
		new Notice(t('notice_saved', { name: c.name }));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
