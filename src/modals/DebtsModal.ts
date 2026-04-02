import { App, Modal } from 'obsidian';
import { ISimpleLedgerPlugin } from '../types';
import { getNextDueDate, isRecurringPaidThisPeriod, FREQUENCY_LABELS } from '../utils/recurring';
import { fmtAmount, todayStr } from '../utils/formatting';

export class DebtsModal extends Modal {
	private plugin: ISimpleLedgerPlugin;

	constructor(app: App, plugin: ISimpleLedgerPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('sl-debts-modal');
		contentEl.createEl('h2', { text: 'Vencimientos' });
		this._renderList(contentEl);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private _renderList(container: HTMLElement): void {
		container.find('.sl-debts-modal-body')?.remove();
		const body = container.createDiv('sl-debts-modal-body');

		const recs = this.plugin.settings.recurringTransactions ?? [];
		const txs = this.plugin.transactions ?? [];
		const today = todayStr();
		const settings = this.plugin.settings;

		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() + 60);
		const cutoff = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;

		const items = recs
			.map(rec => {
				const isPaid = isRecurringPaidThisPeriod(rec, txs);
				return { rec, isPaid, nextDue: getNextDueDate(rec, txs) };
			})
			.filter(({ isPaid, nextDue }) => !isPaid || nextDue <= cutoff)
			.sort((a, b) => a.nextDue.localeCompare(b.nextDue));

		if (items.length === 0) {
			body.createEl('p', { text: 'Sin vencimientos en los próximos 60 días', cls: 'sl-empty-msg' });
			return;
		}

		for (const { rec, nextDue, isPaid } of items) {
			const isToday = nextDue === today;

			let rowCls = 'sl-debts-modal-row';
			if (isToday) rowCls += ' sl-debts-modal-today';
			if (isPaid) rowCls += ' sl-debts-modal-paid';

			const row = body.createDiv(rowCls);

			// Left: date + info
			const left = row.createDiv('sl-debts-modal-left');

			const dateEl = left.createDiv('sl-debts-modal-date');
			if (isToday) {
				dateEl.createSpan({ text: '●', cls: 'sl-debts-today-dot' });
				dateEl.createSpan({ text: ' Hoy', cls: 'sl-debts-today-text' });
			} else {
				dateEl.setText(nextDue.substring(5));
			}

			const info = left.createDiv('sl-debts-modal-info');
			info.createDiv({ text: rec.payee, cls: 'sl-debts-modal-payee' });
			info.createDiv({ text: FREQUENCY_LABELS[rec.frequency] ?? rec.frequency, cls: 'sl-debts-modal-freq' });

			// Right: amount + action
			const right = row.createDiv('sl-debts-modal-right');
			right.createDiv({ text: fmtAmount(rec.amount, settings), cls: 'sl-debts-modal-amount' });

			if (isPaid) {
				right.createEl('span', { text: '✓ Pagado', cls: 'sl-debts-modal-paid-badge' });
			} else {
				const payBtn = right.createEl('button', {
					text: 'Registrar pago',
					cls: 'sl-debts-modal-pay-btn mod-cta',
				});
				payBtn.addEventListener('click', async () => {
					payBtn.disabled = true;
					payBtn.setText('...');
					if (rec._isCreditPayment) {
						await this.plugin.addCreditPayment(rec);
					} else {
						await this.plugin.registerRecurringPayment(rec);
					}
					this._renderList(container);
				});
			}
		}
	}
}
