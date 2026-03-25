import { describe, it, expect } from 'vitest';
import { LedgerParser } from '../../parser/LedgerParser';
import type { Transaction } from '../../types';

function makeTx(postings: Array<{ account: string; amount: number | null }>): Transaction {
	return {
		date: '2024/01/01',
		status: '*',
		payee: 'Test',
		postings: postings.map(p => ({ ...p, currency: '' })),
		lineStart: 0,
		lineEnd: 3,
	};
}

// ─── LedgerParser.parse ────────────────────────────────────────────────────

describe('LedgerParser.parse', () => {
	it('parses a basic transaction and auto-balances the null posting', () => {
		const text = `2024/01/15 * Supermercado
    Gastos:Alimentos  50.00
    Activos:Banco`;

		const txs = LedgerParser.parse(text);
		expect(txs).toHaveLength(1);

		const tx = txs[0]!;
		expect(tx.date).toBe('2024/01/15');
		expect(tx.status).toBe('*');
		expect(tx.payee).toBe('Supermercado');
		expect(tx.postings).toHaveLength(2);
		expect(tx.postings[0]!.account).toBe('Gastos:Alimentos');
		expect(tx.postings[0]!.amount).toBe(50);
		expect(tx.postings[1]!.account).toBe('Activos:Banco');
		expect(tx.postings[1]!.amount).toBe(-50);
	});

	it('parses a transaction without status flag', () => {
		const text = `2024/02/01 Sueldo
    Activos:Banco  3000.00
    Ingresos:Salario`;

		const txs = LedgerParser.parse(text);
		expect(txs).toHaveLength(1);
		expect(txs[0]!.status).toBe('');
		expect(txs[0]!.payee).toBe('Sueldo');
		expect(txs[0]!.postings[0]!.amount).toBe(3000);
		expect(txs[0]!.postings[1]!.amount).toBe(-3000);
	});

	it('normalizes dates with hyphens to slashes', () => {
		const text = `2024-03-10 * Farmacia
    Gastos:Salud  25.00
    Activos:Efectivo  -25.00`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.date).toBe('2024/03/10');
	});

	it('parses explicit negative amounts without auto-balance', () => {
		const text = `2024/01/20 * Alquiler
    Gastos:Vivienda  800.00
    Activos:Banco  -800.00`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.postings[0]!.amount).toBe(800);
		expect(txs[0]!.postings[1]!.amount).toBe(-800);
	});

	it('parses multiple transactions', () => {
		const text = `2024/01/10 * Supermercado
    Gastos:Alimentos  60.00
    Activos:Banco  -60.00

2024/01/15 * Farmacia
    Gastos:Salud  40.00
    Activos:Banco  -40.00`;

		const txs = LedgerParser.parse(text);
		expect(txs).toHaveLength(2);
		expect(txs[0]!.payee).toBe('Supermercado');
		expect(txs[1]!.payee).toBe('Farmacia');
	});

	it('skips comment lines within a transaction', () => {
		const text = `2024/01/15 * Supermercado
    ; este es un comentario
    Gastos:Alimentos  50.00
    Activos:Banco  -50.00`;

		const txs = LedgerParser.parse(text);
		expect(txs).toHaveLength(1);
		expect(txs[0]!.postings).toHaveLength(2);
	});

	it('returns empty array for empty input', () => {
		expect(LedgerParser.parse('')).toHaveLength(0);
	});

	it('returns empty array for comment-only input', () => {
		expect(LedgerParser.parse('; Solo comentarios\n; Mas comentarios')).toHaveLength(0);
	});

	it('tracks lineStart and lineEnd correctly', () => {
		const text = `2024/01/15 * Supermercado
    Gastos:Alimentos  50.00
    Activos:Banco  -50.00`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.lineStart).toBe(0);
		expect(txs[0]!.lineEnd).toBe(2);
	});

	it('tracks lineStart/lineEnd correctly for second transaction', () => {
		const text = `2024/01/10 * TX1
    Gastos:A  10.00
    Activos:B  -10.00

2024/01/15 * TX2
    Gastos:C  20.00
    Activos:D  -20.00`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.lineStart).toBe(0);
		expect(txs[0]!.lineEnd).toBe(2);
		expect(txs[1]!.lineStart).toBe(4);
		expect(txs[1]!.lineEnd).toBe(6);
	});

	it('auto-balances a 3-posting transaction', () => {
		const text = `2024/01/15 * Cuota prestamo
    Pasivos:Prestamo  900.00
    Gastos:Intereses  100.00
    Activos:Banco`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.postings).toHaveLength(3);
		expect(txs[0]!.postings[2]!.amount).toBe(-1000);
	});

	it('parses a 3-posting transaction with all explicit amounts', () => {
		const text = `2024/01/15 * Cuota prestamo
    Pasivos:Prestamo  900.00
    Gastos:Intereses  100.00
    Activos:Banco  -1000.00`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.postings).toHaveLength(3);
		expect(txs[0]!.postings[0]!.amount).toBe(900);
		expect(txs[0]!.postings[1]!.amount).toBe(100);
		expect(txs[0]!.postings[2]!.amount).toBe(-1000);
	});

	it('parses hierarchical account names with colons', () => {
		const text = `2024/01/15 * Test
    Gastos:Alimentacion:Supermercado  75.50
    Activos:Banco:Cuenta corriente  -75.50`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.postings[0]!.account).toBe('Gastos:Alimentacion:Supermercado');
		expect(txs[0]!.postings[1]!.account).toBe('Activos:Banco:Cuenta corriente');
	});

	it('does not include transactions with fewer than 2 postings', () => {
		// A header line followed by only one posting line won't have >= 2 postings
		const text = `2024/01/15 * Invalido
    Gastos:A  50.00`;

		const txs = LedgerParser.parse(text);
		expect(txs).toHaveLength(0);
	});

	it('parses income transaction (asset increases, income decreases)', () => {
		const text = `2024/03/01 * Salario mensual
    Activos:Banco  5000.00
    Ingresos:Salario  -5000.00`;

		const txs = LedgerParser.parse(text);
		expect(txs[0]!.postings[0]!.account).toBe('Activos:Banco');
		expect(txs[0]!.postings[0]!.amount).toBe(5000);
		expect(txs[0]!.postings[1]!.account).toBe('Ingresos:Salario');
		expect(txs[0]!.postings[1]!.amount).toBe(-5000);
	});
});

// ─── LedgerParser.formatTransaction ───────────────────────────────────────

describe('LedgerParser.formatTransaction', () => {
	it('includes date, status and payee on the first line', () => {
		const result = LedgerParser.formatTransaction('2024/01/15', 'Supermercado', [
			{ account: 'Gastos:Alimentos', amount: 50, currency: '', amountFormatted: '$50.00' },
			{ account: 'Activos:Banco', amount: -50, currency: '', amountFormatted: '-$50.00' },
		], '*');

		const firstLine = result.split('\n')[0];
		expect(firstLine).toBe('2024/01/15 * Supermercado');
	});

	it('omits status when empty string', () => {
		const result = LedgerParser.formatTransaction('2024/01/15', 'Supermercado', [
			{ account: 'Gastos:A', amount: 50, currency: '', amountFormatted: '$50.00' },
			{ account: 'Activos:B', amount: -50, currency: '', amountFormatted: '-$50.00' },
		], '');

		expect(result.split('\n')[0]).toBe('2024/01/15 Supermercado');
	});

	it('indents postings with 4 spaces', () => {
		const result = LedgerParser.formatTransaction('2024/01/15', 'Test', [
			{ account: 'Gastos:A', amount: 50, currency: '', amountFormatted: '$50.00' },
			{ account: 'Activos:B', amount: -50, currency: '', amountFormatted: '-$50.00' },
		], '*');

		const lines = result.split('\n');
		expect(lines[1]).toMatch(/^    /);
		expect(lines[2]).toMatch(/^    /);
	});

	it('uses amountFormatted string when provided', () => {
		const result = LedgerParser.formatTransaction('2024/01/15', 'Test', [
			{ account: 'Gastos:A', amount: 50, currency: '', amountFormatted: '50,00 €' },
			{ account: 'Activos:B', amount: -50, currency: '', amountFormatted: '-50,00 €' },
		], '*');

		expect(result).toContain('50,00 €');
		expect(result).toContain('-50,00 €');
	});

	it('aligns amounts at the same column', () => {
		// Shorter account gets more padding to align with longer account
		const result = LedgerParser.formatTransaction('2024/01/15', 'Test', [
			{ account: 'Gastos:Alimentacion', amount: 200, currency: '', amountFormatted: '$200.00' },
			{ account: 'Activos:Banco', amount: -200, currency: '', amountFormatted: '-$200.00' },
		], '*');

		const lines = result.split('\n');
		const amtPos1 = lines[1]!.indexOf('$200.00');
		const amtPos2 = lines[2]!.indexOf('$200.00'); // inside '-$200.00'
		// Both amount values start at similar columns (within 1 char of each other)
		expect(Math.abs(amtPos1 - amtPos2)).toBeLessThanOrEqual(1);
	});

	it('produces a string with correct number of lines', () => {
		const result = LedgerParser.formatTransaction('2024/01/15', 'Test', [
			{ account: 'Gastos:A', amount: 50, currency: '', amountFormatted: '$50.00' },
			{ account: 'Activos:B', amount: -50, currency: '', amountFormatted: '-$50.00' },
		], '*');

		expect(result.split('\n')).toHaveLength(3); // header + 2 postings
	});
});

// ─── LedgerParser.computeBalances ─────────────────────────────────────────

describe('LedgerParser.computeBalances', () => {
	it('returns empty object for empty array', () => {
		expect(LedgerParser.computeBalances([])).toEqual({});
	});

	it('computes balance for a single transaction', () => {
		const tx = makeTx([
			{ account: 'Gastos:Alimentos', amount: 50 },
			{ account: 'Activos:Banco', amount: -50 },
		]);

		const balances = LedgerParser.computeBalances([tx]);
		expect(balances['Gastos:Alimentos']).toBe(50);
		expect(balances['Activos:Banco']).toBe(-50);
	});

	it('accumulates balances across multiple transactions', () => {
		const tx1 = makeTx([
			{ account: 'Gastos:Alimentos', amount: 100 },
			{ account: 'Activos:Banco', amount: -100 },
		]);
		const tx2 = makeTx([
			{ account: 'Gastos:Alimentos', amount: 50 },
			{ account: 'Activos:Banco', amount: -50 },
		]);

		const balances = LedgerParser.computeBalances([tx1, tx2]);
		expect(balances['Gastos:Alimentos']).toBe(150);
		expect(balances['Activos:Banco']).toBe(-150);
	});

	it('skips null amount postings', () => {
		const tx = makeTx([
			{ account: 'Gastos:A', amount: 50 },
			{ account: 'Activos:B', amount: null },
		]);

		const balances = LedgerParser.computeBalances([tx]);
		expect(balances['Gastos:A']).toBe(50);
		expect('Activos:B' in balances).toBe(false);
	});

	it('handles multiple accounts independently', () => {
		const tx = makeTx([
			{ account: 'Activos:Banco', amount: 3000 },
			{ account: 'Ingresos:Salario', amount: -3000 },
		]);

		const balances = LedgerParser.computeBalances([tx]);
		expect(balances['Activos:Banco']).toBe(3000);
		expect(balances['Ingresos:Salario']).toBe(-3000);
	});

	it('handles three-way split transaction', () => {
		const tx = makeTx([
			{ account: 'Pasivos:Prestamo', amount: 900 },
			{ account: 'Gastos:Intereses', amount: 100 },
			{ account: 'Activos:Banco', amount: -1000 },
		]);

		const balances = LedgerParser.computeBalances([tx]);
		expect(balances['Pasivos:Prestamo']).toBe(900);
		expect(balances['Gastos:Intereses']).toBe(100);
		expect(balances['Activos:Banco']).toBe(-1000);
	});
});

// ─── LedgerParser.computeBalanceTree ──────────────────────────────────────

describe('LedgerParser.computeBalanceTree', () => {
	it('returns empty tree for empty balances', () => {
		expect(LedgerParser.computeBalanceTree({})).toEqual({});
	});

	it('handles flat (non-hierarchical) accounts', () => {
		const tree = LedgerParser.computeBalanceTree({
			Banco: 1000,
			Caja: 500,
		});

		expect(tree['Banco']!._total).toBe(1000);
		expect(tree['Caja']!._total).toBe(500);
	});

	it('builds two-level hierarchy from colon-separated names', () => {
		const tree = LedgerParser.computeBalanceTree({
			'Gastos:Alimentos': 200,
			'Gastos:Transporte': 100,
		});

		expect(tree['Gastos']!._total).toBe(300);
		expect(tree['Gastos']!._children['Alimentos']!._total).toBe(200);
		expect(tree['Gastos']!._children['Transporte']!._total).toBe(100);
	});

	it('handles three-level deep hierarchy', () => {
		const tree = LedgerParser.computeBalanceTree({
			'Gastos:Alimentacion:Supermercado': 150,
			'Gastos:Alimentacion:Restaurantes': 80,
		});

		expect(tree['Gastos']!._total).toBe(230);
		expect(tree['Gastos']!._children['Alimentacion']!._total).toBe(230);
		expect(tree['Gastos']!._children['Alimentacion']!._children['Supermercado']!._total).toBe(150);
		expect(tree['Gastos']!._children['Alimentacion']!._children['Restaurantes']!._total).toBe(80);
	});

	it('correctly aggregates sibling and nested accounts under the same parent', () => {
		const tree = LedgerParser.computeBalanceTree({
			'Activos:Banco:Cuenta 1': 1000,
			'Activos:Banco:Cuenta 2': 2000,
			'Activos:Efectivo': 500,
		});

		expect(tree['Activos']!._total).toBe(3500);
		expect(tree['Activos']!._children['Banco']!._total).toBe(3000);
		expect(tree['Activos']!._children['Efectivo']!._total).toBe(500);
	});

	it('builds separate top-level branches for different account families', () => {
		const tree = LedgerParser.computeBalanceTree({
			'Gastos:Alimentos': 300,
			'Ingresos:Salario': -5000,
			'Activos:Banco': 4700,
		});

		expect(Object.keys(tree).sort()).toEqual(['Activos', 'Gastos', 'Ingresos']);
		expect(tree['Gastos']!._total).toBe(300);
		expect(tree['Ingresos']!._total).toBe(-5000);
		expect(tree['Activos']!._total).toBe(4700);
	});
});

// ─── LedgerParser.sanitizeText ─────────────────────────────────────────────

describe('LedgerParser.sanitizeText', () => {
	it('elimina saltos de linea \\n del texto', () => {
		expect(LedgerParser.sanitizeText('Payee\nInyectado')).toBe('Payee Inyectado');
	});

	it('elimina retornos de carro \\r', () => {
		expect(LedgerParser.sanitizeText('Payee\rTexto')).toBe('Payee Texto');
	});

	it('elimina tabuladores \\t', () => {
		expect(LedgerParser.sanitizeText('Cuenta\tNombre')).toBe('Cuenta Nombre');
	});

	it('elimina combinacion \\r\\n y colapsa espacios dobles', () => {
		expect(LedgerParser.sanitizeText('Texto\r\nInyectado')).toBe('Texto Inyectado');
	});

	it('no altera texto normal', () => {
		expect(LedgerParser.sanitizeText('Gastos:Comida:Restaurantes')).toBe('Gastos:Comida:Restaurantes');
	});

	it('aplica trim al resultado', () => {
		expect(LedgerParser.sanitizeText('  Payee  ')).toBe('Payee');
	});
});

// ─── LedgerParser.formatTransaction — sanitizacion ─────────────────────────

describe('LedgerParser.formatTransaction sanitizacion', () => {
	it('un payee con \\n no genera multiples lineas de header', () => {
		const text = LedgerParser.formatTransaction(
			'2024/01/01',
			'Payee\nInyectado',
			[
				{ account: 'Gastos:Comida', amount: 1000, currency: '', amountFormatted: '$1.000' },
				{ account: 'Activos:Banco', amount: -1000, currency: '', amountFormatted: '-$1.000' },
			],
			'*'
		);
		const headerLines = text.split('\n').filter(l => /^\d{4}/.test(l));
		expect(headerLines).toHaveLength(1);
		expect(headerLines[0]).not.toContain('\n');
	});

	it('una cuenta con \\n no rompe la estructura del archivo', () => {
		const text = LedgerParser.formatTransaction(
			'2024/01/01',
			'Test',
			[
				{ account: 'Gastos:Comida\nMaliciosa', amount: 1000, currency: '', amountFormatted: '$1.000' },
				{ account: 'Activos:Banco', amount: -1000, currency: '', amountFormatted: '-$1.000' },
			],
			'*'
		);
		// La transaccion formateada debe poder re-parsearse a 1 transaccion valida
		const txs = LedgerParser.parse(text);
		expect(txs).toHaveLength(1);
	});

	it('texto normal no se altera durante el formateo', () => {
		const text = LedgerParser.formatTransaction(
			'2024/01/01',
			'Supermercado',
			[
				{ account: 'Gastos:Alimentos', amount: 5000, currency: '', amountFormatted: '$5.000' },
				{ account: 'Activos:Banco', amount: -5000, currency: '', amountFormatted: '-$5.000' },
			],
			'*'
		);
		expect(text).toContain('Supermercado');
		expect(text).toContain('Gastos:Alimentos');
	});
});
