import { ISimpleLedgerPlugin } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { ACCT } from '../constants';
import { parseBlockOptions, filterTransactions } from '../utils/filters';
import { computePieData, buildPieSvg } from '../utils/pieChart';

type Plugin = ISimpleLedgerPlugin;

const TIPO_LABELS: Record<string, string> = {
	gastos: 'Distribución de Gastos',
	ingresos: 'Distribución de Ingresos',
	activos: 'Distribución de Activos',
	pasivos: 'Distribución de Pasivos',
};

export function renderPieBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);

	const filteredTxs = filterTransactions([...txs], opts);
	const balances = LedgerParser.computeBalances(filteredTxs);

	const prefix = opts.tipo === 'ingresos' ? ACCT.income
		: opts.tipo === 'activos' ? ACCT.assets
		: opts.tipo === 'pasivos' ? ACCT.liabilities
		: ACCT.expenses;

	const pieData = computePieData(balances, prefix, opts.nivel);

	const container = el.createDiv('sl-codeblock sl-pie-block');

	const title = container.createEl('h3', { text: TIPO_LABELS[opts.tipo] ?? 'Distribución', cls: 'sl-pie-block-title' });
	if (opts.nivel === 2) title.createSpan({ text: ' — Sub-cuentas', cls: 'sl-pie-block-subtitle' });

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

	if (pieData.length === 0) {
		container.createEl('p', { text: 'Sin datos para mostrar', cls: 'sl-empty-msg' });
		return;
	}

	const svg = buildPieSvg(pieData, settings);
	container.appendChild(svg);
}
