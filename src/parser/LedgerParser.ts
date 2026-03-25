import { Transaction, Posting, BalanceTree, BalanceTreeNode } from '../types';

export class LedgerParser {
	static parse(text: string): Transaction[] {
		const transactions: Transaction[] = [];
		const lines = text.split('\n');
		let i = 0;

		while (i < lines.length) {
			const line = lines[i] ?? '';
			const headerMatch = line.match(/^(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\s+([*!])?\s*(.+)$/);
			if (headerMatch) {
				const tx: Transaction = {
					date: (headerMatch[1] ?? '').replace(/-/g, '/'),
					status: headerMatch[2] ?? '',
					payee: (headerMatch[3] ?? '').trim(),
					postings: [],
					lineStart: i,
					lineEnd: i,
				};
				i++;
				while (i < lines.length && (lines[i] ?? '').match(/^[\s\t]+\S/)) {
					const postingLine = (lines[i] ?? '').trim();
					if (postingLine === '') { i++; continue; }
					if (postingLine.startsWith(';')) {
						const noteText = postingLine.slice(1).trim();
						if (noteText) tx.notes = tx.notes ? `${tx.notes}\n${noteText}` : noteText;
						i++;
						continue;
					}
					const postingMatch = postingLine.match(
						/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9: _-]+?)(?:\s{2,}|\t+)\s*([-]?\s*[$€£¥]?\s*[-]?[\d,]+\.?\d*)\s*([A-Za-z€$£¥]*)?$/
					);
					if (postingMatch) {
						let amountStr = (postingMatch[2] ?? '').replace(/[\s,]/g, '');
						amountStr = amountStr.replace(/[$€£¥]/, '');
						tx.postings.push({
							account: (postingMatch[1] ?? '').trim(),
							amount: parseFloat(amountStr),
							currency: postingMatch[3] ?? '',
						});
					} else {
						const acctOnly = postingLine.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9: _-]+)$/);
						if (acctOnly) {
							tx.postings.push({ account: (acctOnly[1] ?? '').trim(), amount: null, currency: '' });
						}
					}
					tx.lineEnd = i;
					i++;
				}

				const nullPostings = tx.postings.filter(p => p.amount === null);
				const valuedPostings = tx.postings.filter(p => p.amount !== null);
				if (nullPostings.length === 1 && valuedPostings.length > 0) {
					const total = valuedPostings.reduce((sum, p) => sum + (p.amount ?? 0), 0);
					const nullPosting = nullPostings[0];
					if (nullPosting) nullPosting.amount = -total;
				}
				if (tx.postings.length >= 2) {
					transactions.push(tx);
				}
			} else {
				i++;
			}
		}
		return transactions;
	}

	/** Removes characters that would break the ledger line-based format. */
	static sanitizeText(text: string): string {
		return text.replace(/[\r\n\t]/g, ' ').replace(/  +/g, ' ').trim();
	}

	static formatTransaction(
		date: string,
		payee: string,
		postings: Posting[],
		status: string,
		notes?: string
	): string {
		const safePayee = LedgerParser.sanitizeText(payee);
		const statusStr = status ? ` ${status}` : '';
		const lines: string[] = [`${date}${statusStr} ${safePayee}`];
		if (notes?.trim()) {
			for (const noteLine of notes.trim().split('\n')) {
				lines.push(`    ; ${LedgerParser.sanitizeText(noteLine)}`);
			}
		}
		const maxLen = Math.max(...postings.map(p => p.account.length));
		for (const p of postings) {
			const safeAccount = LedgerParser.sanitizeText(p.account);
			if (p.amount !== null && p.amount !== undefined) {
				const padding = ' '.repeat(Math.max(2, maxLen - safeAccount.length + 4));
				lines.push(`    ${safeAccount}${padding}${p.amountFormatted ?? p.amount.toFixed(2)}`);
			} else {
				lines.push(`    ${safeAccount}`);
			}
		}
		return lines.join('\n');
	}

	static computeBalances(transactions: Transaction[]): Record<string, number> {
		const balances: Record<string, number> = {};
		for (const tx of transactions) {
			for (const p of tx.postings) {
				if (p.amount !== null) {
					balances[p.account] = (balances[p.account] ?? 0) + p.amount;
				}
			}
		}
		return balances;
	}

	static computeBalanceTree(balances: Record<string, number>): BalanceTree {
		const tree: BalanceTree = {};
		for (const [account, amount] of Object.entries(balances)) {
			const parts = account.split(':');
			let node = tree;
			for (let i = 0; i < parts.length; i++) {
				const key = parts[i] ?? '';
				if (!node[key]) node[key] = { _total: 0, _children: {} };
				const treeNode = node[key] as BalanceTreeNode;
				treeNode._total += amount;
				if (i < parts.length - 1) {
					node = treeNode._children;
				}
			}
		}
		return tree;
	}
}
