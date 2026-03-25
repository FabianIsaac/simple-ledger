import { describe, it, expect } from 'vitest';
import { renameAccountInRecurrings } from '../../utils/accounts';
import type { RecurringTransaction } from '../../types';

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

describe('renameAccountInRecurrings', () => {
	it('renombra fromAccount cuando coincide con oldName', () => {
		const recs = [makeRec({ fromAccount: 'Activos:Banco' })];
		const result = renameAccountInRecurrings(recs, 'Activos:Banco', 'Activos:BancoNuevo');
		expect(result[0]!.fromAccount).toBe('Activos:BancoNuevo');
	});

	it('renombra toAccount cuando coincide con oldName', () => {
		const recs = [makeRec({ toAccount: 'Gastos:Alquiler' })];
		const result = renameAccountInRecurrings(recs, 'Gastos:Alquiler', 'Gastos:Renta');
		expect(result[0]!.toAccount).toBe('Gastos:Renta');
	});

	it('renombra _interestAccount cuando coincide con oldName', () => {
		const recs = [makeRec({ _interestAccount: 'Gastos:Intereses:Credito' })];
		const result = renameAccountInRecurrings(recs, 'Gastos:Intereses:Credito', 'Gastos:Intereses:NuevoCredito');
		expect(result[0]!._interestAccount).toBe('Gastos:Intereses:NuevoCredito');
	});

	it('no modifica registros cuyas cuentas no coinciden', () => {
		const recs = [makeRec({ fromAccount: 'Activos:Efectivo', toAccount: 'Gastos:Comida' })];
		const result = renameAccountInRecurrings(recs, 'Activos:Banco', 'Activos:BancoNuevo');
		expect(result[0]!.fromAccount).toBe('Activos:Efectivo');
		expect(result[0]!.toAccount).toBe('Gastos:Comida');
	});

	it('no muta el array original', () => {
		const original = makeRec({ fromAccount: 'Activos:Banco' });
		const recs = [original];
		renameAccountInRecurrings(recs, 'Activos:Banco', 'Activos:BancoNuevo');
		expect(original.fromAccount).toBe('Activos:Banco');
	});

	it('renombra en multiples registros a la vez', () => {
		const recs = [
			makeRec({ id: '1', fromAccount: 'Activos:Banco', toAccount: 'Gastos:Gym' }),
			makeRec({ id: '2', fromAccount: 'Activos:Banco', toAccount: 'Gastos:Netflix' }),
			makeRec({ id: '3', fromAccount: 'Activos:Efectivo', toAccount: 'Gastos:Comida' }),
		];
		const result = renameAccountInRecurrings(recs, 'Activos:Banco', 'Activos:BancoNuevo');
		expect(result[0]!.fromAccount).toBe('Activos:BancoNuevo');
		expect(result[1]!.fromAccount).toBe('Activos:BancoNuevo');
		expect(result[2]!.fromAccount).toBe('Activos:Efectivo'); // sin cambio
	});

	it('retorna array vacio si la entrada es vacia', () => {
		const result = renameAccountInRecurrings([], 'Activos:Banco', 'Activos:BancoNuevo');
		expect(result).toHaveLength(0);
	});

	it('no modifica otros campos del registro', () => {
		const recs = [makeRec({ payee: 'Netflix', amount: 5000, frequency: 'monthly' })];
		const result = renameAccountInRecurrings(recs, 'Activos:Banco', 'Activos:BancoNuevo');
		expect(result[0]!.payee).toBe('Netflix');
		expect(result[0]!.amount).toBe(5000);
		expect(result[0]!.frequency).toBe('monthly');
	});

	it('renombra fromAccount y toAccount en el mismo registro si ambos coinciden', () => {
		const recs = [makeRec({ fromAccount: 'Activos:Banco', toAccount: 'Activos:Banco' })];
		const result = renameAccountInRecurrings(recs, 'Activos:Banco', 'Activos:BancoNuevo');
		expect(result[0]!.fromAccount).toBe('Activos:BancoNuevo');
		expect(result[0]!.toAccount).toBe('Activos:BancoNuevo');
	});
});
