import { App, ItemView, Modal, WorkspaceLeaf, setIcon } from 'obsidian';
import { t, tn } from '../i18n';
import { VIEW_TYPE_ACCOUNTS, ACCT } from '../constants';
import { ISimpleLedgerPlugin, PluginSettings, Transaction } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount } from '../utils/formatting';
import { ManageAccountsModal } from '../modals/ManageAccountsModal';
import { EditTransactionModal } from '../modals/EditTransactionModal';

type Plugin = ISimpleLedgerPlugin;
type Category = 'assets' | 'liabilities' | 'income' | 'expenses';

const CATEGORY_PREFIX: Record<Category, string> = {
	assets: ACCT.assets,
	liabilities: ACCT.liabilities,
	income: ACCT.income,
	expenses: ACCT.expenses,
};

/** How to normalize monthly flow for display (positive = "good direction"). */
const FLOW_SIGN: Record<Category, 1 | -1> = {
	assets: 1,       // positive flow = money coming in = good
	liabilities: 1,  // positive flow = debt paid down = good
	income: -1,      // income postings are negative in ledger; negate = positive = good
	expenses: -1,    // expense postings are positive = spending; negate = positive = money saved (we flip to show magnitude in red)
};

export class AccountsView extends ItemView {
	private plugin: Plugin;
	private activeTab: Category = 'assets';
	private selectedAccount: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return VIEW_TYPE_ACCOUNTS; }
	getDisplayText(): string { return t('view_accounts_title'); }
	getIcon(): string { return 'landmark'; }

	async onOpen(): Promise<void> {
		await this.plugin.loadTransactions();
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('sl-accounts-view');

		const settings = this.plugin.settings;
		const txs = this.plugin.transactions ?? [];
		const balances = LedgerParser.computeBalances(txs);

		// ── Header ──────────────────────────────────────────────────────────────
		const header = container.createDiv('sl-accounts-header');
		header.createEl('h2', { text: t('view_accounts_title'), cls: 'sl-accounts-title' });
		const headerBtns = header.createDiv('sl-header-btns');
		const manageBtn = headerBtns.createEl('button', {
			text: t('view_accounts_btn_manage'),
			cls: 'sl-header-btn',
		});
		manageBtn.addEventListener('click', () => {
			new ManageAccountsModal(this.app, this.plugin).open();
		});
		const refreshBtn = headerBtns.createEl('button', {
			text: '↻',
			cls: 'sl-header-btn',
			attr: { title: t('common_reload') },
		});
		refreshBtn.addEventListener('click', () => {
			this.plugin.loadTransactions().then(() => this.render());
		});

		// ── Summary cards ────────────────────────────────────────────────────────
		const totalAssets = Object.entries(balances)
			.filter(([k]) => k.startsWith(ACCT.assets))
			.reduce((s, [, v]) => s + v, 0);
		const totalLiabilities = Math.abs(Object.entries(balances)
			.filter(([k]) => k.startsWith(ACCT.liabilities))
			.reduce((s, [, v]) => s + v, 0));
		const netWorth = totalAssets - totalLiabilities;

		// Build per-account breakdowns for info modals
		const assetEntries = Object.entries(balances)
			.filter(([k]) => k.startsWith(ACCT.assets))
			.sort((a, b) => b[1] - a[1]);
		const liabEntries = Object.entries(balances)
			.filter(([k]) => k.startsWith(ACCT.liabilities))
			.map(([k, v]) => [k, Math.abs(v)] as [string, number])
			.sort((a, b) => b[1] - a[1]);

		const summary = container.createDiv('sl-accounts-summary');
		this._summaryCard(
			summary, t('view_accounts_card_net_worth'), netWorth,
			netWorth >= 0 ? 'sl-card-balance' : 'sl-card-expense',
			{ titleKey: 'card_info_net_worth_title', descKey: 'card_info_net_worth_desc',
			  formula: t('card_info_net_worth_formula', { assets: fmtAmount(totalAssets, settings), liabilities: fmtAmount(totalLiabilities, settings) }),
			  entries: [] }
		);
		this._summaryCard(
			summary, t('view_accounts_card_assets'), totalAssets, 'sl-card-income',
			{ titleKey: 'card_info_assets_title', descKey: 'card_info_assets_desc',
			  formula: null, entries: assetEntries }
		);
		this._summaryCard(
			summary, t('view_accounts_card_liabilities'), totalLiabilities, 'sl-card-expense',
			{ titleKey: 'card_info_liabilities_title', descKey: 'card_info_liabilities_desc',
			  formula: null, entries: liabEntries }
		);

		// ── Category tabs ────────────────────────────────────────────────────────
		const tabs = container.createDiv('sl-accounts-tabs');
		const tabDefs: { key: Category; labelKey: string }[] = [
			{ key: 'assets', labelKey: 'view_accounts_tab_assets' },
			{ key: 'liabilities', labelKey: 'view_accounts_tab_liabilities' },
			{ key: 'income', labelKey: 'view_accounts_tab_income' },
			{ key: 'expenses', labelKey: 'view_accounts_tab_expenses' },
		];

		for (const tab of tabDefs) {
			const count = this._collectAccounts(tab.key, balances).length;
			const btn = tabs.createEl('button', {
				text: `${t(tab.labelKey as any)} (${count})`,
				cls: `sl-accounts-tab ${this.activeTab === tab.key ? 'sl-accounts-tab-active' : ''}`,
			});
			btn.addEventListener('click', () => {
				this.activeTab = tab.key;
				this.selectedAccount = null;
				this.render();
			});
		}

		// ── Account list ─────────────────────────────────────────────────────────
		const list = container.createDiv('sl-accounts-list');
		const accounts = this._collectAccounts(this.activeTab, balances);

		if (accounts.length === 0) {
			list.createEl('p', { text: t('view_accounts_empty'), cls: 'sl-empty-msg' });
			return;
		}

		const now = new Date();
		const currentMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
		const sign = FLOW_SIGN[this.activeTab];
		const isExpenseOrLiab = this.activeTab === 'expenses' || this.activeTab === 'liabilities';

		for (const acct of accounts) {
			const balance = this._acctBalance(balances, acct);
			const acctTxs = txs.filter(tx =>
				tx.postings.some(p => p.account === acct || p.account.startsWith(acct + ':'))
			);
			const txCount = acctTxs.length;
			const lastTx = acctTxs.at(-1);
			const thisMonthRaw = this._monthFlow(txs, acct, currentMonth);
			const thisMonthNorm = thisMonthRaw * sign; // normalized: positive = good

			// Sparkline: last 6 months of normalized flow
			const sparkData: number[] = [];
			for (let i = 5; i >= 0; i--) {
				const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
				const m = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
				sparkData.push(this._monthFlow(txs, acct, m) * sign);
			}

			const isSelected = this.selectedAccount === acct;
			const card = list.createDiv(`sl-accounts-card${isSelected ? ' sl-accounts-card-selected' : ''}`);

			// ── Card top ──
			const cardTop = card.createDiv('sl-accounts-card-top');
			const cardLeft = cardTop.createDiv('sl-accounts-card-left');

			// Account name: category prefix + rest
			const nameParts = acct.split(':');
			const catPrefix = nameParts[0] ?? '';
			const subName = nameParts.slice(1).join(':') || catPrefix;
			const nameRow = cardLeft.createDiv('sl-accounts-name-row');
			nameRow.createSpan({ text: catPrefix + ':', cls: `sl-accounts-cat-label sl-acct-cat-${this.activeTab}` });
			nameRow.createSpan({ text: subName, cls: 'sl-accounts-name' });

			// Balance
			const displayBalance = (this.activeTab === 'income' || this.activeTab === 'liabilities')
				? Math.abs(balance)
				: balance;
			const balanceCls = isExpenseOrLiab ? 'sl-negative' : (displayBalance >= 0 ? 'sl-positive' : 'sl-negative');
			cardLeft.createDiv({
				text: fmtAmount(displayBalance, settings),
				cls: `sl-accounts-balance ${balanceCls}`,
			});

			// Footer: tx count + last date
			const cardFooter = cardLeft.createDiv('sl-accounts-card-footer');
			cardFooter.createSpan({
				text: tn('view_accounts_tx_count_one', 'view_accounts_tx_count', txCount),
				cls: 'sl-accounts-tx-count',
			});
			if (lastTx) {
				cardFooter.createSpan({ text: ' · ', cls: 'sl-accounts-sep' });
				cardFooter.createSpan({
					text: t('view_accounts_last_tx', { date: lastTx.date }),
					cls: 'sl-accounts-last-tx',
				});
			}

			// ── Card right: sparkline + monthly change ──
			const cardRight = cardTop.createDiv('sl-accounts-card-right');

			// Mini sparkline
			const sparkEl = cardRight.createDiv('sl-accounts-sparkline');
			sparkEl.appendChild(this._buildSparkline(sparkData, this.activeTab));

			// Monthly change
			const changeRow = cardRight.createDiv('sl-accounts-change-row');
			if (thisMonthNorm !== 0) {
				const isGood = thisMonthNorm > 0;
				// For expenses: even "positive" normalized = reduced spending, but showing abs of raw
				const displayAmt = Math.abs(thisMonthRaw);
				const arrow = thisMonthRaw > 0 ? '↑' : '↓';
				// Color logic: expenses/liabilities raw positive = more spending/debt = red
				let changeCls: string;
				if (this.activeTab === 'expenses') {
					changeCls = thisMonthRaw > 0 ? 'sl-negative' : 'sl-positive';
				} else if (this.activeTab === 'liabilities') {
					changeCls = thisMonthRaw > 0 ? 'sl-positive' : 'sl-negative'; // positive = debt paid
				} else if (this.activeTab === 'income') {
					changeCls = 'sl-positive'; // income is always good
				} else {
					changeCls = thisMonthRaw > 0 ? 'sl-positive' : 'sl-negative';
				}
				changeRow.createSpan({
					text: `${arrow} ${fmtAmount(displayAmt, settings)}`,
					cls: `sl-accounts-change ${changeCls}`,
				});
			} else {
				changeRow.createSpan({ text: '—', cls: 'sl-accounts-change sl-accounts-change-neutral' });
			}
			changeRow.createSpan({ text: t('view_accounts_this_month'), cls: 'sl-accounts-change-label' });

			// ── Click to expand ──
			card.addEventListener('click', () => {
				this.selectedAccount = isSelected ? null : acct;
				this.render();
			});

			// ── Expanded detail ──────────────────────────────────────────────────
			if (isSelected) {
				const detail = card.createDiv('sl-accounts-detail');
				detail.addEventListener('click', e => e.stopPropagation());

				// Monthly flow table
				const monthSection = detail.createDiv('sl-accounts-detail-section');
				monthSection.createEl('h4', { text: t('view_accounts_detail_monthly'), cls: 'sl-accounts-detail-title' });

				const table = monthSection.createEl('table', { cls: 'sl-table sl-accounts-month-table' });
				const thead = table.createEl('thead').createEl('tr');
				thead.createEl('th', { text: t('view_accounts_col_month') });
				thead.createEl('th', { text: t('view_accounts_col_flow'), cls: 'sl-th-right' });
				thead.createEl('th', { text: t('view_accounts_col_balance'), cls: 'sl-th-right' });

				const tbody = table.createEl('tbody');

				// Compute running balance from before the 6-month window
				const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
				const cutoff = `${sixAgo.getFullYear()}/${String(sixAgo.getMonth() + 1).padStart(2, '0')}`;
				const preBal = this._acctBalance(
					LedgerParser.computeBalances(txs.filter(tx => tx.date < cutoff)),
					acct
				);
				let runningBal = preBal;

				for (let i = 5; i >= 0; i--) {
					const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
					const m = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
					const flow = this._monthFlow(txs, acct, m);
					runningBal += flow;
					const displayBal = (this.activeTab === 'income' || this.activeTab === 'liabilities')
						? Math.abs(runningBal)
						: runningBal;
					const isCurrent = i === 0;

					const tr = tbody.createEl('tr', { cls: isCurrent ? 'sl-accounts-current-row' : '' });
					tr.createEl('td', { text: m.substring(5) + (isCurrent ? ' ●' : '') });

					const flowCell = tr.createEl('td', { cls: 'sl-td-right' });
					if (flow !== 0) {
						const displayFlow = (this.activeTab === 'income') ? Math.abs(flow) : flow;
						const flowCls = this._flowColorCls(flow, this.activeTab);
						flowCell.createSpan({
							text: `${flow > 0 ? '+' : ''}${fmtAmount(displayFlow, settings)}`,
							cls: flowCls,
						});
					} else {
						flowCell.textContent = '—';
					}

					tr.createEl('td', {
						text: fmtAmount(Math.abs(displayBal), settings),
						cls: `sl-td-right ${isExpenseOrLiab ? 'sl-negative' : (runningBal >= 0 ? 'sl-positive' : 'sl-negative')}`,
					});
				}

				// Recent transactions
				const txSection = detail.createDiv('sl-accounts-detail-section');
				txSection.createEl('h4', { text: t('view_accounts_detail_recent_tx'), cls: 'sl-accounts-detail-title' });

				const recentTxs = [...acctTxs].reverse().slice(0, 12);
				if (recentTxs.length === 0) {
					txSection.createEl('p', { text: t('view_accounts_no_tx'), cls: 'sl-empty-msg' });
				} else {
					const txList = txSection.createDiv('sl-accounts-tx-list');
					for (const tx of recentTxs) {
						const posting = tx.postings.find(p =>
							p.account === acct || p.account.startsWith(acct + ':')
						);
						const amt = posting?.amount ?? 0;
						const row = txList.createDiv('sl-accounts-tx-row');
						row.createSpan({ text: tx.date, cls: 'sl-accounts-tx-date' });
						row.createSpan({ text: tx.payee, cls: 'sl-accounts-tx-payee' });
						row.createSpan({
							text: `${amt >= 0 ? '+' : ''}${fmtAmount(amt, settings)}`,
							cls: `sl-accounts-tx-amount ${amt >= 0 ? 'sl-positive' : 'sl-negative'}`,
						});
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
				}
			}
		}
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	private _summaryCard(
		parent: HTMLElement, title: string, amount: number, cls: string,
		info: { titleKey: string; descKey: string; formula: string | null; entries: [string, number][] }
	): void {
		const card = parent.createDiv(`sl-card ${cls} sl-card-has-info`);

		const infoBtn = card.createEl('button', { cls: 'sl-card-info-btn', attr: { title: t('card_info_btn_title') } });
		setIcon(infoBtn, 'info');
		infoBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			new CardInfoModal(this.app, this.plugin.settings, t(info.titleKey as any), t(info.descKey as any), info.formula, amount, info.entries).open();
		});

		card.createDiv({ text: title, cls: 'sl-card-title' });
		card.createDiv({ text: fmtAmount(Math.abs(amount), this.plugin.settings), cls: 'sl-card-amount' });
	}

	/** Collect unique accounts for a category from defaultAccounts + transaction postings. */
	private _collectAccounts(category: Category, balances: Record<string, number>): string[] {
		const prefix = CATEGORY_PREFIX[category];
		const set = new Set<string>();
		for (const acct of this.plugin.settings.defaultAccounts[category] ?? []) {
			set.add(acct);
		}
		for (const key of Object.keys(balances)) {
			if (key.startsWith(prefix)) set.add(key);
		}
		return [...set].sort();
	}

	/** Sum balance for an account and all its sub-accounts. */
	private _acctBalance(balances: Record<string, number>, account: string): number {
		let total = 0;
		for (const [key, val] of Object.entries(balances)) {
			if (key === account || key.startsWith(account + ':')) total += val;
		}
		return total;
	}

	/** Sum postings for an account (and sub-accounts) in a given YYYY/MM month. */
	private _monthFlow(txs: Transaction[], account: string, monthStr: string): number {
		let amount = 0;
		for (const tx of txs) {
			if (!tx.date.startsWith(monthStr)) continue;
			for (const p of tx.postings) {
				if ((p.account === account || p.account.startsWith(account + ':')) && p.amount !== null) {
					amount += p.amount;
				}
			}
		}
		return amount;
	}

	/** CSS class for flow coloring based on category semantics. */
	private _flowColorCls(flow: number, cat: Category): string {
		if (flow === 0) return '';
		if (cat === 'expenses') return flow > 0 ? 'sl-negative' : 'sl-positive';
		if (cat === 'liabilities') return flow > 0 ? 'sl-positive' : 'sl-negative';
		if (cat === 'income') return 'sl-positive';
		return flow > 0 ? 'sl-positive' : 'sl-negative';
	}

	/** Build a 6-bar mini sparkline SVG. Data is normalized (positive = good). */
	private _buildSparkline(data: number[], category: Category): SVGSVGElement {
		const barW = 9, gap = 3, h = 28;
		const totalW = data.length * (barW + gap) - gap;
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
		svg.setAttribute('viewBox', `0 0 ${totalW} ${h}`);
		svg.setAttribute('width', String(totalW));
		svg.setAttribute('height', String(h));
		svg.setAttribute('class', 'sl-sparkline-svg');

		const max = Math.max(...data.map(Math.abs), 1);

		for (let i = 0; i < data.length; i++) {
			const val = data[i] ?? 0;
			const barH = Math.max(2, (Math.abs(val) / max) * (h - 2));
			const x = i * (barW + gap);
			const y = h - barH;

			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			rect.setAttribute('x', String(x));
			rect.setAttribute('y', String(y));
			rect.setAttribute('width', String(barW));
			rect.setAttribute('height', String(barH));
			rect.setAttribute('rx', '2');

			let cls: string;
			if (val === 0) {
				cls = 'sl-spark-neutral';
			} else if (category === 'expenses') {
				// expenses: all bars are spending = always shown as red (negative normalized)
				cls = 'sl-spark-expense';
			} else if (category === 'income') {
				cls = 'sl-spark-income';
			} else {
				// assets/liabilities: green = good direction, red = bad
				cls = val > 0 ? 'sl-spark-positive' : 'sl-spark-negative';
			}
			rect.setAttribute('class', cls);
			svg.appendChild(rect);
		}
		return svg;
	}

	async onClose(): Promise<void> {}
}

class CardInfoModal extends Modal {
	private settings: PluginSettings;
	private title: string;
	private desc: string;
	private formula: string | null;
	private total: number;
	private entries: [string, number][];

	constructor(
		app: App,
		settings: PluginSettings,
		title: string,
		desc: string,
		formula: string | null,
		total: number,
		entries: [string, number][]
	) {
		super(app);
		this.settings = settings;
		this.title = title;
		this.desc = desc;
		this.formula = formula;
		this.total = total;
		this.entries = entries;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');

		contentEl.createEl('h2', { text: this.title, cls: 'sl-card-info-modal-title' });
		contentEl.createEl('p', { text: this.desc, cls: 'sl-card-info-modal-desc' });

		if (this.formula) {
			const formulaBox = contentEl.createDiv('sl-card-info-formula');
			formulaBox.createEl('code', { text: this.formula });
		}

		if (this.entries.length > 0) {
			const table = contentEl.createEl('table', { cls: 'sl-card-info-table' });
			const thead = table.createEl('thead');
			const hr = thead.createEl('tr');
			hr.createEl('th', { text: t('card_info_col_account') });
			hr.createEl('th', { text: t('card_info_col_balance'), cls: 'sl-td-right' });

			const tbody = table.createEl('tbody');
			for (const [acct, val] of this.entries) {
				const tr = tbody.createEl('tr');
				tr.createEl('td', { text: acct, cls: 'sl-card-info-acct' });
				tr.createEl('td', { text: fmtAmount(Math.abs(val), this.settings), cls: 'sl-td-right sl-card-info-amt' });
			}

			const tfoot = table.createEl('tfoot');
			const fr = tfoot.createEl('tr', { cls: 'sl-card-info-total-row' });
			fr.createEl('td', { text: t('card_info_total') });
			fr.createEl('td', { text: fmtAmount(Math.abs(this.total), this.settings), cls: 'sl-td-right' });
		}

		const closeBtn = contentEl.createEl('button', { text: t('common_close'), cls: 'sl-cancel-btn sl-card-info-close' });
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
