import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	generateId,
	getISOWeek,
	getRecurringPeriodKey,
	isRecurringPaidThisPeriod,
	getNextDueDate,
} from '../../utils/recurring';
import type { RecurringTransaction, Transaction } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

// Fixed fake date: March 15, 2024 (Friday, ISO week 11)
const FAKE_NOW = new Date(2024, 2, 15, 12, 0, 0); // local time to avoid TZ issues

function makeRec(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
	return {
		id: 'test-id',
		payee: 'Test Pago',
		amount: 1000,
		toAccount: 'Gastos:Alquiler',
		fromAccount: 'Activos:Banco',
		frequency: 'monthly',
		status: '*',
		...overrides,
	};
}

function makeTx(date: string, payee: string, toAccount: string, amount: number): Transaction {
	return {
		date,
		status: '*',
		payee,
		postings: [
			{ account: toAccount, amount, currency: '' },
			{ account: 'Activos:Banco', amount: -amount, currency: '' },
		],
		lineStart: 0,
		lineEnd: 3,
	};
}

// ─── generateId ────────────────────────────────────────────────────────────

describe('generateId', () => {
	it('returns a non-empty string', () => {
		const id = generateId();
		expect(typeof id).toBe('string');
		expect(id.length).toBeGreaterThan(0);
	});

	it('produces unique values across many calls', () => {
		const ids = new Set(Array.from({ length: 200 }, () => generateId()));
		expect(ids.size).toBe(200);
	});
});

// ─── getISOWeek ────────────────────────────────────────────────────────────

describe('getISOWeek', () => {
	it('returns week 1 for January 1, 2024 (Monday → start of week 1)', () => {
		expect(getISOWeek(new Date(2024, 0, 1))).toBe(1);
	});

	it('returns week 1 for January 7, 2024 (Sunday → last day of week 1)', () => {
		expect(getISOWeek(new Date(2024, 0, 7))).toBe(1);
	});

	it('returns week 2 for January 8, 2024 (Monday → first day of week 2)', () => {
		expect(getISOWeek(new Date(2024, 0, 8))).toBe(2);
	});

	it('returns week 11 for March 15, 2024', () => {
		// Mar 11 (Mon) to Mar 17 (Sun) is week 11 of 2024
		expect(getISOWeek(new Date(2024, 2, 15))).toBe(11);
	});

	it('returns week 1 for March 15, 2021 (week 11)', () => {
		// Quick sanity: first week of 2021
		expect(getISOWeek(new Date(2021, 0, 4))).toBe(1);
	});
});

// ─── getRecurringPeriodKey ─────────────────────────────────────────────────

describe('getRecurringPeriodKey', () => {
	it('returns YYYY/MM for monthly frequency', () => {
		const rec = makeRec({ frequency: 'monthly' });
		expect(getRecurringPeriodKey(rec, new Date(2024, 2, 15))).toBe('2024/03');
	});

	it('returns YYYY/MM with zero-padded month', () => {
		const rec = makeRec({ frequency: 'monthly' });
		expect(getRecurringPeriodKey(rec, new Date(2024, 8, 1))).toBe('2024/09');
	});

	it('returns YYYY-WNN for weekly frequency', () => {
		const rec = makeRec({ frequency: 'weekly' });
		// March 15, 2024 is ISO week 11
		expect(getRecurringPeriodKey(rec, new Date(2024, 2, 15))).toBe('2024-W11');
	});

	it('returns YYYY for yearly frequency', () => {
		const rec = makeRec({ frequency: 'yearly' });
		expect(getRecurringPeriodKey(rec, new Date(2024, 2, 15))).toBe('2024');
	});

	it('uses current date when no date argument is provided', () => {
		const rec = makeRec({ frequency: 'monthly' });
		expect(getRecurringPeriodKey(rec)).toMatch(/^\d{4}\/\d{2}$/);
	});
});

// ─── isRecurringPaidThisPeriod ─────────────────────────────────────────────

describe('isRecurringPaidThisPeriod', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FAKE_NOW); // March 15, 2024 (Friday)
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// Monthly ──────────────────────────────────────────────────────────────

	it('returns true when a matching transaction exists in the current month', () => {
		const rec = makeRec({ payee: 'Alquiler', toAccount: 'Gastos:Alquiler', amount: 1000 });
		const tx = makeTx('2024/03/05', 'Alquiler', 'Gastos:Alquiler', 1000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(true);
	});

	it('returns false when the matching transaction is from the previous month', () => {
		const rec = makeRec({ payee: 'Alquiler', toAccount: 'Gastos:Alquiler', amount: 1000 });
		const tx = makeTx('2024/02/28', 'Alquiler', 'Gastos:Alquiler', 1000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(false);
	});

	it('returns false when transactions list is empty', () => {
		const rec = makeRec({ payee: 'Alquiler', toAccount: 'Gastos:Alquiler', amount: 1000 });
		expect(isRecurringPaidThisPeriod(rec, [])).toBe(false);
	});

	it('returns false when payee does not match', () => {
		const rec = makeRec({ payee: 'Alquiler', toAccount: 'Gastos:Alquiler', amount: 1000 });
		const tx = makeTx('2024/03/05', 'Internet', 'Gastos:Alquiler', 1000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(false);
	});

	it('returns false when toAccount does not match', () => {
		const rec = makeRec({ payee: 'Alquiler', toAccount: 'Gastos:Alquiler', amount: 1000 });
		const tx = makeTx('2024/03/05', 'Alquiler', 'Gastos:Vivienda', 1000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(false);
	});

	it('payee matching is case-insensitive', () => {
		const rec = makeRec({ payee: 'ALQUILER', toAccount: 'Gastos:Alquiler', amount: 1000 });
		const tx = makeTx('2024/03/05', 'alquiler', 'Gastos:Alquiler', 1000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(true);
	});

	it('returns true even when amount differs (e.g. late fees) as long as payee and account match', () => {
		const rec = makeRec({ payee: 'Alquiler', toAccount: 'Gastos:Alquiler', amount: 1000 });
		const tx = makeTx('2024/03/05', 'Alquiler', 'Gastos:Alquiler', 1080); // paid with late fee
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(true);
	});

	// Weekly ───────────────────────────────────────────────────────────────

	it('returns true when transaction falls within the current week (weekly)', () => {
		// Fake date: Friday March 15 → week is Mon Mar 11 to Sun Mar 17
		const rec = makeRec({ frequency: 'weekly', payee: 'Gym', toAccount: 'Gastos:Salud', amount: 50 });
		const tx = makeTx('2024/03/13', 'Gym', 'Gastos:Salud', 50); // Wednesday
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(true);
	});

	it('returns false when transaction is from the previous week (weekly)', () => {
		const rec = makeRec({ frequency: 'weekly', payee: 'Gym', toAccount: 'Gastos:Salud', amount: 50 });
		const tx = makeTx('2024/03/06', 'Gym', 'Gastos:Salud', 50); // last Wednesday
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(false);
	});

	// Yearly ───────────────────────────────────────────────────────────────

	it('returns true when transaction is from the current year (yearly)', () => {
		const rec = makeRec({ frequency: 'yearly', payee: 'Seguro', toAccount: 'Gastos:Seguro', amount: 2000 });
		const tx = makeTx('2024/01/15', 'Seguro', 'Gastos:Seguro', 2000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(true);
	});

	it('returns false when transaction is from the previous year (yearly)', () => {
		const rec = makeRec({ frequency: 'yearly', payee: 'Seguro', toAccount: 'Gastos:Seguro', amount: 2000 });
		const tx = makeTx('2023/01/15', 'Seguro', 'Gastos:Seguro', 2000);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(false);
	});

	// Credit payments ──────────────────────────────────────────────────────

	it('matches credit payments by payee and account within the period', () => {
		const rec = makeRec({
			payee: 'Prestamo',
			toAccount: 'Pasivos:Prestamo',
			amount: 1200,
			_isCreditPayment: true,
			_principalPortion: 900,
		});
		const tx = makeTx('2024/03/05', 'Prestamo', 'Pasivos:Prestamo', 900);
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(true);
	});

	it('returns false for credit payment when account does not match', () => {
		const rec = makeRec({
			payee: 'Prestamo',
			toAccount: 'Pasivos:Prestamo',
			amount: 1200,
			_isCreditPayment: true,
			_principalPortion: 900,
		});
		const tx = makeTx('2024/03/05', 'Prestamo', 'Gastos:Otros', 900); // wrong account
		expect(isRecurringPaidThisPeriod(rec, [tx])).toBe(false);
	});
});

// ─── getNextDueDate ────────────────────────────────────────────────────────

describe('getNextDueDate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FAKE_NOW); // March 15, 2024 (Friday)
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// Monthly ──────────────────────────────────────────────────────────────

	it('returns the due date in the current month when the day is still upcoming', () => {
		// Today is March 15 → day 20 is still in the future
		const rec = makeRec({ frequency: 'monthly', dayOfMonth: 20 });
		expect(getNextDueDate(rec)).toBe('2024/03/20');
	});

	it('returns the overdue date (same month) when unpaid and day has already passed', () => {
		// Today is March 15, day 10 passed — not paid → show March 10 (overdue)
		const rec = makeRec({ frequency: 'monthly', dayOfMonth: 10 });
		expect(getNextDueDate(rec, false)).toBe('2024/03/10');
	});

	it('advances to next month when already paid and day has passed', () => {
		// Today is March 15, day 10 passed — paid → advance to April 10
		const rec = makeRec({ frequency: 'monthly', dayOfMonth: 10 });
		expect(getNextDueDate(rec, true)).toBe('2024/04/10');
	});

	it('defaults to day 1 and shows overdue when dayOfMonth is not set and unpaid', () => {
		// March 1 has passed, unpaid → March 1 (overdue)
		const rec = makeRec({ frequency: 'monthly' });
		expect(getNextDueDate(rec, false)).toBe('2024/03/01');
	});

	it('defaults to day 1 and advances when paid', () => {
		// March 1 has passed, paid → April 1
		const rec = makeRec({ frequency: 'monthly' });
		expect(getNextDueDate(rec, true)).toBe('2024/04/01');
	});

	// Yearly ───────────────────────────────────────────────────────────────

	it('returns the due date in the current year when it has not yet passed', () => {
		// Today is March 15 → June 15 is still ahead
		const rec = makeRec({ frequency: 'yearly', dayOfMonth: 15, monthOfYear: 6 });
		expect(getNextDueDate(rec)).toBe('2024/06/15');
	});

	it('returns the overdue date (same year) when unpaid and date has already passed', () => {
		// Today is March 15, Jan 1 passed — unpaid → Jan 1, 2024
		const rec = makeRec({ frequency: 'yearly', dayOfMonth: 1, monthOfYear: 1 });
		expect(getNextDueDate(rec, false)).toBe('2024/01/01');
	});

	it('advances to next year when already paid and date has passed', () => {
		// Today is March 15, Jan 1 passed — paid → Jan 1, 2025
		const rec = makeRec({ frequency: 'yearly', dayOfMonth: 1, monthOfYear: 1 });
		expect(getNextDueDate(rec, true)).toBe('2025/01/01');
	});

	it('defaults to January 1 and advances to next year when paid', () => {
		const rec = makeRec({ frequency: 'yearly' });
		expect(getNextDueDate(rec, true)).toBe('2025/01/01');
	});

	// Weekly ───────────────────────────────────────────────────────────────

	it('returns overdue Monday (this week) when today is Friday and unpaid', () => {
		// Friday March 15, dayOfWeek=1 → diff=1-5=-4 → March 11 (overdue)
		const rec = makeRec({ frequency: 'weekly', dayOfWeek: 1 });
		expect(getNextDueDate(rec, false)).toBe('2024/03/11');
	});

	it('returns next Monday when today is Friday and paid', () => {
		// Friday March 15, dayOfWeek=1 → paid → March 18
		const rec = makeRec({ frequency: 'weekly', dayOfWeek: 1 });
		expect(getNextDueDate(rec, true)).toBe('2024/03/18');
	});

	it('returns today when target weekday matches today and unpaid', () => {
		// Friday March 15, dayOfWeek=5 → diff=0 → March 15 (due today)
		const rec = makeRec({ frequency: 'weekly', dayOfWeek: 5 });
		expect(getNextDueDate(rec, false)).toBe('2024/03/15');
	});

	it('returns next week when target weekday matches today and paid', () => {
		// Friday March 15, dayOfWeek=5 → paid → March 22
		const rec = makeRec({ frequency: 'weekly', dayOfWeek: 5 });
		expect(getNextDueDate(rec, true)).toBe('2024/03/22');
	});

	it('returns overdue Tuesday (this week) when today is Friday and unpaid', () => {
		// Friday March 15, dayOfWeek=2 → diff=2-5=-3 → March 12
		const rec = makeRec({ frequency: 'weekly', dayOfWeek: 2 });
		expect(getNextDueDate(rec, false)).toBe('2024/03/12');
	});
});
