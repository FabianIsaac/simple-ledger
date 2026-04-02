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

/** Verifica si la recurrente fue pagada en el período que contiene `refDate`. */
function _isPaidInPeriod(rec: RecurringTransaction, transactions: Transaction[], refDate: Date): boolean {
	const y = refDate.getFullYear();
	const m = refDate.getMonth();

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
		const day = refDate.getDay();
		const diff = day === 0 ? 6 : day - 1;
		const monday = new Date(refDate);
		monday.setDate(refDate.getDate() - diff);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		fromDate = fmtDate(monday);
		toDate = fmtDate(sunday);
	}

	return transactions.some(tx => {
		if (tx.date < fromDate || tx.date > toDate) return false;
		if (tx.payee.toLowerCase() !== rec.payee.toLowerCase()) return false;
		return tx.postings.some(p => p.account === rec.toAccount);
	});
}

/** Verifica si la recurrente fue pagada en el período actual (hoy). */
export function isRecurringPaidThisPeriod(rec: RecurringTransaction, transactions: Transaction[]): boolean {
	return _isPaidInPeriod(rec, transactions, new Date());
}

/**
 * Devuelve la fecha de vencimiento más relevante para mostrar al usuario.
 *
 * Lógica:
 * 1. Calcula la fecha de vencimiento del período actual.
 * 2. Si esa fecha ya pasó y NO se ha pagado → es vencida (overdue), la devuelve.
 * 3. Si esa fecha ya pasó y SÍ se pagó → avanza al siguiente período.
 * 4. Si esa fecha es futura → revisa si el período ANTERIOR fue pagado.
 *    - Si el período anterior no fue pagado → devuelve su fecha (más vencida aún).
 *    - Si fue pagado → devuelve la fecha futura del período actual.
 *
 * Acepta opcionalmente un array de transacciones para la lógica completa,
 * o un booleano isPaid para compatibilidad con tests.
 */
export function getNextDueDate(rec: RecurringTransaction, txsOrIsPaid: Transaction[] | boolean = []): string {
	const now = new Date();
	const today = fmtDate(now);

	// Modo compatibilidad para tests (boolean)
	if (typeof txsOrIsPaid === 'boolean') {
		const isPaid = txsOrIsPaid;
		const y = now.getFullYear();
		const m = now.getMonth();
		if (rec.frequency === 'monthly') {
			const day = rec.dayOfMonth ?? 1;
			let due = new Date(y, m, day);
			if (isPaid && due <= now) due = new Date(y, m + 1, day);
			return fmtDate(due);
		} else if (rec.frequency === 'yearly') {
			const monthIdx = (rec.monthOfYear ?? 1) - 1;
			const day = rec.dayOfMonth ?? 1;
			let due = new Date(y, monthIdx, day);
			if (isPaid && due < now) due = new Date(y + 1, monthIdx, day);
			return fmtDate(due);
		} else {
			const targetDay = rec.dayOfWeek ?? 1;
			const currentDay = now.getDay() === 0 ? 7 : now.getDay();
			let diff = targetDay - currentDay;
			if (isPaid && diff <= 0) diff += 7;
			const due = new Date(now);
			due.setDate(now.getDate() + diff);
			return fmtDate(due);
		}
	}

	const transactions = txsOrIsPaid;

	// Solo mirar atrás si hay historial de esta recurrente; si es nueva no hay nada que marcar como vencido
	const hasHistory = transactions.some(tx => tx.payee.toLowerCase() === rec.payee.toLowerCase());

	if (rec.frequency === 'monthly') {
		const day = rec.dayOfMonth ?? 1;
		const thisMonthDue = fmtDate(new Date(now.getFullYear(), now.getMonth(), day));

		if (thisMonthDue <= today) {
			// La fecha de este mes ya llegó o pasó
			if (!_isPaidInPeriod(rec, transactions, now)) {
				return thisMonthDue; // vencida o vence hoy
			}
			return fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, day));
		} else if (hasHistory) {
			// La fecha es futura → revisar si el mes anterior fue pagado
			const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 15);
			if (!_isPaidInPeriod(rec, transactions, lastMonthRef)) {
				return fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, day));
			}
		}
		return thisMonthDue;
	} else if (rec.frequency === 'yearly') {
		const monthIdx = (rec.monthOfYear ?? 1) - 1;
		const day = rec.dayOfMonth ?? 1;
		const thisYearDue = fmtDate(new Date(now.getFullYear(), monthIdx, day));

		if (thisYearDue <= today) {
			if (!_isPaidInPeriod(rec, transactions, now)) {
				return thisYearDue;
			}
			return fmtDate(new Date(now.getFullYear() + 1, monthIdx, day));
		} else if (hasHistory) {
			const lastYearRef = new Date(now.getFullYear() - 1, 6, 1);
			if (!_isPaidInPeriod(rec, transactions, lastYearRef)) {
				return fmtDate(new Date(now.getFullYear() - 1, monthIdx, day));
			}
		}
		return thisYearDue;
	} else {
		// Weekly
		const targetDay = rec.dayOfWeek ?? 1;
		const currentDay = now.getDay() === 0 ? 7 : now.getDay();
		const diff = targetDay - currentDay;
		const thisWeekDue = new Date(now);
		thisWeekDue.setDate(now.getDate() + diff);
		const thisWeekDueStr = fmtDate(thisWeekDue);

		if (thisWeekDueStr <= today) {
			if (!_isPaidInPeriod(rec, transactions, now)) {
				return thisWeekDueStr;
			}
			const nextWeekDue = new Date(thisWeekDue);
			nextWeekDue.setDate(thisWeekDue.getDate() + 7);
			return fmtDate(nextWeekDue);
		} else if (hasHistory) {
			const lastWeekRef = new Date(now);
			lastWeekRef.setDate(now.getDate() - 7);
			if (!_isPaidInPeriod(rec, transactions, lastWeekRef)) {
				const lastWeekDue = new Date(thisWeekDue);
				lastWeekDue.setDate(thisWeekDue.getDate() - 7);
				return fmtDate(lastWeekDue);
			}
		}
		return thisWeekDueStr;
	}
}

export const FREQUENCY_LABELS: Record<string, string> = {
	monthly: 'Mensual',
	weekly: 'Semanal',
	yearly: 'Anual',
};
