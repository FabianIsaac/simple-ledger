import { describe, it, expect } from 'vitest';
import { parseBlockOptions, filterTransactions } from '../../utils/filters';
import type { Transaction, BlockFilterOptions } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeTx(
	date: string,
	payee: string,
	accounts: [string, string] = ['Gastos:A', 'Activos:B'],
	amount = 100,
): Transaction {
	return {
		date,
		status: '*',
		payee,
		postings: [
			{ account: accounts[0], amount, currency: '' },
			{ account: accounts[1], amount: -amount, currency: '' },
		],
		lineStart: 0,
		lineEnd: 3,
	};
}

const NO_FILTER: BlockFilterOptions = {
	account: null,
	from: null,
	to: null,
	search: null,
	limit: 0,
	order: 'desc',
	period: 'month',
	tipo: 'gastos',
	nivel: 1,
};

// ─── parseBlockOptions ─────────────────────────────────────────────────────

describe('parseBlockOptions', () => {
	it('returns defaults when source is empty', () => {
		const opts = parseBlockOptions('');
		expect(opts.account).toBeNull();
		expect(opts.from).toBeNull();
		expect(opts.to).toBeNull();
		expect(opts.search).toBeNull();
		expect(opts.limit).toBe(0);
		expect(opts.order).toBe('desc');
		expect(opts.period).toBe('month');
	});

	it('returns defaults when source is whitespace only', () => {
		expect(parseBlockOptions('   \n  ').account).toBeNull();
	});

	// account
	it('parses account', () => {
		expect(parseBlockOptions('account: Gastos').account).toBe('Gastos');
	});

	it('accepts a bare simple account name without key=value syntax', () => {
		expect(parseBlockOptions('Activos').account).toBe('Activos');
	});

	it('a bare hierarchical name like "Gastos:Alimentos" falls through kv regex — use account: instead', () => {
		expect(parseBlockOptions('Gastos:Alimentos').account).toBeNull();
		expect(parseBlockOptions('account: Gastos:Alimentos').account).toBe('Gastos:Alimentos');
	});

	// from / to
	it('parses from and normalizes hyphens to slashes', () => {
		expect(parseBlockOptions('from: 2024-01-01').from).toBe('2024/01/01');
	});

	it('parses to and normalizes hyphens to slashes', () => {
		expect(parseBlockOptions('to: 2024-12-31').to).toBe('2024/12/31');
	});

	// month
	it('parses month expanding to first and last day of a 31-day month', () => {
		const opts = parseBlockOptions('month: 2024/01');
		expect(opts.from).toBe('2024/01/01');
		expect(opts.to).toBe('2024/01/31');
	});

	it('parses month for a 30-day month', () => {
		const opts = parseBlockOptions('month: 2024/04');
		expect(opts.from).toBe('2024/04/01');
		expect(opts.to).toBe('2024/04/30');
	});

	it('parses month for February in a leap year', () => {
		const opts = parseBlockOptions('month: 2024/02');
		expect(opts.from).toBe('2024/02/01');
		expect(opts.to).toBe('2024/02/29');
	});

	it('parses month for February in a non-leap year', () => {
		const opts = parseBlockOptions('month: 2023/02');
		expect(opts.from).toBe('2023/02/01');
		expect(opts.to).toBe('2023/02/28');
	});

	// year
	it('parses year expanding to full year range', () => {
		const opts = parseBlockOptions('year: 2024');
		expect(opts.from).toBe('2024/01/01');
		expect(opts.to).toBe('2024/12/31');
	});

	it('parses year: 2026 correctly', () => {
		const opts = parseBlockOptions('year: 2026');
		expect(opts.from).toBe('2026/01/01');
		expect(opts.to).toBe('2026/12/31');
	});

	// today keyword
	it('parses "today" setting from and to to the same date', () => {
		const opts = parseBlockOptions('today');
		expect(opts.from).not.toBeNull();
		expect(opts.to).not.toBeNull();
		expect(opts.from).toBe(opts.to);
		expect(opts.from).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
	});

	// search
	it('parses search', () => {
		expect(parseBlockOptions('search: farmacia').search).toBe('farmacia');
	});

	// limit
	it('parses limit', () => {
		expect(parseBlockOptions('limit: 10').limit).toBe(10);
	});

	it('treats non-numeric limit as 0', () => {
		expect(parseBlockOptions('limit: abc').limit).toBe(0);
	});

	// order
	it('parses order: asc', () => {
		expect(parseBlockOptions('order: asc').order).toBe('asc');
	});

	it('defaults to desc for unknown order values', () => {
		expect(parseBlockOptions('order: random').order).toBe('desc');
	});

	// period
	it('parses period: year', () => {
		expect(parseBlockOptions('period: year').period).toBe('year');
	});

	it('parses period: annual', () => {
		expect(parseBlockOptions('period: annual').period).toBe('year');
	});

	it('parses period: month', () => {
		expect(parseBlockOptions('period: month').period).toBe('month');
	});

	it('defaults period to month for unknown values', () => {
		expect(parseBlockOptions('period: quarterly').period).toBe('month');
	});

	// type
	it('parses type: income', () => {
		expect(parseBlockOptions('type: income').tipo).toBe('ingresos');
	});

	it('parses type: assets', () => {
		expect(parseBlockOptions('type: assets').tipo).toBe('activos');
	});

	it('parses type: liabilities', () => {
		expect(parseBlockOptions('type: liabilities').tipo).toBe('pasivos');
	});

	it('defaults type to gastos for unknown values', () => {
		expect(parseBlockOptions('type: other').tipo).toBe('gastos');
	});

	// level
	it('parses level: 2', () => {
		expect(parseBlockOptions('level: 2').nivel).toBe(2);
	});

	it('defaults level to 1 for other values', () => {
		expect(parseBlockOptions('level: 3').nivel).toBe(1);
	});

	// comments
	it('skips lines starting with # or ;', () => {
		const opts = parseBlockOptions('# comment\n; another\naccount: Gastos');
		expect(opts.account).toBe('Gastos');
	});

	// multi-line
	it('parses multiple options in one block', () => {
		const source = 'account: Gastos\nfrom: 2024/01/01\nto: 2024/12/31\nlimit: 20\norder: asc';
		const opts = parseBlockOptions(source);
		expect(opts.account).toBe('Gastos');
		expect(opts.from).toBe('2024/01/01');
		expect(opts.to).toBe('2024/12/31');
		expect(opts.limit).toBe(20);
		expect(opts.order).toBe('asc');
	});

	// combinations that were previously broken
	it('year + period: month — previously broken with "año" due to ñ not matching \\w', () => {
		const opts = parseBlockOptions('year: 2026\nperiod: month');
		expect(opts.from).toBe('2026/01/01');
		expect(opts.to).toBe('2026/12/31');
		expect(opts.period).toBe('month');
	});

	it('year + period: year', () => {
		const opts = parseBlockOptions('year: 2025\nperiod: year');
		expect(opts.from).toBe('2025/01/01');
		expect(opts.to).toBe('2025/12/31');
		expect(opts.period).toBe('year');
	});
});

// ─── filterTransactions ────────────────────────────────────────────────────

describe('filterTransactions', () => {
	const txs: Transaction[] = [
		makeTx('2024/01/10', 'Supermercado', ['Gastos:Alimentos', 'Activos:Banco']),
		makeTx('2024/02/05', 'Farmacia', ['Gastos:Salud', 'Activos:Banco']),
		makeTx('2024/03/15', 'Salario', ['Activos:Banco', 'Ingresos:Salario']),
		makeTx('2024/04/20', 'Netflix', ['Gastos:Entretenimiento', 'Activos:Banco']),
		makeTx('2024/05/01', 'Alquiler', ['Gastos:Vivienda', 'Activos:Banco']),
	];

	it('returns all transactions when no filters are set', () => {
		expect(filterTransactions([...txs], NO_FILTER)).toHaveLength(5);
	});

	it('filters by from date (inclusive)', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, from: '2024/03/01' });
		expect(result).toHaveLength(3);
		result.forEach(tx => expect(tx.date >= '2024/03/01').toBe(true));
	});

	it('filters by to date (inclusive)', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, to: '2024/02/28' });
		expect(result).toHaveLength(2);
		result.forEach(tx => expect(tx.date <= '2024/02/28').toBe(true));
	});

	it('filters by date range', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, from: '2024/02/01', to: '2024/03/31' });
		expect(result).toHaveLength(2);
		expect(result.map(t => t.payee).sort()).toEqual(['Farmacia', 'Salario']);
	});

	it('returns empty array when date range matches nothing', () => {
		expect(filterTransactions([...txs], { ...NO_FILTER, from: '2025/01/01', to: '2025/12/31' })).toHaveLength(0);
	});

	it('filters by account using partial match', () => {
		expect(filterTransactions([...txs], { ...NO_FILTER, account: 'Gastos' })).toHaveLength(4);
	});

	it('filters by account using exact path', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, account: 'Gastos:Salud' });
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Farmacia');
	});

	it('account filter is case-insensitive', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, account: 'gastos:alimentos' });
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Supermercado');
	});

	it('filters by search matching payee (case-insensitive)', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, search: 'super' });
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Supermercado');
	});

	it('filters by search matching account name', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, search: 'ingresos' });
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Salario');
	});

	it('returns empty when search matches nothing', () => {
		expect(filterTransactions([...txs], { ...NO_FILTER, search: 'inexistente' })).toHaveLength(0);
	});

	it('sorts descending by default', () => {
		const result = filterTransactions([...txs], NO_FILTER);
		for (let i = 0; i < result.length - 1; i++) {
			expect(result[i]!.date >= result[i + 1]!.date).toBe(true);
		}
	});

	it('sorts ascending when order is asc', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, order: 'asc' });
		for (let i = 0; i < result.length - 1; i++) {
			expect(result[i]!.date <= result[i + 1]!.date).toBe(true);
		}
	});

	it('applies limit after sorting (desc)', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, order: 'desc', limit: 2 });
		expect(result).toHaveLength(2);
		expect(result[0]!.date).toBe('2024/05/01');
		expect(result[1]!.date).toBe('2024/04/20');
	});

	it('does not apply limit when limit is 0', () => {
		expect(filterTransactions([...txs], { ...NO_FILTER, limit: 0 })).toHaveLength(5);
	});

	it('combines account and date range filters', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, account: 'Gastos', from: '2024/02/01', to: '2024/04/30' });
		expect(result).toHaveLength(2);
		expect(result.map(t => t.payee).sort()).toEqual(['Farmacia', 'Netflix']);
	});

	it('does not mutate the input array', () => {
		const input = [...txs];
		filterTransactions(input, { ...NO_FILTER, limit: 2 });
		expect(input).toHaveLength(5);
	});
});

// ─── Block pipeline (parse → filter) ──────────────────────────────────────

describe('block pipeline: parseBlockOptions + filterTransactions', () => {
	const txs2026: Transaction[] = [
		makeTx('2026/01/15', 'Enero gasto', ['Gastos:A', 'Activos:Banco']),
		makeTx('2026/02/10', 'Febrero gasto', ['Gastos:B', 'Activos:Banco']),
		makeTx('2026/03/20', 'Marzo ingreso', ['Activos:Banco', 'Ingresos:Trabajo']),
		makeTx('2026/04/05', 'Abril gasto', ['Gastos:C', 'Activos:Banco']),
		makeTx('2025/12/31', 'Año anterior', ['Gastos:A', 'Activos:Banco']),
	];

	it('year: 2026 — returns only 2026 transactions', () => {
		const opts = parseBlockOptions('year: 2026');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(4);
		result.forEach(tx => expect(tx.date.startsWith('2026')).toBe(true));
	});

	it('year: 2026 + period: month — same filter result (period is for grouping, not filtering)', () => {
		const opts = parseBlockOptions('year: 2026\nperiod: month');
		expect(opts.from).toBe('2026/01/01');
		expect(opts.to).toBe('2026/12/31');
		expect(opts.period).toBe('month');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(4);
	});

	it('year: 2026 + period: year — filters to 2026 and signals annual grouping', () => {
		const opts = parseBlockOptions('year: 2026\nperiod: year');
		expect(opts.period).toBe('year');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(4);
	});

	it('month: 2026/04 — returns only April 2026', () => {
		const opts = parseBlockOptions('month: 2026/04');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Abril gasto');
	});

	it('year: 2025 — returns only 2025 transactions', () => {
		const opts = parseBlockOptions('year: 2025');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Año anterior');
	});

	it('year: 2026 + account: Gastos — only 2026 expense transactions', () => {
		const opts = parseBlockOptions('year: 2026\naccount: Gastos');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(3);
		result.forEach(tx => expect(tx.date.startsWith('2026')).toBe(true));
	});

	it('year: 2026 + search: marzo — finds by payee', () => {
		const opts = parseBlockOptions('year: 2026\nsearch: marzo');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(1);
		expect(result[0]!.payee).toBe('Marzo ingreso');
	});

	it('year: 2026 + limit: 2 + order: asc — returns first 2 by date', () => {
		const opts = parseBlockOptions('year: 2026\nlimit: 2\norder: asc');
		const result = filterTransactions([...txs2026], opts);
		expect(result).toHaveLength(2);
		expect(result[0]!.date).toBe('2026/01/15');
		expect(result[1]!.date).toBe('2026/02/10');
	});

	it('summary grouping: year filter produces correct month keys', () => {
		const opts = parseBlockOptions('year: 2026');
		const filtered = filterTransactions([...txs2026], opts);
		// Simulate summaryBlock grouping by month (period: month)
		const groups: Record<string, Transaction[]> = {};
		for (const tx of filtered) {
			const key = tx.date.substring(0, 7); // 'YYYY/MM'
			if (!groups[key]) groups[key] = [];
			groups[key].push(tx);
		}
		expect(Object.keys(groups).sort()).toEqual(['2026/01', '2026/02', '2026/03', '2026/04']);
		expect(groups['2026/01']).toHaveLength(1);
		expect(groups['2026/04']).toHaveLength(1);
	});

	it('summary grouping: year filter + period: year produces one group', () => {
		const opts = parseBlockOptions('year: 2026\nperiod: year');
		const filtered = filterTransactions([...txs2026], opts);
		const groups: Record<string, Transaction[]> = {};
		for (const tx of filtered) {
			const key = tx.date.substring(0, 4); // 'YYYY'
			if (!groups[key]) groups[key] = [];
			groups[key].push(tx);
		}
		expect(Object.keys(groups)).toEqual(['2026']);
		expect(groups['2026']).toHaveLength(4);
	});
});
