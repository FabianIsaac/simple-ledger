import { PluginSettings } from '../types';

// For writing to the ledger file — never applies thousand separator
export function fmtAmountRaw(amount: number, settings: PluginSettings): string {
	const sign = amount < 0 ? '-' : '';
	const num = Math.abs(amount).toFixed(settings.decimals);
	if (settings.currencyAfter) {
		return `${sign}${num} ${settings.currencySymbol}`;
	}
	return `${sign}${settings.currencySymbol}${num}`;
}

// For display only — applies thousand separator
export function fmtAmount(amount: number, settings: PluginSettings): string {
	const sign = amount < 0 ? '-' : '';
	const abs = Math.abs(amount);
	const fixed = abs.toFixed(settings.decimals);
	const sep = settings.thousandSeparator ?? '';

	let numStr: string;
	if (sep) {
		const parts = fixed.split('.');
		parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
		numStr = parts.join('.');
	} else {
		numStr = fixed;
	}

	if (settings.currencyAfter) {
		return `${sign}${numStr} ${settings.currencySymbol}`;
	}
	return `${sign}${settings.currencySymbol}${numStr}`;
}

export function fmtDate(date: Date | string): string {
	if (date instanceof Date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}/${m}/${d}`;
	}
	return date;
}

export function todayStr(): string {
	return fmtDate(new Date());
}
