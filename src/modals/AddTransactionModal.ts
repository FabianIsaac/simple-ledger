import { App, Modal, Notice } from 'obsidian';
import { AddTransactionData, PluginSettings } from '../types';
import { todayStr } from '../utils/formatting';

interface Plugin {
	settings: PluginSettings;
	transactions: import('../types').Transaction[];
}

export class AddTransactionModal extends Modal {
	private plugin: Plugin;
	private onSubmit: (data: AddTransactionData) => void;
	private date: string;
	private payee: string;
	private fromAccount: string;
	private toAccount: string;
	private amount: string;
	private status: string;

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
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');

		contentEl.createEl('h2', { text: 'Nueva transaccion' });

		// Date
		const dateRow = contentEl.createDiv('sl-form-row');
		dateRow.createEl('label', { text: 'Fecha' });
		const dateInput = dateRow.createEl('input', { type: 'date' });
		dateInput.value = new Date().toISOString().split('T')[0] ?? '';
		dateInput.addEventListener('change', (e) => {
			this.date = (e.target as HTMLInputElement).value.replace(/-/g, '/');
		});

		// Payee
		const payeeRow = contentEl.createDiv('sl-form-row');
		payeeRow.createEl('label', { text: 'Descripcion' });
		const payeeInput = payeeRow.createEl('input', { type: 'text', placeholder: 'Ej: Supermercado Lidl' });
		payeeInput.addEventListener('input', (e) => { this.payee = (e.target as HTMLInputElement).value; });

		// Amount
		const amountRow = contentEl.createDiv('sl-form-row');
		amountRow.createEl('label', { text: `Monto (${this.plugin.settings.currencySymbol})` });
		const amountInput = amountRow.createEl('input', { type: 'number', attr: { step: '0.01', min: '0' }, placeholder: '0.00' });
		amountInput.addEventListener('input', (e) => { this.amount = (e.target as HTMLInputElement).value; });

		// Destination account
		const toRow = contentEl.createDiv('sl-form-row');
		toRow.createEl('label', { text: 'Destino (a donde va)' });
		const toSelect = toRow.createEl('select');
		this._populateAccountSelect(toSelect, 'expenses');
		toSelect.addEventListener('change', (e) => { this.toAccount = (e.target as HTMLSelectElement).value; });

		// Source account
		const fromRow = contentEl.createDiv('sl-form-row');
		fromRow.createEl('label', { text: 'Origen (de donde sale)' });
		const fromSelect = fromRow.createEl('select');
		this._populateAccountSelect(fromSelect, 'assets');
		fromSelect.addEventListener('change', (e) => { this.fromAccount = (e.target as HTMLSelectElement).value; });

		// Type quick buttons
		const typeRow = contentEl.createDiv('sl-form-row sl-type-row');
		typeRow.createEl('label', { text: 'Tipo' });
		const btnGroup = typeRow.createDiv('sl-btn-group');
		const types = [
			{ label: 'Gasto', dest: 'expenses', src: 'assets' },
			{ label: 'Ingreso', dest: 'assets', src: 'income' },
			{ label: 'Transferencia', dest: 'assets', src: 'assets' },
		];
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
		statusRow.createEl('label', { text: 'Estado' });
		const statusSelect = statusRow.createEl('select');
		statusSelect.createEl('option', { value: '*', text: 'Confirmado (*)' });
		statusSelect.createEl('option', { value: '!', text: 'Pendiente (!)' });
		statusSelect.createEl('option', { value: '', text: 'Sin marcar' });
		statusSelect.addEventListener('change', (e) => { this.status = (e.target as HTMLSelectElement).value; });

		// Submit
		const btnRow = contentEl.createDiv('sl-form-row sl-btn-row');
		const submitBtn = btnRow.createEl('button', { text: 'Guardar transaccion', cls: 'mod-cta sl-submit-btn' });
		submitBtn.addEventListener('click', (e) => {
			e.preventDefault();
			if (!this.payee.trim()) { new Notice('Escribe una descripcion'); return; }
			if (!this.amount || parseFloat(this.amount) === 0) { new Notice('Escribe un monto valido'); return; }
			if (!this.toAccount || !this.fromAccount) { new Notice('Selecciona origen y destino'); return; }
			this.onSubmit({
				date: this.date,
				payee: this.payee.trim(),
				amount: parseFloat(this.amount),
				toAccount: this.toAccount,
				fromAccount: this.fromAccount,
				status: this.status,
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
