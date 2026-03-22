import { Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, VIEW_TYPE_LEDGER, VIEW_TYPE_LEDGER_MAIN, VIEW_TYPE_RECURRING, VIEW_TYPE_QUICK_ADD } from './constants';
import { PluginSettings, Transaction, AddTransactionData, RecurringTransaction } from './types';
import { LedgerParser } from './parser/LedgerParser';
import { fmtAmount, fmtAmountRaw, todayStr } from './utils/formatting';
import { FREQUENCY_LABELS } from './utils/recurring';
import { LedgerSidebarView } from './views/LedgerSidebarView';
import { LedgerMainView } from './views/LedgerMainView';
import { RecurringSidebarView } from './views/RecurringSidebarView';
import { QuickAddView } from './views/QuickAddView';
import { AddTransactionModal } from './modals/AddTransactionModal';
import { ManageAccountsModal } from './modals/ManageAccountsModal';
import { CreditWizardModal } from './modals/CreditWizardModal';
import { LedgerSettingTab } from './settings/SettingsTab';
import { renderBalanceBlock } from './renderers/balanceBlock';
import { renderRegisterBlock } from './renderers/registerBlock';
import { renderSummaryBlock } from './renderers/summaryBlock';

export default class SimpleLedgerPlugin extends Plugin {
	settings!: PluginSettings;
	transactions: Transaction[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		this.transactions = [];

		// Register views
		this.registerView(VIEW_TYPE_LEDGER, (leaf) => new LedgerSidebarView(leaf, this));
		this.registerView(VIEW_TYPE_LEDGER_MAIN, (leaf) => new LedgerMainView(leaf, this));
		this.registerView(VIEW_TYPE_RECURRING, (leaf) => new RecurringSidebarView(leaf, this));
		this.registerView(VIEW_TYPE_QUICK_ADD, (leaf) => new QuickAddView(leaf, this));

		// Ribbon icon
		this.addRibbonIcon('wallet', 'Simple Ledger', () => {
			this.activateView();
		});

		// Commands
		this.addCommand({
			id: 'add-transaction',
			name: 'Agregar transaccion',
			callback: () => {
				new AddTransactionModal(this.app, this, (data) => {
					this.addTransaction(data);
				}).open();
			},
		});

		this.addCommand({
			id: 'open-ledger-panel',
			name: 'Abrir panel lateral',
			callback: () => { this.activateView(); },
		});

		this.addCommand({
			id: 'open-ledger-dashboard',
			name: 'Abrir panel central',
			callback: () => { this.activateMainView(); },
		});

		this.addCommand({
			id: 'open-ledger-file',
			name: 'Abrir archivo ledger',
			callback: async () => {
				const file = this.app.vault.getAbstractFileByPath(this.settings.ledgerFile);
				if (file) {
					await this.app.workspace.openLinkText(this.settings.ledgerFile, '', false);
				} else {
					new Notice(`Archivo ${this.settings.ledgerFile} no encontrado. Agrega una transaccion primero.`);
				}
			},
		});

		this.addCommand({
			id: 'manage-accounts',
			name: 'Gestionar cuentas',
			callback: () => {
				new ManageAccountsModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: 'open-recurring-panel',
			name: 'Abrir panel de recurrentes',
			callback: () => { this.activateRecurringView(); },
		});

		this.addCommand({
			id: 'open-quick-add',
			name: 'Agregar movimientos',
			callback: () => { this.activateQuickAddView(); },
		});

		this.addCommand({
			id: 'new-credit',
			name: 'Nuevo credito',
			callback: () => {
				new CreditWizardModal(this.app, this, null, () => this._refreshViews()).open();
			},
		});

		// Obsidian URI handler
		// Usage: obsidian://simple-ledger?payee=Texto&amount=5000&to=Gastos:Comida&from=Activos:Banco
		// Optional: &date=2026/03/22&status=*
		this.registerObsidianProtocolHandler('simple-ledger', async (params) => {
			const { payee, amount, to, from, date, status } = params;

			if (!payee || !amount || !to || !from) {
				new Notice('Simple Ledger (URI): faltan parametros. Requeridos: payee, amount, to, from');
				new AddTransactionModal(this.app, this, (data) => {
					this.addTransaction(data);
				}).open();
				return;
			}

			const amt = parseFloat(amount);
			if (isNaN(amt) || amt <= 0) {
				new Notice('Simple Ledger (URI): monto invalido');
				return;
			}

			await this.loadTransactions();
			await this.addTransaction({
				date: date ?? todayStr(),
				payee: payee,
				amount: amt,
				toAccount: to,
				fromAccount: from,
				status: status ?? '*',
			});
		});

		// Code block processors
		this.registerMarkdownCodeBlockProcessor('ledger-balance', (source, el) => {
			this.loadTransactions().then(() => {
				renderBalanceBlock(el, this, source.trim());
			});
		});

		this.registerMarkdownCodeBlockProcessor('ledger-register', (source, el) => {
			this.loadTransactions().then(() => {
				renderRegisterBlock(el, this, source.trim());
			});
		});

		this.registerMarkdownCodeBlockProcessor('ledger-summary', (source, el) => {
			this.loadTransactions().then(() => {
				renderSummaryBlock(el, this, source.trim());
			});
		});

		// Settings tab
		this.addSettingTab(new LedgerSettingTab(this.app, this));

		// Load transactions on startup
		this.app.workspace.onLayoutReady(() => {
			this.loadTransactions();
		});
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<PluginSettings>);
		if (!this.settings.defaultAccounts) {
			this.settings.defaultAccounts = { ...DEFAULT_SETTINGS.defaultAccounts };
		}
		for (const key of Object.keys(DEFAULT_SETTINGS.defaultAccounts) as Array<keyof typeof DEFAULT_SETTINGS.defaultAccounts>) {
			if (!this.settings.defaultAccounts[key]) {
				this.settings.defaultAccounts[key] = [...DEFAULT_SETTINGS.defaultAccounts[key]];
			}
		}
		if (!this.settings.archivedAccounts) this.settings.archivedAccounts = [];
		if (!this.settings.recurringTransactions) this.settings.recurringTransactions = [];
		if (!this.settings.credits) this.settings.credits = [];
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async loadTransactions(): Promise<Transaction[]> {
		const filePath = this.settings.ledgerFile;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			const content = await this.app.vault.read(file);
			this.transactions = LedgerParser.parse(content);
		} else {
			this.transactions = [];
		}
		return this.transactions;
	}

	async addTransaction(data: AddTransactionData): Promise<void> {
		const { date, payee, amount, toAccount, fromAccount, status } = data;
		const settings = this.settings;
		const amtFormatted = fmtAmountRaw(amount, settings);
		const negFormatted = fmtAmountRaw(-amount, settings);

		const txText = LedgerParser.formatTransaction(date, payee, [
			{ account: toAccount, amount: amount, currency: '', amountFormatted: amtFormatted },
			{ account: fromAccount, amount: -amount, currency: '', amountFormatted: negFormatted },
		], status);

		const filePath = settings.ledgerFile;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file) {
			const header = `; Simple Ledger - Archivo de transacciones\n; Formato compatible con ledger-cli\n; Creado: ${todayStr()}\n\n`;
			await this.app.vault.create(filePath, header + txText + '\n');
		} else if (file instanceof TFile) {
			const content = await this.app.vault.read(file);
			await this.app.vault.modify(file, content + '\n' + txText + '\n');
		}

		await this.loadTransactions();

		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEDGER);
		for (const leaf of leaves) {
			if (leaf.view instanceof LedgerSidebarView) {
				leaf.view.render();
			}
		}

		new Notice(`Transaccion guardada: ${payee}`);
	}

	async addCreditPayment(rec: RecurringTransaction): Promise<void> {
		const settings = this.settings;
		const capitalPortion = rec._principalPortion ?? rec.amount;
		const interestPortion = rec._interestPortion ?? 0;
		const interestAccount = rec._interestAccount ?? 'Gastos:Intereses';
		const date = todayStr();

		const postings = [
			{ account: rec.toAccount, amount: capitalPortion, currency: '', amountFormatted: fmtAmountRaw(capitalPortion, settings) },
			{ account: interestAccount, amount: interestPortion, currency: '', amountFormatted: fmtAmountRaw(interestPortion, settings) },
			{ account: rec.fromAccount, amount: -(capitalPortion + interestPortion), currency: '', amountFormatted: fmtAmountRaw(-(capitalPortion + interestPortion), settings) },
		];

		const txText = LedgerParser.formatTransaction(date, rec.payee, postings, rec.status ?? '*');

		const filePath = settings.ledgerFile;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file) {
			const header = `; Simple Ledger - Archivo de transacciones\n; Formato compatible con ledger-cli\n; Creado: ${todayStr()}\n\n`;
			await this.app.vault.create(filePath, header + txText + '\n');
		} else if (file instanceof TFile) {
			const content = await this.app.vault.read(file);
			await this.app.vault.modify(file, content + '\n' + txText + '\n');
		}

		await this.loadTransactions();
		await this.appendPaymentToNote(rec, date);
		this._refreshViews();
		new Notice(`Cuota registrada: ${rec.payee}`);
	}

	async updateTransaction(oldTx: Transaction, newData: AddTransactionData): Promise<void> {
		const { date, payee, amount, toAccount, fromAccount, status } = newData;
		const settings = this.settings;
		const amtFormatted = fmtAmountRaw(amount, settings);
		const negFormatted = fmtAmountRaw(-amount, settings);

		const newTxText = LedgerParser.formatTransaction(date, payee, [
			{ account: toAccount, amount: amount, currency: '', amountFormatted: amtFormatted },
			{ account: fromAccount, amount: -amount, currency: '', amountFormatted: negFormatted },
		], status);

		const filePath = settings.ledgerFile;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);
		const lines = content.split('\n');
		const before = lines.slice(0, oldTx.lineStart);
		const after = lines.slice(oldTx.lineEnd + 1);
		const newContent = [...before, newTxText, ...after].join('\n');

		await this.app.vault.modify(file, newContent);
		await this.loadTransactions();
		this._refreshViews();
		new Notice(`Transaccion actualizada: ${payee}`);
	}

	async deleteTransaction(tx: Transaction): Promise<void> {
		const filePath = this.settings.ledgerFile;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);
		const lines = content.split('\n');

		let endLine = tx.lineEnd;
		if (endLine + 1 < lines.length && (lines[endLine + 1] ?? '').trim() === '') {
			endLine++;
		}
		const before = lines.slice(0, tx.lineStart);
		const after = lines.slice(endLine + 1);
		const newContent = [...before, ...after].join('\n');

		await this.app.vault.modify(file, newContent);
		await this.loadTransactions();
		this._refreshViews();
		new Notice(`Transaccion eliminada: ${tx.payee}`);
	}

	async renameAccount(oldName: string, newName: string): Promise<void> {
		const filePath = this.settings.ledgerFile;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) return;

		let content = await this.app.vault.read(file);
		const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(^\\s+)${escaped}(\\s|$)`, 'gm');
		content = content.replace(regex, `$1${newName}$2`);

		await this.app.vault.modify(file, content);
		await this.loadTransactions();
		this._refreshViews();
		new Notice(`Cuenta renombrada: ${oldName} → ${newName}`);
	}

	// ── Recurring notes ──────────────────────────────────────────────────────

	private _sanitizeFileName(name: string): string {
		return name.replace(/[/\\:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' ').trim();
	}

	getRecurringNotePath(rec: RecurringTransaction): string {
		const folder = (this.settings.recurringNotesFolder || 'Finanzas/Recurrentes').replace(/\/$/, '');
		return `${folder}/${this._sanitizeFileName(rec.payee)}.md`;
	}

	async createRecurringNote(rec: RecurringTransaction): Promise<void> {
		const path = this.getRecurringNotePath(rec);
		if (this.app.vault.getAbstractFileByPath(path)) return;

		const folder = path.substring(0, path.lastIndexOf('/'));
		if (!this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const freq = FREQUENCY_LABELS[rec.frequency] ?? rec.frequency;
		const dayLabel = rec.frequency === 'weekly'
			? `día ${rec.dayOfWeek ?? 1} de la semana`
			: rec.frequency === 'yearly'
			? `mes ${rec.monthOfYear ?? 1}`
			: `día ${rec.dayOfMonth ?? 1} del mes`;

		let content = `# ${rec.payee}\n\n`;
		content += `**Monto:** ${fmtAmount(rec.amount, this.settings)}\n`;
		content += `**Frecuencia:** ${freq} (${dayLabel})\n`;
		content += `**Desde:** ${rec.fromAccount}\n`;
		content += `**Hacia:** ${rec.toAccount}\n`;
		if (rec._isCreditPayment && rec._principalPortion && rec._interestPortion) {
			content += `**Capital:** ${fmtAmount(rec._principalPortion, this.settings)} | `;
			content += `**Interés:** ${fmtAmount(rec._interestPortion, this.settings)}\n`;
		}
		content += `\n---\n\n## Historial de pagos\n\n`;
		if (rec._isCreditPayment) {
			content += `| Fecha | Monto | Capital | Interés |\n`;
			content += `|-------|-------|---------|--------|\n`;
		} else {
			content += `| Fecha | Monto |\n`;
			content += `|-------|-------|\n`;
		}

		await this.app.vault.create(path, content);
	}

	async appendPaymentToNote(rec: RecurringTransaction, date: string): Promise<void> {
		const path = this.getRecurringNotePath(rec);
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);
		let row: string;
		if (rec._isCreditPayment && rec._principalPortion && rec._interestPortion) {
			row = `| ${date} | ${fmtAmount(rec.amount, this.settings)} | ${fmtAmount(rec._principalPortion, this.settings)} | ${fmtAmount(rec._interestPortion, this.settings)} |`;
		} else {
			row = `| ${date} | ${fmtAmount(rec.amount, this.settings)} |`;
		}
		await this.app.vault.modify(file, content.trimEnd() + '\n' + row + '\n');
	}

	async registerRecurringPayment(rec: RecurringTransaction): Promise<void> {
		const date = todayStr();
		await this.addTransaction({
			date,
			payee: rec.payee,
			amount: rec.amount,
			toAccount: rec.toAccount,
			fromAccount: rec.fromAccount,
			status: rec.status ?? '*',
		});
		await this.appendPaymentToNote(rec, date);
	}

	async openRecurringNote(rec: RecurringTransaction): Promise<void> {
		const path = this.getRecurringNotePath(rec);
		if (!this.app.vault.getAbstractFileByPath(path)) {
			await this.createRecurringNote(rec);
		}
		await this.app.workspace.openLinkText(path, '', false);
	}

	_refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_LEDGER)) {
			if (leaf.view instanceof LedgerSidebarView) leaf.view.render();
		}
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_LEDGER_MAIN)) {
			if (leaf.view instanceof LedgerMainView) leaf.view.render();
		}
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_RECURRING)) {
			if (leaf.view instanceof RecurringSidebarView) leaf.view.render();
		}
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEDGER);
		if (existing.length > 0) {
			const leaf = existing[0]!;
			this.app.workspace.revealLeaf(leaf);
			if (leaf.view instanceof LedgerSidebarView) {
				await this.loadTransactions();
				leaf.view.render();
			}
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_LEDGER, active: true });
		this.app.workspace.revealLeaf(leaf);
		await this.loadTransactions();
	}

	async activateMainView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_LEDGER_MAIN);
		if (existing.length > 0) {
			const leaf = existing[0]!;
			this.app.workspace.revealLeaf(leaf);
			if (leaf.view instanceof LedgerMainView) {
				await this.loadTransactions();
				leaf.view.render();
			}
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_LEDGER_MAIN, active: true });
		this.app.workspace.revealLeaf(leaf);
		await this.loadTransactions();
	}

	async activateRecurringView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_RECURRING);
		if (existing.length > 0) {
			const leaf = existing[0]!;
			this.app.workspace.revealLeaf(leaf);
			if (leaf.view instanceof RecurringSidebarView) {
				await this.loadTransactions();
				leaf.view.render();
			}
			return;
		}
		const leaf = this.app.workspace.getLeftLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_RECURRING, active: true });
		this.app.workspace.revealLeaf(leaf);
		await this.loadTransactions();
	}

	async activateQuickAddView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_QUICK_ADD);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_QUICK_ADD, active: true });
		this.app.workspace.revealLeaf(leaf);
		await this.loadTransactions();
	}
}
