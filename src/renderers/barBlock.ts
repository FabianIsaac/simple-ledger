import { ISimpleLedgerPlugin } from '../types';
import { parseBlockOptions, filterTransactions } from '../utils/filters';
import { buildBarContent } from '../utils/barChart';
import { t } from '../i18n';

type Plugin = ISimpleLedgerPlugin;

export function renderBarBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);
	const filteredTxs = filterTransactions([...txs], opts);

	const container = el.createDiv('sl-codeblock sl-bar-block');

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

	buildBarContent(container, filteredTxs, settings, opts.period);
}
