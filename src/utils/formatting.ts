import { PluginSettings } from '../types';

export function fmtAmount(amount: number, settings: PluginSettings): string {
	const num = Math.abs(amount).toFixed(settings.decimals);
	const sign = amount < 0 ? '-' : '';
	if (settings.currencyAfter) {
		return `${sign}${num} ${settings.currencySymbol}`;
	}
	return `${sign}${settings.currencySymbol}${num}`;
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
