import { PluginSettings, Transaction } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount } from '../utils/formatting';
import { parseBlockOptions, filterTransactions } from '../utils/filters';

interface Plugin {
	settings: PluginSettings;
	transactions: Transaction[];
}

export function renderSummaryBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);
	const container = el.createDiv('sl-codeblock sl-summary-block');

	const filteredTxs = filterTransactions([...txs], opts);

	if (opts.from || opts.to || opts.account || opts.search) {
		const infoDiv = container.createDiv('sl-filter-info');
		const parts: string[] = [];
		if (opts.from && opts.to && opts.from === opts.to) {
			parts.push(`Fecha: ${opts.from}`);
		} else {
			if (opts.from) parts.push(`Desde: ${opts.from}`);
			if (opts.to) parts.push(`Hasta: ${opts.to}`);
		}
		if (opts.account) parts.push(`Cuenta: ${opts.account}`);
		if (opts.search) parts.push(`Buscar: ${opts.search}`);
		infoDiv.createSpan({ text: '🔍 ' + parts.join(' · '), cls: 'sl-filter-text' });
	}

	const groups: Record<string, Transaction[]> = {};
	for (const tx of filteredTxs) {
		let key: string;
		if (opts.period === 'year') {
			key = tx.date.substring(0, 4);
		} else {
			key = tx.date.substring(0, 7);
		}
		if (!groups[key]) groups[key] = [];
		groups[key].push(tx);
	}

	if (Object.keys(groups).length === 0) {
		container.createEl('p', { text: 'Sin datos', cls: 'sl-empty-msg' });
		return;
	}

	const table = container.createEl('table', { cls: 'sl-table' });
	const thead = table.createEl('thead');
	const hr = thead.createEl('tr');
	hr.createEl('th', { text: 'Periodo' });
	hr.createEl('th', { text: 'Ingresos', cls: 'sl-th-right' });
	hr.createEl('th', { text: 'Gastos', cls: 'sl-th-right' });
	hr.createEl('th', { text: 'Neto', cls: 'sl-th-right' });

	const tbody = table.createEl('tbody');
	for (const [periodKey, groupTxs] of Object.entries(groups).sort()) {
		const balances = LedgerParser.computeBalances(groupTxs);
		const income = Object.entries(balances)
			.filter(([k]) => k.startsWith('Ingresos'))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const expenses = Object.entries(balances)
			.filter(([k]) => k.startsWith('Gastos'))
			.reduce((s, [, v]) => s + Math.abs(v), 0);
		const net = income - expenses;

		const tr = tbody.createEl('tr');
		tr.createEl('td', { text: periodKey });
		tr.createEl('td', { text: fmtAmount(income, settings), cls: 'sl-td-right sl-positive' });
		tr.createEl('td', { text: fmtAmount(expenses, settings), cls: 'sl-td-right sl-negative' });
		tr.createEl('td', {
			text: fmtAmount(net, settings),
			cls: `sl-td-right ${net >= 0 ? 'sl-positive' : 'sl-negative'}`,
		});
	}
}
