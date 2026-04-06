import { ISimpleLedgerPlugin } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount } from '../utils/formatting';
import { parseBlockOptions, filterTransactions } from '../utils/filters';
import { t } from '../i18n';

type Plugin = ISimpleLedgerPlugin;

export function renderBalanceBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);

	const filteredTxs = filterTransactions([...txs], opts);
	const balances = LedgerParser.computeBalances(filteredTxs);

	const container = el.createDiv('sl-codeblock sl-balance-block');

	const filtered: Record<string, number> = {};
	for (const [acct, amt] of Object.entries(balances)) {
		if (!opts.account || acct.toLowerCase().includes(opts.account.toLowerCase())) {
			filtered[acct] = amt;
		}
	}

	if (opts.from || opts.to || opts.account || opts.search) {
		const infoDiv = container.createDiv('sl-filter-info');
		const parts: string[] = [];
		if (opts.from && opts.to && opts.from === opts.to) {
			parts.push(t('renderer_filter_date', { date: opts.from }));
		} else {
			if (opts.from) parts.push(t('renderer_filter_from', { from: opts.from }));
			if (opts.to) parts.push(t('renderer_filter_to', { to: opts.to }));
		}
		if (opts.account) parts.push(t('renderer_filter_account', { account: opts.account }));
		if (opts.search) parts.push(t('renderer_filter_search', { search: opts.search }));
		infoDiv.createSpan({ text: '🔍 ' + parts.join(' · '), cls: 'sl-filter-text' });
	}

	if (Object.keys(filtered).length === 0) {
		container.createEl('p', { text: t('common_empty_no_results'), cls: 'sl-empty-msg' });
		return;
	}

	const table = container.createEl('table', { cls: 'sl-table' });
	const thead = table.createEl('thead');
	const hr = thead.createEl('tr');
	hr.createEl('th', { text: t('renderer_balance_col_account') });
	hr.createEl('th', { text: t('renderer_balance_col_balance'), cls: 'sl-th-right' });

	const tbody = table.createEl('tbody');
	const sorted = Object.entries(filtered).sort((a, b) => a[0].localeCompare(b[0]));
	for (const [acct, amt] of sorted) {
		const tr = tbody.createEl('tr');
		tr.createEl('td', { text: acct });
		tr.createEl('td', {
			text: fmtAmount(amt, settings),
			cls: `sl-td-right ${amt >= 0 ? 'sl-positive' : 'sl-negative'}`,
		});
	}

	const totalAmt = Object.values(filtered).reduce((s, v) => s + v, 0);
	const tfoot = table.createEl('tfoot');
	const totalRow = tfoot.createEl('tr', { cls: 'sl-total-row' });
	totalRow.createEl('td', { text: t('renderer_balance_total') });
	totalRow.createEl('td', {
		text: fmtAmount(totalAmt, settings),
		cls: `sl-td-right ${totalAmt >= 0 ? 'sl-positive' : 'sl-negative'}`,
	});
}
