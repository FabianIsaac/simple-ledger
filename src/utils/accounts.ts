import { RecurringTransaction } from '../types';

/**
 * Returns a new array of recurring transactions with all account references
 * matching oldName renamed to newName (both fromAccount and toAccount).
 * Pure function — does not mutate the input array.
 */
export function renameAccountInRecurrings(
	recs: RecurringTransaction[],
	oldName: string,
	newName: string
): RecurringTransaction[] {
	return recs.map(rec => {
		const updated = { ...rec };
		if (rec.fromAccount === oldName) updated.fromAccount = newName;
		if (rec.toAccount === oldName) updated.toAccount = newName;
		if (rec._interestAccount === oldName) updated._interestAccount = newName;
		return updated;
	});
}
