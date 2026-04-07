import { describe, it, expect } from 'vitest';
import { fmtAmount, fmtDate, todayStr } from '../../utils/formatting';
import type { PluginSettings } from '../../types';

function makeSettings(overrides: Partial<PluginSettings> = {}): PluginSettings {
	return {
		ledgerFile: 'test.ledger',
		currencySymbol: '$',
		currencyAfter: false,
		decimals: 2,
		thousandSeparator: '',
		recurringNotesFolder: 'Finanzas/Recurrentes',
		accountPrefixes: { expenses: 'Gastos', income: 'Ingresos', assets: 'Activos', liabilities: 'Pasivos' },
		budgets: [],
		defaultAccounts: { expenses: [], income: [], assets: [], liabilities: [] },
		archivedAccounts: [],
		excludedFromBalance: [],
		recurringTransactions: [],
		credits: [],
		savedFilters: { from: '', to: '', account: '', search: '' },
		showStatusBarDebts: true,
		statusBarLookaheadDays: 7,
		...overrides,
	};
}

// ─── fmtAmount ─────────────────────────────────────────────────────────────

describe('fmtAmount', () => {
	it('formats a positive amount with currency symbol before the number', () => {
		expect(fmtAmount(50, makeSettings())).toBe('$50.00');
	});

	it('formats a negative amount with currency symbol before the number', () => {
		expect(fmtAmount(-50, makeSettings())).toBe('-$50.00');
	});

	it('formats zero correctly', () => {
		expect(fmtAmount(0, makeSettings())).toBe('$0.00');
	});

	it('formats a positive amount with currency symbol after the number', () => {
		const s = makeSettings({ currencyAfter: true, currencySymbol: '€' });
		expect(fmtAmount(100, s)).toBe('100.00 €');
	});

	it('formats a negative amount with currency symbol after the number', () => {
		const s = makeSettings({ currencyAfter: true, currencySymbol: '€' });
		expect(fmtAmount(-100, s)).toBe('-100.00 €');
	});

	it('respects 0 decimal places (rounds)', () => {
		const s = makeSettings({ decimals: 0 });
		expect(fmtAmount(50.49, s)).toBe('$50');
		expect(fmtAmount(50.50, s)).toBe('$51');
	});

	it('respects 3 decimal places', () => {
		const s = makeSettings({ decimals: 3 });
		expect(fmtAmount(50.5, s)).toBe('$50.500');
	});

	it('formats large amounts correctly', () => {
		expect(fmtAmount(1234567.89, makeSettings())).toBe('$1234567.89');
	});

	it('formats small fractional amounts', () => {
		const s = makeSettings({ currencySymbol: '£' });
		expect(fmtAmount(0.01, s)).toBe('£0.01');
	});

	it('works with different currency symbols', () => {
		expect(fmtAmount(100, makeSettings({ currencySymbol: '¥' }))).toBe('¥100.00');
		expect(fmtAmount(100, makeSettings({ currencySymbol: 'MXN ' }))).toBe('MXN 100.00');
	});

	it('currency after format has a space between number and symbol', () => {
		const s = makeSettings({ currencyAfter: true, currencySymbol: 'USD' });
		const result = fmtAmount(42, s);
		expect(result).toBe('42.00 USD');
	});
});

// ─── fmtDate ───────────────────────────────────────────────────────────────

describe('fmtDate', () => {
	it('formats a Date object to YYYY/MM/DD', () => {
		const d = new Date(2024, 0, 15); // January 15, 2024
		expect(fmtDate(d)).toBe('2024/01/15');
	});

	it('zero-pads single-digit months and days', () => {
		const d = new Date(2024, 8, 5); // September 5, 2024
		expect(fmtDate(d)).toBe('2024/09/05');
	});

	it('handles December (month 12)', () => {
		const d = new Date(2024, 11, 31); // December 31, 2024
		expect(fmtDate(d)).toBe('2024/12/31');
	});

	it('passes a string through unchanged', () => {
		expect(fmtDate('2024/03/15')).toBe('2024/03/15');
		expect(fmtDate('cualquier-cadena')).toBe('cualquier-cadena');
	});
});

// ─── todayStr ──────────────────────────────────────────────────────────────

describe('todayStr', () => {
	it('returns a string in YYYY/MM/DD format', () => {
		expect(todayStr()).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
	});

	it('returns the current date', () => {
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const d = String(now.getDate()).padStart(2, '0');
		expect(todayStr()).toBe(`${y}/${m}/${d}`);
	});
});
