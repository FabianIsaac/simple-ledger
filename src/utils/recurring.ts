import { RecurringTransaction, Transaction } from '../types';
import { fmtDate } from './formatting';

export function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function getISOWeek(d: Date): number {
	const date = new Date(d.getTime());
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
	const week1 = new Date(date.getFullYear(), 0, 4);
	return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function getRecurringPeriodKey(rec: RecurringTransaction, date?: Date): string {
	const d = date ?? new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const w = getISOWeek(d);
	if (rec.frequency === 'weekly') return `${y}-W${String(w).padStart(2, '0')}`;
	if (rec.frequency === 'yearly') return `${y}`;
	return `${y}/${m}`;
}

export function isRecurringPaidThisPeriod(rec: RecurringTransaction, transactions: Transaction[]): boolean {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();

	let fromDate: string;
	let toDate: string;

	if (rec.frequency === 'monthly') {
		fromDate = `${y}/${String(m + 1).padStart(2, '0')}/01`;
		const lastDay = new Date(y, m + 1, 0).getDate();
		toDate = `${y}/${String(m + 1).padStart(2, '0')}/${String(lastDay).padStart(2, '0')}`;
	} else if (rec.frequency === 'yearly') {
		fromDate = `${y}/01/01`;
		toDate = `${y}/12/31`;
	} else {
		const day = now.getDay();
		const diff = day === 0 ? 6 : day - 1;
		const monday = new Date(now);
		monday.setDate(now.getDate() - diff);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		fromDate = fmtDate(monday);
		toDate = fmtDate(sunday);
	}

	return transactions.some(tx => {
		if (tx.date < fromDate || tx.date > toDate) return false;
		if (tx.payee.toLowerCase() !== rec.payee.toLowerCase()) return false;
		if (rec._isCreditPayment) {
			const principalPortion = rec._principalPortion ?? rec.amount;
			return tx.postings.some(p => p.account === rec.toAccount && Math.abs((p.amount ?? 0) - principalPortion) < 1);
		}
		return tx.postings.some(p => p.account === rec.toAccount && Math.abs((p.amount ?? 0) - rec.amount) < 1);
	});
}

export function getNextDueDate(rec: RecurringTransaction): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();

	if (rec.frequency === 'monthly') {
		const day = rec.dayOfMonth ?? 1;
		let due = new Date(y, m, day);
		if (due < now) due = new Date(y, m + 1, day);
		return fmtDate(due);
	} else if (rec.frequency === 'yearly') {
		const monthIdx = (rec.monthOfYear ?? 1) - 1;
		const day = rec.dayOfMonth ?? 1;
		let due = new Date(y, monthIdx, day);
		if (due < now) due = new Date(y + 1, monthIdx, day);
		return fmtDate(due);
	} else {
		const targetDay = rec.dayOfWeek ?? 1;
		const currentDay = now.getDay() === 0 ? 7 : now.getDay();
		let diff = targetDay - currentDay;
		if (diff <= 0) diff += 7;
		const due = new Date(now);
		due.setDate(now.getDate() + diff);
		return fmtDate(due);
	}
}

export const FREQUENCY_LABELS: Record<string, string> = {
	monthly: 'Mensual',
	weekly: 'Semanal',
	yearly: 'Anual',
};
