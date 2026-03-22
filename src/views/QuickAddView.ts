import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_QUICK_ADD } from '../constants';
import { PluginSettings, Transaction, AddTransactionData } from '../types';
import { fmtAmount, todayStr } from '../utils/formatting';

interface Plugin {
	settings: PluginSettings;
	transactions: Transaction[];
	loadTransactions(): Promise<Transaction[]>;
	addTransaction(data: AddTransactionData): Promise<void>;
}

interface RecentItem {
	date: string;
	payee: string;
	amount: number;
	toAccount: string;
	fromAccount: string;
}

export class QuickAddView extends ItemView {
	private plugin: Plugin;
	recentlyAdded: RecentItem[];
	private _type: string;
	private _date: string;
	private _payee: string;
	private _amount: string;
	private _toAccount: string;
	private _fromAccount: string;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
		this.recentlyAdded = [];
		this._type = 'expense';
		this._date = '';
		this._payee = '';
		this._amount = '';
		this._toAccount = '';
		this._fromAccount = '';
	}

	getViewType(): string { return VIEW_TYPE_QUICK_ADD; }
	getDisplayText(): string { return 'Agregar movimiento'; }
	getIcon(): string { return 'plus-circle'; }

	async onOpen(): Promise<void> {
		await this.plugin.loadTransactions();
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('sl-qa-panel');

		const settings = this.plugin.settings;

		const header = container.createDiv('sl-qa-header');
		header.createEl('h3', { text: 'Agregar movimiento' });

		// Type selector
		const typeRow = container.createDiv('sl-qa-type-row');
		const types = [
			{ key: 'expense', label: 'Gasto', dest: 'expenses', src: 'assets', icon: '↗' },
			{ key: 'income', label: 'Ingreso', dest: 'assets', src: 'income', icon: '↙' },
			{ key: 'transfer', label: 'Transferencia', dest: 'assets', src: 'assets', icon: '⇄' },
			{ key: 'card_charge', label: 'Cargo tarjeta', dest: 'expenses', src: 'liabilities', icon: '💳' },
			{ key: 'card_payment', label: 'Pago tarjeta', dest: 'liabilities', src: 'assets', icon: '🏦' },
		];

		for (const t of types) {
			const btn = typeRow.createEl('button', {
				cls: `sl-qa-type-btn ${this._type === t.key ? 'sl-qa-type-active' : ''}`,
			});
			btn.createSpan({ text: t.icon, cls: 'sl-qa-type-icon' });
			btn.createSpan({ text: t.label });
			btn.addEventListener('click', () => {
				this._type = t.key;
				this.render();
			});
		}

		const currentType = types.find(t => t.key === this._type) ?? types[0]!;

		// Form
		const form = container.createDiv('sl-qa-form');

		// Date
		const dateGroup = form.createDiv('sl-qa-field');
		dateGroup.createEl('label', { text: 'Fecha' });
		const dateInput = dateGroup.createEl('input', { type: 'date', cls: 'sl-qa-input' });
		dateInput.value = this._date || (new Date().toISOString().split('T')[0] ?? '');
		dateInput.addEventListener('change', (e) => { this._date = (e.target as HTMLInputElement).value; });

		// Description
		const payeeGroup = form.createDiv('sl-qa-field');
		payeeGroup.createEl('label', { text: 'Descripcion' });
		const payeeInput = payeeGroup.createEl('input', { type: 'text', placeholder: 'Ej: Supermercado', cls: 'sl-qa-input sl-qa-payee' });
		payeeInput.value = this._payee;
		payeeInput.addEventListener('input', (e) => { this._payee = (e.target as HTMLInputElement).value; });

		// Amount
		const amountGroup = form.createDiv('sl-qa-field');
		amountGroup.createEl('label', { text: `Monto (${settings.currencySymbol})` });
		const amountInput = amountGroup.createEl('input', { type: 'number', attr: { step: '1', min: '0' }, placeholder: '0', cls: 'sl-qa-input sl-qa-amount' });
		amountInput.value = this._amount;
		amountInput.addEventListener('input', (e) => { this._amount = (e.target as HTMLInputElement).value; });

		// Destination
		const toGroup = form.createDiv('sl-qa-field');
		toGroup.createEl('label', { text: 'Destino' });
		const toSelect = toGroup.createEl('select', { cls: 'sl-qa-input' });
		this._populateAccounts(toSelect, currentType.dest, this._toAccount);
		toSelect.addEventListener('change', (e) => { this._toAccount = (e.target as HTMLSelectElement).value; });

		// Source
		const fromGroup = form.createDiv('sl-qa-field');
		fromGroup.createEl('label', { text: 'Origen' });
		const fromSelect = fromGroup.createEl('select', { cls: 'sl-qa-input' });
		this._populateAccounts(fromSelect, currentType.src, this._fromAccount);
		fromSelect.addEventListener('change', (e) => { this._fromAccount = (e.target as HTMLSelectElement).value; });

		// Save button
		const saveBtn = form.createEl('button', { text: 'Guardar', cls: 'mod-cta sl-qa-save-btn' });
		saveBtn.addEventListener('click', () => {
			const payee = this._payee.trim();
			const amount = parseFloat(this._amount);
			if (!payee) { new Notice('Escribe una descripcion'); return; }
			if (!amount || amount <= 0) { new Notice('Monto invalido'); return; }

			const date = (this._date || (new Date().toISOString().split('T')[0] ?? todayStr())).replace(/-/g, '/');
			const toAccount = this._toAccount || toSelect.value;
			const fromAccount = this._fromAccount || fromSelect.value;

			this.plugin.addTransaction({ date, payee, amount, toAccount, fromAccount, status: '*' }).then(() => {
				this.recentlyAdded.unshift({ date, payee, amount, toAccount, fromAccount });
				if (this.recentlyAdded.length > 10) this.recentlyAdded.pop();
				this._payee = '';
				this._amount = '';
				this.render();
				new Notice(`Guardado: ${payee}`);
			});
		});

		const handleEnter = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				saveBtn.click();
			}
		};
		payeeInput.addEventListener('keydown', handleEnter);
		amountInput.addEventListener('keydown', handleEnter);

		// Recently added
		if (this.recentlyAdded.length > 0) {
			const recentSection = container.createDiv('sl-qa-recent');
			recentSection.createEl('h4', { text: 'Agregados en esta sesion' });
			for (const item of this.recentlyAdded) {
				const row = recentSection.createDiv('sl-qa-recent-row');
				row.createSpan({ text: item.date, cls: 'sl-qa-recent-date' });
				row.createSpan({ text: item.payee, cls: 'sl-qa-recent-payee' });
				const isExpense = item.toAccount.startsWith('Gastos') || item.toAccount.startsWith('Pasivos');
				row.createSpan({
					text: fmtAmount(item.amount, settings),
					cls: `sl-qa-recent-amount ${isExpense ? 'sl-negative' : 'sl-positive'}`,
				});
				const dupBtn = row.createEl('button', { text: '↻', cls: 'sl-qa-dup-btn', attr: { title: 'Repetir' } });
				dupBtn.addEventListener('click', () => {
					this._payee = item.payee;
					this._amount = String(item.amount);
					this._toAccount = item.toAccount;
					this._fromAccount = item.fromAccount;
					this.render();
				});
			}
		}

		setTimeout(() => payeeInput.focus(), 50);
	}

	private _populateAccounts(select: HTMLSelectElement, category: string, selectedValue: string): void {
		select.empty();
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
		for (const acct of [...existing].sort()) {
			const opt = select.createEl('option', { value: acct, text: acct });
			if (acct === selectedValue) opt.selected = true;
		}
	}

	async onClose(): Promise<void> {}
}
