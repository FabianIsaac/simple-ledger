import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LEDGER } from '../constants';
import { PluginSettings, Transaction, BalanceTree } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount } from '../utils/formatting';
import { AddTransactionModal } from '../modals/AddTransactionModal';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { ManageAccountsModal } from '../modals/ManageAccountsModal';
import { AddTransactionData } from '../types';

interface Plugin {
	settings: PluginSettings;
	transactions: Transaction[];
	loadTransactions(): Promise<Transaction[]>;
	addTransaction(data: AddTransactionData): Promise<void>;
	updateTransaction(oldTx: Transaction, newData: AddTransactionData): Promise<void>;
	deleteTransaction(tx: Transaction): Promise<void>;
	renameAccount(oldName: string, newName: string): Promise<void>;
	saveSettings(): Promise<void>;
}

export class LedgerSidebarView extends ItemView {
	private plugin: Plugin;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return VIEW_TYPE_LEDGER; }
	getDisplayText(): string { return 'Simple Ledger'; }
	getIcon(): string { return 'wallet'; }

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('simple-ledger-sidebar');

		const settings = this.plugin.settings;
		const txs = this.plugin.transactions ?? [];

		// Header
		const header = container.createDiv('sl-sidebar-header');
		header.createEl('h3', { text: 'Simple Ledger' });

		const btnBar = header.createDiv('sl-header-btns');
		const addBtn = btnBar.createEl('button', { text: '+ Nuevo', cls: 'sl-header-btn mod-cta' });
		addBtn.addEventListener('click', () => {
			new AddTransactionModal(this.app, this.plugin, (data) => {
				this.plugin.addTransaction(data);
			}).open();
		});
		const refreshBtn = btnBar.createEl('button', { text: '↻', cls: 'sl-header-btn', attr: { title: 'Recargar' } });
		refreshBtn.addEventListener('click', () => {
			this.plugin.loadTransactions().then(() => this.render());
		});

		const balances = LedgerParser.computeBalances(txs);
		const tree = LedgerParser.computeBalanceTree(balances);

		if (Object.keys(tree).length === 0) {
			const empty = container.createDiv('sl-empty');
			empty.createEl('p', { text: 'No hay transacciones aun.' });
			empty.createEl('p', { text: 'Usa el boton "+ Nuevo" para empezar.' });
			return;
		}

		// Summary cards
		const summary = container.createDiv('sl-summary');
		const totalIncome = Object.entries(balances)
			.filter(([k]) => k.startsWith('Ingresos'))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalExpenses = Object.entries(balances)
			.filter(([k]) => k.startsWith('Gastos'))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const totalAssets = Object.entries(balances)
			.filter(([k]) => k.startsWith('Activos'))
			.reduce((s, [, v]) => s + v, 0);

		this._createCard(summary, 'Ingresos', totalIncome, 'sl-card-income');
		this._createCard(summary, 'Gastos', totalExpenses, 'sl-card-expense');
		this._createCard(summary, 'Balance', totalAssets, 'sl-card-balance');

		// Account tree
		const treeSection = container.createDiv('sl-tree-section');
		const treeHeader = treeSection.createDiv('sl-section-header');
		treeHeader.createEl('h4', { text: 'Cuentas' });
		const gearBtn = treeHeader.createEl('button', { text: '⚙', cls: 'sl-gear-btn', attr: { title: 'Gestionar cuentas' } });
		gearBtn.addEventListener('click', () => {
			new ManageAccountsModal(this.app, this.plugin).open();
		});
		this._renderTree(treeSection, tree, 0);

		// Recent transactions
		const recentSection = container.createDiv('sl-recent-section');
		const recentHeader = recentSection.createDiv('sl-section-header');
		recentHeader.createEl('h4', { text: 'Transacciones' });
		recentHeader.createSpan({ text: `(${txs.length})`, cls: 'sl-tx-count' });

		const showAll = txs.length > 10;
		let visibleTxs = showAll ? txs.slice(-10).reverse() : [...txs].reverse();

		const txList = recentSection.createDiv('sl-tx-list');
		const renderTxList = (list: Transaction[]) => {
			txList.empty();
			for (const tx of list) {
				const row = txList.createDiv('sl-tx-row sl-tx-clickable');
				row.createSpan({ text: tx.date, cls: 'sl-tx-date' });
				row.createSpan({ text: tx.payee, cls: 'sl-tx-payee' });
				const mainPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
				if (mainPosting && mainPosting.amount !== null) {
					row.createSpan({
						text: fmtAmount(mainPosting.amount, settings),
						cls: `sl-tx-amount ${(mainPosting.amount ?? 0) >= 0 ? 'sl-positive' : 'sl-negative'}`,
					});
				}
				row.createSpan({ text: '✎', cls: 'sl-tx-edit-icon' });
				row.addEventListener('click', () => {
					new EditTransactionModal(
						this.app, this.plugin, tx,
						(oldTx, newData) => {
							this.plugin.updateTransaction(oldTx, newData).then(() => this.render());
						},
						(txToDelete) => {
							this.plugin.deleteTransaction(txToDelete).then(() => this.render());
						}
					).open();
				});
			}
		};
		renderTxList(visibleTxs);

		if (showAll) {
			const showAllBtn = recentSection.createEl('button', { text: `Ver todas (${txs.length})`, cls: 'sl-show-all-btn' });
			showAllBtn.addEventListener('click', () => {
				renderTxList([...txs].reverse());
				showAllBtn.remove();
			});
		}
	}

	private _createCard(parent: HTMLElement, title: string, amount: number, cls: string): void {
		const card = parent.createDiv(`sl-card ${cls}`);
		card.createDiv({ text: title, cls: 'sl-card-title' });
		card.createDiv({ text: fmtAmount(amount, this.plugin.settings), cls: 'sl-card-amount' });
	}

	private _renderTree(container: HTMLElement, tree: BalanceTree, depth: number): void {
		const settings = this.plugin.settings;
		for (const [key, node] of Object.entries(tree)) {
			const row = container.createDiv('sl-tree-row');
			row.style.paddingLeft = `${depth * 16 + 8}px`;
			row.createSpan({ text: key, cls: 'sl-tree-label' });
			row.createSpan({
				text: fmtAmount(node._total, settings),
				cls: `sl-tree-amount ${node._total >= 0 ? 'sl-positive' : 'sl-negative'}`,
			});
			const hasChildren = Object.keys(node._children).length > 0;
			if (hasChildren) {
				this._renderTree(container, node._children, depth + 1);
			}
		}
	}

	async onClose(): Promise<void> {}
}
