import { ISimpleLedgerPlugin } from '../types';
import { fmtAmount } from '../utils/formatting';
import { parseBlockOptions, filterTransactions } from '../utils/filters';

type Plugin = ISimpleLedgerPlugin;

export function renderRegisterBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);
	const container = el.createDiv('sl-codeblock sl-register-block');

	const filtered = filterTransactions([...txs], opts);

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

	if (filtered.length === 0) {
		container.createEl('p', { text: 'Sin transacciones', cls: 'sl-empty-msg' });
		return;
	}

	const table = container.createEl('table', { cls: 'sl-table sl-register-table' });
	const thead = table.createEl('thead');
	const hr = thead.createEl('tr');
	hr.createEl('th', { text: 'Fecha' });
	hr.createEl('th', { text: 'Descripcion' });
	hr.createEl('th', { text: 'Cuenta' });
	hr.createEl('th', { text: 'Monto', cls: 'sl-th-right' });

	const tbody = table.createEl('tbody');
	for (const tx of filtered) {
		for (let i = 0; i < tx.postings.length; i++) {
			const p = tx.postings[i]!;
			const tr = tbody.createEl('tr');
			tr.createEl('td', { text: i === 0 ? tx.date : '', cls: 'sl-td-date' });
			tr.createEl('td', { text: i === 0 ? tx.payee : '', cls: 'sl-td-payee' });
			tr.createEl('td', { text: p.account });
			tr.createEl('td', {
				text: p.amount !== null ? fmtAmount(p.amount, settings) : '',
				cls: `sl-td-right ${(p.amount ?? 0) >= 0 ? 'sl-positive' : 'sl-negative'}`,
			});
		}
	}
}
