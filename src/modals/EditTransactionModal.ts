import { App, Modal, Notice } from 'obsidian';
import { Transaction, AddTransactionData, ISimpleLedgerPlugin } from '../types';
import { t } from '../i18n';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

type Plugin = ISimpleLedgerPlugin;

export class EditTransactionModal extends Modal {
	private plugin: Plugin;
	private tx: Transaction;
	private onSave: (oldTx: Transaction, newData: AddTransactionData) => void;
	private onDelete: (tx: Transaction) => void;
	private date: string;
	private payee: string;
	private amount: string;
	private toAccount: string;
	private fromAccount: string;
	private status: string;
	private notes: string;

	constructor(
		app: App,
		plugin: Plugin,
		tx: Transaction,
		onSave: (oldTx: Transaction, newData: AddTransactionData) => void,
		onDelete: (tx: Transaction) => void
	) {
		super(app);
		this.plugin = plugin;
		this.tx = tx;
		this.onSave = onSave;
		this.onDelete = onDelete;
		const posPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
		const negPosting = tx.postings.find(p => (p.amount ?? 0) < 0) ?? tx.postings[1];
		this.date = tx.date;
		this.payee = tx.payee;
		this.amount = String(Math.abs(posPosting?.amount ?? 0));
		this.toAccount = posPosting?.account ?? '';
		this.fromAccount = negPosting?.account ?? '';
		this.status = tx.status;
		this.notes = tx.notes ?? '';
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');

		contentEl.createEl('h2', { text: t('modal_edit_tx_title') });

		// Date
		const dateRow = contentEl.createDiv('sl-form-row');
		dateRow.createEl('label', { text: t('common_date') });
		const dateInput = dateRow.createEl('input', { type: 'date' });
		dateInput.value = this.date.replace(/\//g, '-');
		dateInput.addEventListener('change', (e) => {
			this.date = (e.target as HTMLInputElement).value.replace(/-/g, '/');
		});

		// Payee
		const payeeRow = contentEl.createDiv('sl-form-row');
		payeeRow.createEl('label', { text: t('common_description') });
		const payeeInput = payeeRow.createEl('input', { type: 'text' });
		payeeInput.value = this.payee;
		payeeInput.addEventListener('input', (e) => { this.payee = (e.target as HTMLInputElement).value; });

		// Amount
		const amountRow = contentEl.createDiv('sl-form-row');
		amountRow.createEl('label', { text: `${t('common_amount')} (${this.plugin.settings.currencySymbol})` });
		const amountInput = amountRow.createEl('input', { type: 'number', attr: { step: '0.01', min: '0' } });
		amountInput.value = this.amount;
		amountInput.addEventListener('input', (e) => { this.amount = (e.target as HTMLInputElement).value; });

		// Destination account
		const toRow = contentEl.createDiv('sl-form-row');
		toRow.createEl('label', { text: t('common_dest_full') });
		const toSelect = toRow.createEl('select');
		this._populateAllAccounts(toSelect, this.toAccount);
		toSelect.addEventListener('change', (e) => { this.toAccount = (e.target as HTMLSelectElement).value; });

		// Source account
		const fromRow = contentEl.createDiv('sl-form-row');
		fromRow.createEl('label', { text: t('common_source_full') });
		const fromSelect = fromRow.createEl('select');
		this._populateAllAccounts(fromSelect, this.fromAccount);
		fromSelect.addEventListener('change', (e) => { this.fromAccount = (e.target as HTMLSelectElement).value; });

		// Status
		const statusRow = contentEl.createDiv('sl-form-row');
		statusRow.createEl('label', { text: t('common_status') });
		const statusSelect = statusRow.createEl('select');
		statusSelect.createEl('option', { value: '*', text: t('status_confirmed') });
		statusSelect.createEl('option', { value: '!', text: t('status_pending') });
		statusSelect.createEl('option', { value: '', text: t('status_unmarked') });
		statusSelect.value = this.status;
		statusSelect.addEventListener('change', (e) => { this.status = (e.target as HTMLSelectElement).value; });

		// Notes
		const notesRow = contentEl.createDiv('sl-form-row');
		notesRow.createEl('label', { text: t('common_notes') });
		const notesInput = notesRow.createEl('textarea', { attr: { rows: '2', placeholder: '' } });
		notesInput.value = this.notes;
		notesInput.addEventListener('input', (e) => { this.notes = (e.target as HTMLTextAreaElement).value; });

		// Buttons
		const btnRow = contentEl.createDiv('sl-form-row sl-edit-btn-row');
		const deleteBtn = btnRow.createEl('button', { text: t('modal_tx_btn_delete'), cls: 'sl-delete-btn' });
		deleteBtn.addEventListener('click', (e) => {
			e.preventDefault();
			new ConfirmDeleteModal(this.app, this.tx.payee, () => {
				this.onDelete(this.tx);
				this.close();
			}).open();
		});

		const saveBtn = btnRow.createEl('button', { text: t('modal_tx_btn_save_changes'), cls: 'mod-cta sl-submit-btn' });
		saveBtn.addEventListener('click', (e) => {
			e.preventDefault();
			if (!this.payee.trim()) { new Notice(t('notice_write_description')); return; }
			if (!this.amount || parseFloat(this.amount) === 0) { new Notice(t('notice_write_valid_amount')); return; }
			this.onSave(this.tx, {
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
	}

	private _populateAllAccounts(select: HTMLSelectElement, selectedValue: string): void {
		select.empty();
		const allAccounts = new Set<string>();
		const settings = this.plugin.settings;
		for (const category of Object.values(settings.defaultAccounts)) {
			for (const acct of category) allAccounts.add(acct);
		}
		for (const tx of this.plugin.transactions) {
			for (const p of tx.postings) allAccounts.add(p.account);
		}
		const sorted = [...allAccounts].sort();
		for (const acct of sorted) {
			const opt = select.createEl('option', { value: acct, text: acct });
			if (acct === selectedValue) opt.selected = true;
		}
		if (selectedValue && !allAccounts.has(selectedValue)) {
			const opt = select.createEl('option', { value: selectedValue, text: selectedValue });
			opt.selected = true;
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
