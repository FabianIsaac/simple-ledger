import { App, Modal, Notice } from 'obsidian';
import { AddTransactionData, ISimpleLedgerPlugin } from '../types';
import { t } from '../i18n';
import { todayStr } from '../utils/formatting';
import { MultiPostingModal } from './MultiPostingModal';

type Plugin = ISimpleLedgerPlugin;

export class AddTransactionModal extends Modal {
	private plugin: Plugin;
	private onSubmit: (data: AddTransactionData) => void;
	private date: string;
	private payee: string;
	private fromAccount: string;
	private toAccount: string;
	private amount: string;
	private status: string;
	private notes: string;

	constructor(app: App, plugin: Plugin, onSubmit: (data: AddTransactionData) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		this.date = todayStr();
		this.payee = '';
		this.fromAccount = '';
		this.toAccount = '';
		this.amount = '';
		this.status = '*';
		this.notes = '';
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');

		contentEl.createEl('h2', { text: t('modal_add_tx_title') });

		// Date
		const dateRow = contentEl.createDiv('sl-form-row');
		dateRow.createEl('label', { text: t('common_date') });
		const dateInput = dateRow.createEl('input', { type: 'date' });
		dateInput.value = new Date().toISOString().split('T')[0] ?? '';
		dateInput.addEventListener('change', (e) => {
			this.date = (e.target as HTMLInputElement).value.replace(/-/g, '/');
		});

		// Payee
		const payeeRow = contentEl.createDiv('sl-form-row');
		payeeRow.createEl('label', { text: t('common_description') });
		const payeeInput = payeeRow.createEl('input', { type: 'text', placeholder: t('modal_tx_ph_description') });
		payeeInput.addEventListener('input', (e) => { this.payee = (e.target as HTMLInputElement).value; });

		// Amount
		const amountRow = contentEl.createDiv('sl-form-row');
		amountRow.createEl('label', { text: `${t('common_amount')} (${this.plugin.settings.currencySymbol})` });
		const amountInput = amountRow.createEl('input', { type: 'number', attr: { step: '0.01', min: '0' }, placeholder: '0.00' });
		amountInput.addEventListener('input', (e) => { this.amount = (e.target as HTMLInputElement).value; });

		// Type quick buttons (first so user picks type before accounts)
		const typeRow = contentEl.createDiv('sl-form-row sl-type-row');
		typeRow.createEl('label', { text: t('common_type') });
		const btnGroup = typeRow.createDiv('sl-btn-group');
		const types = [
			{ label: t('type_expense'), dest: 'expenses', src: 'assets' },
			{ label: t('type_income'), dest: 'assets', src: 'income' },
			{ label: t('type_transfer'), dest: 'assets', src: 'assets' },
			{ label: t('type_card_charge'), dest: 'expenses', src: 'liabilities' },
			{ label: t('type_card_payment'), dest: 'liabilities', src: 'assets' },
		];

		// Destination account
		const toRow = contentEl.createDiv('sl-form-row');
		toRow.createEl('label', { text: t('common_dest_full') });
		const toSelect = toRow.createEl('select');
		this._populateAccountSelect(toSelect, 'expenses');
		toSelect.addEventListener('change', (e) => { this.toAccount = (e.target as HTMLSelectElement).value; });

		// Source account
		const fromRow = contentEl.createDiv('sl-form-row');
		fromRow.createEl('label', { text: t('common_source_full') });
		const fromSelect = fromRow.createEl('select');
		this._populateAccountSelect(fromSelect, 'assets');
		fromSelect.addEventListener('change', (e) => { this.fromAccount = (e.target as HTMLSelectElement).value; });

		types.forEach((t, idx) => {
			const btn = btnGroup.createEl('button', { text: t.label, cls: idx === 0 ? 'sl-type-btn sl-active' : 'sl-type-btn' });
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				btnGroup.querySelectorAll('.sl-type-btn').forEach(b => b.removeClass('sl-active'));
				btn.addClass('sl-active');
				this._populateAccountSelect(toSelect, t.dest);
				this._populateAccountSelect(fromSelect, t.src);
				this.toAccount = toSelect.value;
				this.fromAccount = fromSelect.value;
			});
		});

		// Status
		const statusRow = contentEl.createDiv('sl-form-row');
		statusRow.createEl('label', { text: t('common_status') });
		const statusSelect = statusRow.createEl('select');
		statusSelect.createEl('option', { value: '*', text: t('status_confirmed') });
		statusSelect.createEl('option', { value: '!', text: t('status_pending') });
		statusSelect.createEl('option', { value: '', text: t('status_unmarked') });
		statusSelect.addEventListener('change', (e) => { this.status = (e.target as HTMLSelectElement).value; });

		// Notes
		const notesRow = contentEl.createDiv('sl-form-row');
		notesRow.createEl('label', { text: t('common_notes') });
		const notesInput = notesRow.createEl('textarea', { attr: { rows: '2', placeholder: '' } });
		notesInput.addEventListener('input', (e) => { this.notes = (e.target as HTMLTextAreaElement).value; });

		// Multi-posting link
		const multiRow = contentEl.createDiv('sl-form-row');
		const multiLink = multiRow.createEl('a', { text: t('modal_tx_multi_link'), cls: 'sl-multi-link', href: '#' });
		multiLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.close();
			new MultiPostingModal(this.app, this.plugin).open();
		});

		// Submit
		const btnRow = contentEl.createDiv('sl-form-row sl-btn-row');
		const submitBtn = btnRow.createEl('button', { text: t('modal_tx_btn_save'), cls: 'mod-cta sl-submit-btn' });
		submitBtn.addEventListener('click', (e) => {
			e.preventDefault();
			if (!this.payee.trim()) { new Notice(t('notice_write_description')); return; }
			if (!this.amount || parseFloat(this.amount) === 0) { new Notice(t('notice_write_valid_amount')); return; }
			if (!this.toAccount || !this.fromAccount) { new Notice(t('notice_select_accounts')); return; }
			this.onSubmit({
				date: this.date,
				payee: this.payee.trim(),
				amount: parseFloat(this.amount),
				toAccount: this.toAccount,
				fromAccount: this.fromAccount,
				status: this.status,
				notes: this.notes.trim() || undefined,
			});
			this.close();
		});

		this.toAccount = toSelect.value;
		this.fromAccount = fromSelect.value;

		setTimeout(() => payeeInput.focus(), 50);
	}

	private _populateAccountSelect(select: HTMLSelectElement, category: string): void {
		select.empty();
		const allAccounts = this._getAllAccounts(category);
		for (const acct of allAccounts) {
			select.createEl('option', { value: acct, text: acct });
		}
	}

	private _getAllAccounts(category: string): string[] {
		const defaults = this.plugin.settings.defaultAccounts[category as keyof typeof this.plugin.settings.defaultAccounts] ?? [];
		const existing = new Set(defaults);
		const prefix: Record<string, string> = {
			expenses: 'Gastos',
			income: 'Ingresos',
			assets: 'Activos',
			liabilities: 'Pasivos',
		};
		const pfx = prefix[category] ?? '';

		for (const tx of this.plugin.transactions) {
			for (const p of tx.postings) {
				if (pfx && p.account.startsWith(pfx)) {
					existing.add(p.account);
				}
			}
		}
		return [...existing].sort();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
