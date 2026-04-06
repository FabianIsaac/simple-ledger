import { ISimpleLedgerPlugin } from '../types';
import { ACCT } from '../constants';
import { getNextDueDate, isRecurringPaidThisPeriod, FREQUENCY_LABELS } from '../utils/recurring';
import { fmtAmount, todayStr } from '../utils/formatting';
import { t } from '../i18n';

export function renderDebtsBlock(el: HTMLElement, plugin: ISimpleLedgerPlugin, source: string): void {
	let dias = 30;
	for (const line of source.split('\n')) {
		const m = line.trim().match(/^dias\s*[:=]\s*(\d+)$/i);
		if (m) dias = parseInt(m[1] ?? '30', 10);
	}

	const recs = plugin.settings.recurringTransactions ?? [];
	const txs = plugin.transactions ?? [];
	const settings = plugin.settings;
	const today = todayStr();

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() + dias);
	const cutoff = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;

	const upcoming = recs
		.map(rec => {
			const isPaid = isRecurringPaidThisPeriod(rec, txs);
			return { rec, isPaid, nextDue: getNextDueDate(rec, txs) };
		})
		.filter(({ isPaid, nextDue }) => !isPaid || nextDue <= cutoff)
		.sort((a, b) => a.nextDue.localeCompare(b.nextDue));

	const container = el.createDiv('sl-codeblock sl-debts-block');

	// Header
	const header = container.createDiv('sl-block-list-header');
	header.createSpan({ text: t('renderer_debts_title', { n: dias }), cls: 'sl-block-list-count' });
	if (upcoming.length > 0) {
		header.createSpan({ text: `(${upcoming.length})`, cls: 'sl-tx-count' });
	}

	if (upcoming.length === 0) {
		container.createEl('p', { text: t('renderer_debts_empty', { n: dias }), cls: 'sl-empty-msg' });
		return;
	}

	const list = container.createDiv('sl-debts-list');

	for (const { rec, nextDue, isPaid } of upcoming) {
		const isToday = nextDue === today;
		const isOverdue = nextDue < today && !isPaid;
		const isExpense = rec.toAccount.startsWith(ACCT.expenses) || rec.toAccount.startsWith(ACCT.liabilities);

		const card = list.createDiv('sl-debt-card');
		if (isPaid) card.addClass('sl-debt-card-paid');
		else if (isToday) card.addClass('sl-debt-card-today');
		else if (isOverdue) card.addClass('sl-debt-card-overdue');

		// Left: date badge + info
		const cardLeft = card.createDiv('sl-debt-card-left');

		const dateBadge = cardLeft.createDiv('sl-debt-date-badge');
		if (isToday) {
			dateBadge.addClass('sl-debt-badge-today');
			dateBadge.createDiv({ text: 'HOY', cls: 'sl-debt-badge-day' });
		} else if (isOverdue) {
			dateBadge.addClass('sl-debt-badge-overdue');
			dateBadge.createDiv({ text: nextDue.substring(8), cls: 'sl-debt-badge-day' });
			dateBadge.createDiv({ text: nextDue.substring(5, 7), cls: 'sl-debt-badge-month' });
		} else {
			dateBadge.createDiv({ text: nextDue.substring(8), cls: 'sl-debt-badge-day' });
			dateBadge.createDiv({ text: nextDue.substring(5, 7), cls: 'sl-debt-badge-month' });
		}

		const info = cardLeft.createDiv('sl-debt-card-info');
		info.createDiv({ text: rec.payee, cls: 'sl-debt-card-payee' });
		const meta = info.createDiv('sl-debt-card-meta');
		meta.createSpan({ text: FREQUENCY_LABELS[rec.frequency] ?? rec.frequency, cls: 'sl-debt-card-freq' });
		meta.createSpan({ text: '·', cls: 'sl-debt-meta-sep' });
		meta.createSpan({ text: rec.toAccount, cls: 'sl-debt-card-account' });

		// Right: amount + status
		const cardRight = card.createDiv('sl-debt-card-right');
		cardRight.createDiv({
			text: fmtAmount(rec.amount, settings),
			cls: `sl-debt-card-amount ${isExpense ? 'sl-negative' : 'sl-positive'}`,
		});
		if (isPaid) {
			cardRight.createDiv({ text: t('renderer_debts_paid_status'), cls: 'sl-debt-card-status sl-debt-status-paid' });
		} else if (isToday) {
			cardRight.createDiv({ text: t('renderer_debts_today_status'), cls: 'sl-debt-card-status sl-debt-status-today' });
		} else if (isOverdue) {
			cardRight.createDiv({ text: t('renderer_debts_overdue_status'), cls: 'sl-debt-card-status sl-debt-status-overdue' });
		}
	}
}
