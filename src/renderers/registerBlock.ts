import { ISimpleLedgerPlugin } from '../types';
import { ACCT } from '../constants';
import { fmtAmount } from '../utils/formatting';
import { parseBlockOptions, filterTransactions } from '../utils/filters';
import { t, tn } from '../i18n';

type Plugin = ISimpleLedgerPlugin;

function acctLabelColor(account: string): string {
	if (account.startsWith(ACCT.expenses)) return 'sl-label-expense';
	if (account.startsWith(ACCT.liabilities)) return 'sl-label-liability';
	if (account.startsWith(ACCT.income)) return 'sl-label-income';
	return '';
}

export function renderRegisterBlock(el: HTMLElement, plugin: Plugin, source: string): void {
	const settings = plugin.settings;
	const txs = plugin.transactions ?? [];
	const opts = parseBlockOptions(source);
	const container = el.createDiv('sl-codeblock sl-register-block');

	const filtered = filterTransactions([...txs], opts);

	// Filter info badge
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

	if (filtered.length === 0) {
		container.createEl('p', { text: t('common_empty_no_tx'), cls: 'sl-empty-msg' });
		return;
	}

	// Header count
	const listHeader = container.createDiv('sl-block-list-header');
	listHeader.createSpan({ text: tn('renderer_block_tx_count_one', 'renderer_block_tx_count_many', filtered.length), cls: 'sl-block-list-count' });

	const list = container.createDiv('sl-tx-list-main sl-block-tx-list');

	for (const tx of filtered) {
		const posPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
		const totalAmt = tx.postings
			.filter(p => (p.amount ?? 0) > 0)
			.reduce((s, p) => s + (p.amount ?? 0), 0);
		const isExpense = posPosting && posPosting.account.startsWith(ACCT.expenses);
		const isLiability = posPosting && posPosting.account.startsWith(ACCT.liabilities);
		const amtColor = (isExpense || isLiability) ? 'sl-negative' : 'sl-positive';

		const item = list.createDiv('sl-tx-item');

		const left = item.createDiv('sl-tx-item-left');

		const topRow = left.createDiv('sl-tx-item-top');
		topRow.createSpan({ text: tx.date, cls: 'sl-tx-item-date' });
		const payeeSpan = topRow.createSpan({ text: tx.payee, cls: 'sl-tx-item-payee' });
		if (tx.notes) {
			payeeSpan.setAttribute('title', tx.notes);
			topRow.createSpan({ text: 'ⓘ', cls: 'sl-tx-item-note-icon', attr: { title: tx.notes } });
		}

		if (tx.postings.length <= 2) {
			const negPosting = tx.postings.find(p => (p.amount ?? 0) < 0) ?? tx.postings[1];
			const bottomRow = left.createDiv('sl-tx-item-bottom');
			const negAcct = negPosting?.account ?? '';
			const posAcct = posPosting?.account ?? '';
			bottomRow.createSpan({ text: negAcct, cls: `sl-tx-item-account ${acctLabelColor(negAcct)}` });
			bottomRow.createSpan({ text: '→', cls: 'sl-tx-item-arrow' });
			bottomRow.createSpan({ text: posAcct, cls: `sl-tx-item-account ${acctLabelColor(posAcct)}` });
		} else {
			const postingsContainer = left.createDiv('sl-tx-item-postings');
			for (const p of tx.postings) {
				const pRow = postingsContainer.createDiv('sl-tx-posting-row');
				pRow.createSpan({ text: p.account, cls: `sl-tx-posting-account ${acctLabelColor(p.account)}` });
				if (p.amount !== null) {
					const sign = p.amount >= 0 ? '+' : '';
					pRow.createSpan({
						text: sign + fmtAmount(p.amount, settings),
						cls: `sl-tx-posting-amount ${p.amount >= 0 ? 'sl-positive' : 'sl-negative'}`,
					});
				}
			}
		}

		const right = item.createDiv('sl-tx-item-right');
		right.createDiv({ text: fmtAmount(totalAmt, settings), cls: `sl-tx-item-amount ${amtColor}` });
	}
}
