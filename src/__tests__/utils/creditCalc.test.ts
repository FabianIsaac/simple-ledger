import { describe, it, expect } from 'vitest';
import { calculateCreditMonthlyAmounts } from '../../utils/creditCalc';

describe('calculateCreditMonthlyAmounts', () => {
	it('calcula correctamente para valores exactamente divisibles', () => {
		// 1.200.000 de deuda, 12 meses → exacto
		const result = calculateCreditMonthlyAmounts(1_000_000, 1_200_000, 12);
		expect(result.monthlyPrincipal).toBe(83_333);
		expect(result.monthlyInterest).toBe(16_666);
		expect(result.monthlyTotal).toBe(99_999);
	});

	it('nunca excede la deuda total al sumar todas las cuotas (principal)', () => {
		const principal = 1_000_000;
		const totalDebt = 1_300_000;
		const months = 7;
		const { monthlyPrincipal, monthlyInterest, monthlyTotal } =
			calculateCreditMonthlyAmounts(principal, totalDebt, months);

		expect(monthlyPrincipal * months).toBeLessThanOrEqual(principal);
		expect(monthlyInterest * months).toBeLessThanOrEqual(totalDebt - principal);
		expect(monthlyTotal * months).toBeLessThanOrEqual(totalDebt);
	});

	it('el total pagado no supera la deuda total para cualquier combinacion', () => {
		const cases = [
			{ principal: 500_000, totalDebt: 650_000, months: 6 },
			{ principal: 300_000, totalDebt: 360_000, months: 11 },
			{ principal: 2_000_000, totalDebt: 2_800_000, months: 24 },
			{ principal: 100_000, totalDebt: 120_000, months: 3 },
		];
		for (const { principal, totalDebt, months } of cases) {
			const { monthlyTotal } = calculateCreditMonthlyAmounts(principal, totalDebt, months);
			expect(monthlyTotal * months).toBeLessThanOrEqual(totalDebt);
		}
	});

	it('la diferencia entre lo pagado y la deuda total no supera months unidades', () => {
		const principal = 1_000_000;
		const totalDebt = 1_250_000;
		const months = 12;
		const { monthlyTotal } = calculateCreditMonthlyAmounts(principal, totalDebt, months);
		const totalPaid = monthlyTotal * months;
		expect(totalDebt - totalPaid).toBeLessThan(months);
	});

	it('monthlyTotal = monthlyPrincipal + monthlyInterest', () => {
		const result = calculateCreditMonthlyAmounts(800_000, 1_000_000, 10);
		expect(result.monthlyTotal).toBe(result.monthlyPrincipal + result.monthlyInterest);
	});

	it('funciona con un solo mes', () => {
		const result = calculateCreditMonthlyAmounts(500_000, 550_000, 1);
		expect(result.monthlyPrincipal).toBe(500_000);
		expect(result.monthlyInterest).toBe(50_000);
		expect(result.monthlyTotal).toBe(550_000);
	});

	it('lanza error si months es 0', () => {
		expect(() => calculateCreditMonthlyAmounts(100_000, 120_000, 0)).toThrow();
	});

	it('lanza error si months es negativo', () => {
		expect(() => calculateCreditMonthlyAmounts(100_000, 120_000, -3)).toThrow();
	});

	it('intereses cero cuando principal === totalDebt', () => {
		const result = calculateCreditMonthlyAmounts(600_000, 600_000, 12);
		expect(result.monthlyInterest).toBe(0);
		expect(result.monthlyTotal).toBe(result.monthlyPrincipal);
	});
});
