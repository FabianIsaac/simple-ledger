import { Transaction, BlockFilterOptions } from '../types';
import { todayStr } from './formatting';

export function parseBlockOptions(source: string): BlockFilterOptions {
	const opts: BlockFilterOptions = {
		account: null,
		from: null,
		to: null,
		search: null,
		limit: 0,
		order: 'desc',
		period: 'month',
		type: 'expenses',
		level: 1,
	};

	if (!source || !source.trim()) return opts;

	const lines = source.trim().split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

		const kvMatch = trimmed.match(/^(\w+)\s*[:=]\s*(.+)$/);
		if (kvMatch) {
			const key = (kvMatch[1] ?? '').toLowerCase();
			const val = (kvMatch[2] ?? '').trim();

			switch (key) {
				case 'account':
					opts.account = val;
					break;
				case 'from':
					opts.from = val.replace(/-/g, '/');
					break;
				case 'to':
					opts.to = val.replace(/-/g, '/');
					break;
				case 'month': {
					const m = val.replace(/-/g, '/');
					opts.from = m + '/01';
					const parts = m.split('/');
					const year = parseInt(parts[0] ?? '0');
					const month = parseInt(parts[1] ?? '0');
					const lastDay = new Date(year, month, 0).getDate();
					opts.to = `${m}/${String(lastDay).padStart(2, '0')}`;
					break;
				}
				case 'year':
					opts.from = `${val}/01/01`;
					opts.to = `${val}/12/31`;
					break;
				case 'search':
					opts.search = val;
					break;
				case 'limit':
					opts.limit = parseInt(val) || 0;
					break;
				case 'order':
					opts.order = val.toLowerCase() === 'asc' ? 'asc' : 'desc';
					break;
				case 'period':
					opts.period = (val.toLowerCase() === 'year' || val.toLowerCase() === 'annual') ? 'year' : 'month';
					break;
				case 'type': {
					const v = val.toLowerCase();
					if (v === 'income') opts.type = 'income';
					else if (v === 'assets') opts.type = 'assets';
					else if (v === 'liabilities') opts.type = 'liabilities';
					else opts.type = 'expenses';
					break;
				}
				case 'level':
					opts.level = parseInt(val) === 2 ? 2 : 1;
					break;
			}
		} else {
			const keyword = trimmed.toLowerCase();
			if (keyword === 'today') {
				const today = todayStr();
				opts.from = today;
				opts.to = today;
			} else if (keyword === 'year') {
				opts.period = 'year';
			} else {
				opts.account = trimmed;
			}
		}
	}
	return opts;
}

export function filterTransactions(txs: Transaction[], opts: BlockFilterOptions): Transaction[] {
	let result = txs;

	if (opts.from) {
		const from = opts.from;
		result = result.filter(tx => tx.date >= from);
	}
	if (opts.to) {
		const to = opts.to;
		result = result.filter(tx => tx.date <= to);
	}
	if (opts.account) {
		const acctFilter = opts.account.toLowerCase();
		result = result.filter(tx =>
			tx.postings.some(p => p.account.toLowerCase().includes(acctFilter))
		);
	}
	if (opts.search) {
		const searchFilter = opts.search.toLowerCase();
		result = result.filter(tx =>
			tx.payee.toLowerCase().includes(searchFilter) ||
			tx.postings.some(p => p.account.toLowerCase().includes(searchFilter))
		);
	}

	if (opts.order === 'asc') {
		result.sort((a, b) => a.date.localeCompare(b.date));
	} else {
		result.sort((a, b) => b.date.localeCompare(a.date));
	}

	if (opts.limit > 0) {
		result = result.slice(0, opts.limit);
	}

	return result;
}
