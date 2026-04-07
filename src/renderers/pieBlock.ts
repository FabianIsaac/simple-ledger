import { ISimpleLedgerPlugin } from '../types';
import { LedgerParser } from '../parser/LedgerParser';
import { ACCT } from '../constants';
import { parseBlockOptions, filterTransactions } from '../utils/filters';
import { computePieData, buildPieSvg } from '../utils/pieChart';
import { t } from '../i18n';

type Plugin = ISimpleLedgerPlugin;

function getTypeLabel(type: string): string {
	const labels: Record<string, string> = {
		expenses: t('view_main_pie_gastos'),
		income: t('view_main_pie_ingresos'),
		assets: t('view_main_pie_activos'),
		liabilities: t('view_main_pie_pasivos'),
	};
	return labels[type] ?? t('view_main_pie_gastos');
}

export function renderPieBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);

	const filteredTxs = filterTransactions([...txs], opts);
	const balances = LedgerParser.computeBalances(filteredTxs);

	const prefix = opts.type === 'income' ? ACCT.income
		: opts.type === 'assets' ? ACCT.assets
		: opts.type === 'liabilities' ? ACCT.liabilities
		: ACCT.expenses;

	const pieData = computePieData(balances, prefix, opts.level);

	const container = el.createDiv('sl-codeblock sl-pie-block');

	const title = container.createEl('h3', { text: getTypeLabel(opts.type), cls: 'sl-pie-block-title' });
	if (opts.level === 2) title.createSpan({ text: t('view_main_pie_subcuentas'), cls: 'sl-pie-block-subtitle' });

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

	if (pieData.length === 0) {
		container.createEl('p', { text: t('common_empty_no_data'), cls: 'sl-empty-msg' });
		return;
	}

	const svg = buildPieSvg(pieData, settings);
	container.appendChild(svg);
}
