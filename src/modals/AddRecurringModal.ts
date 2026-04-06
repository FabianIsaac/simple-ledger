import { App, Modal, Notice } from 'obsidian';
import { ACCT } from '../constants';
import { t } from '../i18n';
import { RecurringTransaction, ISimpleLedgerPlugin } from '../types';
import { generateId, FREQUENCY_LABELS } from '../utils/recurring';

type Plugin = ISimpleLedgerPlugin;

export class AddRecurringModal extends Modal {
	private plugin: Plugin;
	private onSave: () => void;
	private isEditing: boolean;
	private rec: RecurringTransaction;

	constructor(app: App, plugin: Plugin, existingRec: RecurringTransaction | null, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
		this.isEditing = !!existingRec;
		this.rec = existingRec ? { ...existingRec } : {
			id: generateId(),
			payee: '',
			amount: 0,
			toAccount: '',
			fromAccount: '',
			frequency: 'monthly',
			dayOfMonth: 1,
			dayOfWeek: 1,
			monthOfYear: 1,
			status: '*',
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');
		contentEl.createEl('h2', { text: this.isEditing ? t('modal_rec_edit_title') : t('modal_rec_new_title') });

		// Payee
		const payeeRow = contentEl.createDiv('sl-form-row');
		payeeRow.createEl('label', { text: t('common_description') });
		const payeeInput = payeeRow.createEl('input', { type: 'text', placeholder: t('modal_rec_ph_description') });
		payeeInput.value = this.rec.payee;
		payeeInput.addEventListener('input', (e) => { this.rec.payee = (e.target as HTMLInputElement).value; });

		// Amount
		const amountRow = contentEl.createDiv('sl-form-row');
		amountRow.createEl('label', { text: `${t('common_amount')} (${this.plugin.settings.currencySymbol})` });
		const amountInput = amountRow.createEl('input', { type: 'number', attr: { step: '0.01', min: '0' }, placeholder: '0' });
		amountInput.value = String(this.rec.amount);
		amountInput.addEventListener('input', (e) => {
			this.rec.amount = parseFloat((e.target as HTMLInputElement).value) || 0;
		});

		// Frequency
		const freqRow = contentEl.createDiv('sl-form-row');
		freqRow.createEl('label', { text: t('common_frequency') });
		const freqSelect = freqRow.createEl('select');
		freqSelect.createEl('option', { value: 'monthly', text: t('freq_monthly') });
		freqSelect.createEl('option', { value: 'weekly', text: t('freq_weekly') });
		freqSelect.createEl('option', { value: 'yearly', text: t('freq_yearly') });
		freqSelect.value = this.rec.frequency;

		// Day of month
		const dayRow = contentEl.createDiv('sl-form-row sl-day-row');
		dayRow.createEl('label', { text: t('modal_rec_lbl_day_month') });
		const dayInput = dayRow.createEl('input', { type: 'number', attr: { min: '1', max: '31' } });
		dayInput.value = String(this.rec.dayOfMonth ?? 1);
		dayInput.addEventListener('input', (e) => {
			this.rec.dayOfMonth = parseInt((e.target as HTMLInputElement).value) || 1;
		});

		// Day of week
		const weekDayRow = contentEl.createDiv('sl-form-row sl-weekday-row');
		weekDayRow.createEl('label', { text: t('modal_rec_lbl_day_week') });
		const weekDaySelect = weekDayRow.createEl('select');
		const days = [t('day_monday'), t('day_tuesday'), t('day_wednesday'), t('day_thursday'), t('day_friday'), t('day_saturday'), t('day_sunday')];
		days.forEach((d, i) => weekDaySelect.createEl('option', { value: String(i + 1), text: d }));
		weekDaySelect.value = String(this.rec.dayOfWeek ?? 1);
		weekDaySelect.addEventListener('change', (e) => {
			this.rec.dayOfWeek = parseInt((e.target as HTMLSelectElement).value);
		});

		const updateVisibility = () => {
			dayRow.style.display = this.rec.frequency === 'weekly' ? 'none' : '';
			weekDayRow.style.display = this.rec.frequency === 'weekly' ? '' : 'none';
		};
		freqSelect.addEventListener('change', (e) => {
			this.rec.frequency = (e.target as HTMLSelectElement).value as RecurringTransaction['frequency'];
			updateVisibility();
		});
		updateVisibility();

		// Type quick buttons
		const typeRow = contentEl.createDiv('sl-form-row sl-type-row');
		typeRow.createEl('label', { text: t('common_type') });
		const btnGroup = typeRow.createDiv('sl-btn-group');
		const types = [
			{ label: t('type_expense'), dest: 'expenses', src: 'assets' },
			{ label: t('type_card'), dest: 'expenses', src: 'liabilities' },
			{ label: t('type_income'), dest: 'assets', src: 'income' },
			{ label: t('type_debt'), dest: 'liabilities', src: 'assets' },
		];

		// Destination
		const toRow = contentEl.createDiv('sl-form-row');
		toRow.createEl('label', { text: t('common_dest') });
		const toSelect = toRow.createEl('select');

		// Source
		const fromRow = contentEl.createDiv('sl-form-row');
		fromRow.createEl('label', { text: t('common_source') });
		const fromSelect = fromRow.createEl('select');

		const populateSelect = (select: HTMLSelectElement, category: string, currentValue: string) => {
			select.empty();
			const accounts = this._getAllAccounts(category);
			for (const acct of accounts) {
				const opt = select.createEl('option', { value: acct, text: acct });
				if (acct === currentValue) opt.selected = true;
			}
		};

		let currentDest = 'expenses';
		let currentSrc = 'assets';
		if (this.isEditing) {
			if (this.rec.toAccount.startsWith(ACCT.assets) && this.rec.fromAccount.startsWith(ACCT.income)) {
				currentDest = 'assets'; currentSrc = 'income';
			} else if (this.rec.toAccount.startsWith(ACCT.liabilities) && this.rec.fromAccount.startsWith(ACCT.assets)) {
				currentDest = 'liabilities'; currentSrc = 'assets';
			} else if (this.rec.toAccount.startsWith(ACCT.expenses) && this.rec.fromAccount.startsWith(ACCT.liabilities)) {
				currentDest = 'expenses'; currentSrc = 'liabilities';
			}
		}
		populateSelect(toSelect, currentDest, this.rec.toAccount);
		populateSelect(fromSelect, currentSrc, this.rec.fromAccount);

		types.forEach((t) => {
			const isActive = t.dest === currentDest && t.src === currentSrc;
			const btn = btnGroup.createEl('button', { text: t.label, cls: isActive ? 'sl-type-btn sl-active' : 'sl-type-btn' });
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				btnGroup.querySelectorAll('.sl-type-btn').forEach(b => b.removeClass('sl-active'));
				btn.addClass('sl-active');
				populateSelect(toSelect, t.dest, '');
				populateSelect(fromSelect, t.src, '');
				this.rec.toAccount = toSelect.value;
				this.rec.fromAccount = fromSelect.value;
			});
		});

		toSelect.addEventListener('change', (e) => { this.rec.toAccount = (e.target as HTMLSelectElement).value; });
		fromSelect.addEventListener('change', (e) => { this.rec.fromAccount = (e.target as HTMLSelectElement).value; });

		if (!this.rec.toAccount) this.rec.toAccount = toSelect.value;
		if (!this.rec.fromAccount) this.rec.fromAccount = fromSelect.value;

		// Buttons
		const btnRow = contentEl.createDiv('sl-form-row sl-edit-btn-row');

		if (this.isEditing) {
			const delBtn = btnRow.createEl('button', { text: t('modal_rec_btn_delete'), cls: 'sl-delete-btn' });
			delBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.plugin.settings.recurringTransactions = this.plugin.settings.recurringTransactions.filter(r => r.id !== this.rec.id);
				this.plugin.saveSettings();
				this.onSave();
				this.close();
				new Notice(t('notice_recurring_deleted'));
			});
		}

		const saveBtn = btnRow.createEl('button', {
			text: this.isEditing ? t('common_save_changes') : t('modal_rec_btn_create'),
			cls: 'mod-cta sl-submit-btn',
		});
		saveBtn.addEventListener('click', async (e) => {
			e.preventDefault();
			if (!this.rec.payee.trim()) { new Notice(t('notice_write_description')); return; }
			if (!this.rec.amount || this.rec.amount === 0) { new Notice(t('notice_write_valid_amount')); return; }
			this.rec.payee = this.rec.payee.trim();

			const recs = this.plugin.settings.recurringTransactions;
			const idx = recs.findIndex(r => r.id === this.rec.id);
			const isNew = idx < 0;
			if (idx >= 0) {
				recs[idx] = this.rec;
			} else {
				recs.push(this.rec);
			}
			await this.plugin.saveSettings();
			if (isNew) {
				await this.plugin.createRecurringNote(this.rec);
			}
			this.onSave();
			this.close();
			new Notice(this.isEditing ? t('notice_recurring_updated') : t('notice_recurring_created'));
		});

		setTimeout(() => payeeInput.focus(), 50);
	}

	private _getAllAccounts(category: string): string[] {
		const defaults = this.plugin.settings.defaultAccounts[category as keyof typeof this.plugin.settings.defaultAccounts] ?? [];
		const existing = new Set(defaults);
		const prefix: Record<string, string> = {
			expenses: 'Gastos', income: 'Ingresos', assets: 'Activos', liabilities: 'Pasivos',
		};
		const pfx = prefix[category] ?? '';
		for (const tx of this.plugin.transactions) {
			for (const p of tx.postings) {
				if (pfx && p.account.startsWith(pfx)) existing.add(p.account);
			}
		}
		return [...existing].sort();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
