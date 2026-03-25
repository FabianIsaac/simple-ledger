export interface CreditMonthlyAmounts {
	monthlyPrincipal: number;
	monthlyInterest: number;
	monthlyTotal: number;
}

/**
 * Calculates the fixed monthly amounts for a credit/loan.
 *
 * Uses Math.floor to ensure the sum of payments never exceeds the total debt.
 * The remaining difference (at most `months - 1` units) is absorbed on the
 * last payment — acceptable for integer-based currencies like CLP.
 */
export function calculateCreditMonthlyAmounts(
	principal: number,
	totalDebt: number,
	months: number
): CreditMonthlyAmounts {
	if (months <= 0) throw new Error('months must be greater than 0');

	const interestTotal = totalDebt - principal;
	const monthlyPrincipal = Math.floor(principal / months);
	const monthlyInterest = Math.floor(interestTotal / months);
	const monthlyTotal = monthlyPrincipal + monthlyInterest;

	return { monthlyPrincipal, monthlyInterest, monthlyTotal };
}
