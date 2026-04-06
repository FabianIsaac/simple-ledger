import { App, Modal, Notice, setIcon } from 'obsidian';
import { MultiPostingTransactionData, ISimpleLedgerPlugin } from '../types';
import { t } from '../i18n';
import { todayStr } from '../utils/formatting';

type Plugin = ISimpleLedgerPlugin;

interface PostingRowState {
	account: string;
	amount: string; // empty = auto-balance
}

export class MultiPostingModal extends Modal {
	private plugin: Plugin;
	private date: string;
	private payee: string;
	private status: string;
	private notes: string;
	private rows: PostingRowState[];
	private rowsContainer!: HTMLElement;
	private balanceEl!: HTMLElement;
	private allAccounts: string[] = [];

	constructor(app: App, plugin: Plugin) {
		super(app);
		this.plugin = plugin;
		this.date = todayStr();
		this.payee = '';
		this.status = '*';
		this.notes = '';
		this.rows = [
			{ account: '', amount: '' },
			{ account: '', amount: '' },
			{ account: '', amount: '' },
		];
	}

	onOpen(): void {
		this.allAccounts = this._collectAllAccounts();
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal', 'sl-multi-modal');

		contentEl.createEl('h2', { text: t('modal_multi_title') });

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
		const payeeInput = payeeRow.createEl('input', { type: 'text', placeholder: t('modal_multi_ph_description') });
		payeeInput.addEventListener('input', (e) => { this.payee = (e.target as HTMLInputElement).value; });

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
		const notesInput = notesRow.createEl('textarea', { attr: { rows: '2', placeholder: t('modal_multi_ph_notes') } });
		notesInput.addEventListener('input', (e) => { this.notes = (e.target as HTMLTextAreaElement).value; });

		// Postings section
		const postingsSection = contentEl.createDiv('sl-multi-section');
		const postingsHeader = postingsSection.createDiv('sl-multi-section-header');
		postingsHeader.createEl('span', { text: t('modal_multi_section_postings') });
		const addRowBtn = postingsHeader.createEl('button', { cls: 'sl-multi-add-btn', attr: { title: t('modal_multi_btn_add_posting') } });
		setIcon(addRowBtn, 'plus');
		addRowBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.rows.push({ account: '', amount: '' });
			this._renderRows();
			this._updateBalance();
		});

		// Datalist for account autocomplete
		const datalist = postingsSection.createEl('datalist', { attr: { id: 'sl-mp-accounts' } });
		for (const acct of this.allAccounts) {
			datalist.createEl('option', { value: acct });
		}

		// Rows container
		this.rowsContainer = postingsSection.createDiv('sl-multi-rows');
		this._renderRows();

		// Balance indicator
		this.balanceEl = postingsSection.createDiv('sl-multi-balance');
		this._updateBalance();

		const hint = postingsSection.createEl('p', { cls: 'sl-multi-hint', text: t('modal_multi_hint') });
		hint.style.cssText = 'font-size:0.8em;color:var(--text-muted);margin:4px 0 0;';

		// Submit
		const btnRow = contentEl.createDiv('sl-form-row sl-btn-row');
		const submitBtn = btnRow.createEl('button', { text: t('modal_multi_btn_save'), cls: 'mod-cta sl-submit-btn' });
		submitBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this._submit();
		});

		setTimeout(() => payeeInput.focus(), 50);
	}

	private _renderRows(): void {
		this.rowsContainer.empty();
		this.rows.forEach((row, idx) => {
			const rowEl = this.rowsContainer.createDiv('sl-multi-row');

			const acctInput = rowEl.createEl('input', {
				type: 'text',
				cls: 'sl-multi-account',
				attr: { placeholder: t('modal_multi_ph_account'), list: 'sl-mp-accounts' },
			});
			acctInput.value = row.account;
			acctInput.addEventListener('input', (e) => {
				this.rows[idx]!.account = (e.target as HTMLInputElement).value;
				this._updateBalance();
			});

			const amtInput = rowEl.createEl('input', {
				type: 'number',
				cls: 'sl-multi-amount',
				attr: { placeholder: t('modal_multi_ph_amount'), step: '0.01' },
			});
			if (row.amount !== '') amtInput.value = row.amount;
			amtInput.addEventListener('input', (e) => {
				this.rows[idx]!.amount = (e.target as HTMLInputElement).value;
				this._updateBalance();
			});

			const delBtn = rowEl.createEl('button', { cls: 'sl-multi-del-btn', attr: { title: t('modal_multi_btn_delete_posting') } });
			setIcon(delBtn, 'x');
			delBtn.addEventListener('click', (e) => {
				e.preventDefault();
				if (this.rows.length <= 2) { new Notice(t('notice_multi_min_postings')); return; }
				this.rows.splice(idx, 1);
				this._renderRows();
				this._updateBalance();
			});
		});
	}

	private _updateBalance(): void {
		const amounts = this.rows.map(r => r.amount === '' ? null : parseFloat(r.amount));
		const nullCount = amounts.filter(a => a === null).length;
		const sum = amounts.filter(a => a !== null).reduce((s, a) => s + (a as number), 0);

		if (nullCount === 1) {
			const autoVal = -sum;
			const autoStr = `${autoVal >= 0 ? '+' : ''}${autoVal.toFixed(2)}`;
			this.balanceEl.textContent = t('modal_multi_balance_auto', { val: autoStr });
			this.balanceEl.className = 'sl-multi-balance sl-multi-balance-ok';
		} else if (nullCount === 0) {
			const balanced = Math.abs(sum) < 0.005;
			const valStr = sum.toFixed(2);
			this.balanceEl.textContent = balanced
				? t('modal_multi_balance_ok', { val: valStr })
				: t('modal_multi_balance_err', { val: valStr });
			this.balanceEl.className = `sl-multi-balance ${balanced ? 'sl-multi-balance-ok' : 'sl-multi-balance-err'}`;
		} else {
			this.balanceEl.textContent = t('modal_multi_balance_many_empty', { n: nullCount });
			this.balanceEl.className = 'sl-multi-balance sl-multi-balance-err';
		}
	}

	private _submit(): void {
		if (!this.payee.trim()) { new Notice(t('notice_write_description')); return; }

		const filled = this.rows.filter(r => r.account.trim() !== '');
		if (filled.length < 2) { new Notice(t('notice_multi_min_with_account')); return; }

		const amounts = filled.map(r => r.amount === '' ? null : parseFloat(r.amount));
		const nullCount = amounts.filter(a => a === null).length;

		if (nullCount > 1) { new Notice(t('notice_multi_one_auto')); return; }

		const sum = amounts.filter(a => a !== null).reduce((s, a) => s + (a as number), 0);
		if (nullCount === 0 && Math.abs(sum) >= 0.005) {
			new Notice(t('notice_multi_unbalanced', { sum: sum.toFixed(2) }));
			return;
		}

		// Build postings: auto-balance the null one
		const postings = filled.map(r => ({
			account: r.account.trim(),
			amount: r.amount === '' ? null : parseFloat(r.amount),
		}));

		if (nullCount === 1) {
			const autoVal = -sum;
			const nullIdx = postings.findIndex(p => p.amount === null);
			postings[nullIdx]!.amount = autoVal;
		}

		const data: MultiPostingTransactionData = {
			date: this.date,
			payee: this.payee.trim(),
			status: this.status,
			notes: this.notes.trim() || undefined,
			postings,
		};

		this.plugin.addMultiPostingTransaction(data);
		this.close();
	}

	private _collectAllAccounts(): string[] {
		const set = new Set<string>();
		const defaults = this.plugin.settings.defaultAccounts;
		for (const list of Object.values(defaults)) {
			for (const a of list) set.add(a);
		}
		for (const tx of this.plugin.transactions) {
			for (const p of tx.postings) set.add(p.account);
		}
		return [...set].sort();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
