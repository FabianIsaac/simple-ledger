import { ISimpleLedgerPlugin } from '../types';
import { getNextDueDate, isRecurringPaidThisPeriod, FREQUENCY_LABELS } from '../utils/recurring';
import { fmtAmount, todayStr } from '../utils/formatting';

export function renderDebtsBlock(el: HTMLElement, plugin: ISimpleLedgerPlugin, source: string): void {
	let dias = 30;
	for (const line of source.split('\n')) {
		const m = line.trim().match(/^dias\s*[:=]\s*(\d+)$/i);
		if (m) dias = parseInt(m[1] ?? '30', 10);
	}

	const recs = plugin.settings.recurringTransactions ?? [];
	const txs = plugin.transactions ?? [];
	const today = todayStr();

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() + dias);
	const cutoff = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;

	const upcoming = recs
		.map(rec => ({
			rec,
			nextDue: getNextDueDate(rec),
			isPaid: isRecurringPaidThisPeriod(rec, txs),
		}))
		.filter(({ nextDue }) => nextDue <= cutoff)
		.sort((a, b) => a.nextDue.localeCompare(b.nextDue));

	const settings = plugin.settings;

	const header = el.createDiv('sl-debts-header');
	header.createEl('strong', { text: `Vencimientos próximos ${dias} días` });
	header.createSpan({ text: ` (${upcoming.length})`, cls: 'sl-debts-count' });

	if (upcoming.length === 0) {
		el.createEl('p', { text: `Sin vencimientos en los próximos ${dias} días`, cls: 'sl-empty-msg' });
		return;
	}

	const table = el.createEl('table', { cls: 'sl-debts-table' });
	const thead = table.createEl('thead');
	const headRow = thead.createEl('tr');
	for (const h of ['Vence', 'Descripción', 'Frecuencia', 'Monto', 'Cuenta']) {
		headRow.createEl('th', { text: h });
	}

	const tbody = table.createEl('tbody');
	for (const { rec, nextDue, isPaid } of upcoming) {
		const isToday = nextDue === today;
		let rowCls = 'sl-debt-row';
		if (isToday) rowCls += ' sl-debt-today';
		else if (isPaid) rowCls += ' sl-debt-paid';

		const row = tbody.createEl('tr', { cls: rowCls });

		const dateCell = row.createEl('td', { cls: 'sl-debt-date' });
		if (isToday) {
			dateCell.createSpan({ text: '● ', cls: 'sl-debt-today-dot' });
			dateCell.createSpan({ text: 'Hoy' });
		} else {
			dateCell.setText(nextDue.substring(5).replace('/', '/'));
		}

		row.createEl('td', { text: rec.payee, cls: 'sl-debt-name' });
		row.createEl('td', { text: FREQUENCY_LABELS[rec.frequency] ?? rec.frequency, cls: 'sl-debt-freq' });
		row.createEl('td', { text: fmtAmount(rec.amount, settings), cls: 'sl-debt-amount' });
		row.createEl('td', { text: rec.toAccount, cls: 'sl-debt-account' });
	}
}
