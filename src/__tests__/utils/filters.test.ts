import { describe, it, expect } from 'vitest';
import { parseBlockOptions, filterTransactions } from '../../utils/filters';
import type { Transaction, BlockFilterOptions } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeTx(date: string, payee: string, accounts: [string, string] = ['Gastos:A', 'Activos:B']): Transaction {
	return {
		date,
		status: '*',
		payee,
		postings: [
			{ account: accounts[0], amount: 100, currency: '' },
			{ account: accounts[1], amount: -100, currency: '' },
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
		const opts = parseBlockOptions('   \n  ');
		expect(opts.account).toBeNull();
	});

	// Account filter
	it('parses "cuenta" (Spanish keyword)', () => {
		expect(parseBlockOptions('cuenta: Gastos').account).toBe('Gastos');
	});

	it('parses "account" (English keyword)', () => {
		expect(parseBlockOptions('account: Expenses').account).toBe('Expenses');
	});

	it('accepts a bare simple account name (no colon) without key=value syntax', () => {
		// Names without ':' don't match the kv regex and fall through to account
		expect(parseBlockOptions('Activos').account).toBe('Activos');
	});

	it('a bare hierarchical name like "Gastos:Alimentos" is parsed by the kv regex but not assigned (known limitation)', () => {
		// 'Gastos:Alimentos' matches /^(\w+)\s*[:=]\s*(.+)$/ with key='gastos',
		// which is not a recognized keyword — use 'cuenta: Gastos:Alimentos' instead
		expect(parseBlockOptions('Gastos:Alimentos').account).toBeNull();
		expect(parseBlockOptions('cuenta: Gastos:Alimentos').account).toBe('Gastos:Alimentos');
	});

	// Date filters
	it('parses "desde" and normalizes hyphens to slashes', () => {
		expect(parseBlockOptions('desde: 2024-01-01').from).toBe('2024/01/01');
	});

	it('parses "from" (English)', () => {
		expect(parseBlockOptions('from: 2024/01/01').from).toBe('2024/01/01');
	});

	it('parses "hasta" and normalizes hyphens to slashes', () => {
		expect(parseBlockOptions('hasta: 2024-12-31').to).toBe('2024/12/31');
	});

	it('parses "to" (English)', () => {
		expect(parseBlockOptions('to: 2024/12/31').to).toBe('2024/12/31');
	});

	// Month shorthand
	it('parses "mes" expanding to first and last day of a 31-day month', () => {
		const opts = parseBlockOptions('mes: 2024/01');
		expect(opts.from).toBe('2024/01/01');
		expect(opts.to).toBe('2024/01/31');
	});

	it('parses "mes" correctly for a 30-day month', () => {
		const opts = parseBlockOptions('mes: 2024/04');
		expect(opts.from).toBe('2024/04/01');
		expect(opts.to).toBe('2024/04/30');
	});

	it('parses "mes" correctly for February in a leap year', () => {
		const opts = parseBlockOptions('mes: 2024/02');
		expect(opts.from).toBe('2024/02/01');
		expect(opts.to).toBe('2024/02/29');
	});

	it('parses "mes" correctly for February in a non-leap year', () => {
		const opts = parseBlockOptions('mes: 2023/02');
		expect(opts.from).toBe('2023/02/01');
		expect(opts.to).toBe('2023/02/28');
	});

	it('parses "month" (English) for month shorthand', () => {
		const opts = parseBlockOptions('month: 2024/06');
		expect(opts.from).toBe('2024/06/01');
		expect(opts.to).toBe('2024/06/30');
	});

	// Year shorthand
	it('parses "anio" expanding to full year range', () => {
		const opts = parseBlockOptions('anio: 2024');
		expect(opts.from).toBe('2024/01/01');
		expect(opts.to).toBe('2024/12/31');
	});

	it('parses "year" (English) for year shorthand', () => {
		const opts = parseBlockOptions('year: 2023');
		expect(opts.from).toBe('2023/01/01');
		expect(opts.to).toBe('2023/12/31');
	});

	// Today keyword
	it('parses "hoy" setting from and to to the same date', () => {
		const opts = parseBlockOptions('hoy');
		expect(opts.from).not.toBeNull();
		expect(opts.to).not.toBeNull();
		expect(opts.from).toBe(opts.to);
		expect(opts.from).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
	});

	it('parses "today" (English) as same-day filter', () => {
		const opts = parseBlockOptions('today');
		expect(opts.from).toBe(opts.to);
	});

	// Search
	it('parses "buscar" (Spanish)', () => {
		expect(parseBlockOptions('buscar: supermercado').search).toBe('supermercado');
	});

	it('parses "search" (English)', () => {
		expect(parseBlockOptions('search: farmacia').search).toBe('farmacia');
	});

	// Limit
	it('parses "limite" (Spanish)', () => {
		expect(parseBlockOptions('limite: 5').limit).toBe(5);
	});

	it('parses "limit" (English)', () => {
		expect(parseBlockOptions('limit: 10').limit).toBe(10);
	});

	// Order
	it('parses "orden: asc"', () => {
		expect(parseBlockOptions('orden: asc').order).toBe('asc');
	});

	it('parses "order: asc" (English)', () => {
		expect(parseBlockOptions('order: asc').order).toBe('asc');
	});

	it('defaults to desc for unknown order values', () => {
		expect(parseBlockOptions('orden: OTHER').order).toBe('desc');
	});

	// Period
	it('parses "periodo: anual" as year period', () => {
		expect(parseBlockOptions('periodo: anual').period).toBe('year');
	});

	it('parses "period: year" (English)', () => {
		expect(parseBlockOptions('period: year').period).toBe('year');
	});

	it('parses "periodo: month" as month period', () => {
		expect(parseBlockOptions('periodo: month').period).toBe('month');
	});

	// Comments
	it('skips lines starting with # or ;', () => {
		const opts = parseBlockOptions('# comentario\n; otro comentario\ncuenta: Gastos');
		expect(opts.account).toBe('Gastos');
	});

	// Multi-line
	it('parses multiple options in one block', () => {
		const source = 'cuenta: Gastos\ndesde: 2024/01/01\nhasta: 2024/12/31\nlimite: 20\norden: asc';
		const opts = parseBlockOptions(source);
		expect(opts.account).toBe('Gastos');
		expect(opts.from).toBe('2024/01/01');
		expect(opts.to).toBe('2024/12/31');
		expect(opts.limit).toBe(20);
		expect(opts.order).toBe('asc');
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
		const result = filterTransactions([...txs], {
			...NO_FILTER,
			from: '2024/02/01',
			to: '2024/03/31',
		});
		expect(result).toHaveLength(2);
		const payees = result.map(t => t.payee).sort();
		expect(payees).toEqual(['Farmacia', 'Salario']);
	});

	it('returns empty array when date range matches nothing', () => {
		const result = filterTransactions([...txs], {
			...NO_FILTER,
			from: '2025/01/01',
			to: '2025/12/31',
		});
		expect(result).toHaveLength(0);
	});

	it('filters by account using partial match', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, account: 'Gastos' });
		expect(result).toHaveLength(4); // all except Salario
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

	it('returns empty array when search matches nothing', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, search: 'inexistente' });
		expect(result).toHaveLength(0);
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

	it('applies limit after sorting', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, order: 'desc', limit: 2 });
		expect(result).toHaveLength(2);
		expect(result[0]!.date).toBe('2024/05/01');
		expect(result[1]!.date).toBe('2024/04/20');
	});

	it('does not apply limit when limit is 0', () => {
		const result = filterTransactions([...txs], { ...NO_FILTER, limit: 0 });
		expect(result).toHaveLength(5);
	});

	it('can combine account and date range filters', () => {
		const result = filterTransactions([...txs], {
			...NO_FILTER,
			account: 'Gastos',
			from: '2024/02/01',
			to: '2024/04/30',
		});
		expect(result).toHaveLength(2);
		const payees = result.map(t => t.payee).sort();
		expect(payees).toEqual(['Farmacia', 'Netflix']);
	});

	it('does not modify the original array', () => {
		const original = [...txs];
		filterTransactions([...txs], { ...NO_FILTER, limit: 2 });
		expect(txs).toHaveLength(original.length);
	});
});
