import es, { type LangKeys } from './lang/es';
import en from './lang/en';

const langs = { es, en } as const;
type SupportedLang = keyof typeof langs;

let _lang: SupportedLang = 'es';

/** Call once on plugin load with navigator.language or similar. */
export function initLang(locale: string): void {
	const code = locale.split('-')[0]?.toLowerCase() ?? 'es';
	_lang = (code in langs ? code : 'es') as SupportedLang;
}

/** Translate a key. Supports {placeholder} substitution. */
export function t(key: LangKeys, params?: Record<string, string | number>): string {
	let str: string = langs[_lang][key] ?? es[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replace(`{${k}}`, String(v));
		}
	}
	return str;
}

/** Translate with plural selection: uses key_one when n===1, key_many otherwise. */
export function tn(
	keyOne: LangKeys,
	keyMany: LangKeys,
	n: number,
	params?: Record<string, string | number>,
): string {
	return t(n === 1 ? keyOne : keyMany, { n, ...params });
}
