import { Transaction, PluginSettings } from '../types';
import { ACCT } from '../constants';
import { fmtAmount } from './formatting';
import { t } from '../i18n';

function shortAmt(val: number, settings: PluginSettings): string {
	const abs = Math.abs(val);
	const sign = val < 0 ? '-' : '';
	const sym = settings.currencySymbol;
	if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
	if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
	return `${sign}${sym}${abs.toFixed(0)}`;
}

function svgEl(tag: string): Element {
	return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

interface BarPoint {
	period: string;
	label: string;
	income: number;
	expenses: number;
}

/**
 * Builds a grouped bar chart (income vs expenses per period) into `parent`.
 * period: 'month' groups by YYYY/MM, 'year' groups by YYYY.
 */
export function buildBarContent(
	parent: HTMLElement,
	txs: Transaction[],
	settings: PluginSettings,
	period: 'month' | 'year',
): void {
	if (txs.length === 0) {
		parent.createEl('p', { text: t('common_empty_no_data'), cls: 'sl-empty-msg' });
		return;
	}

	// Group by period
	const groups: Record<string, { income: number; expenses: number }> = {};
	for (const tx of txs) {
		const key = period === 'year' ? tx.date.substring(0, 4) : tx.date.substring(0, 7);
		if (!groups[key]) groups[key] = { income: 0, expenses: 0 };
		const g = groups[key]!;
		for (const p of tx.postings) {
			if (p.account.startsWith(ACCT.income) && p.amount !== null) {
				g.income += Math.abs(p.amount);
			} else if (p.account.startsWith(ACCT.expenses) && p.amount !== null) {
				g.expenses += Math.abs(p.amount);
			}
		}
	}

	const points: BarPoint[] = Object.entries(groups)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, val]) => ({
			period: key,
			label: period === 'year' ? key : key.substring(5), // MM or YYYY
			income: val.income,
			expenses: val.expenses,
		}));

	if (points.length === 0) {
		parent.createEl('p', { text: t('common_empty_no_data'), cls: 'sl-empty-msg' });
		return;
	}

	const chartW = 700; const chartH = 220;
	const padL = 60; const padR = 20; const padT = 20; const padB = 50;
	const plotW = chartW - padL - padR;
	const plotH = chartH - padT - padB;

	const maxVal = Math.max(...points.map(p => Math.max(p.income, p.expenses)), 1);

	const n = points.length;
	const groupW = plotW / n;
	const barW = Math.max(4, groupW * 0.35);
	const gap = barW * 0.2;

	const xGroup = (i: number) => padL + i * groupW + groupW / 2;
	const yScale = (v: number) => padT + plotH - (v / maxVal) * plotH;

	const svg = svgEl('svg') as SVGSVGElement;
	svg.setAttribute('viewBox', `0 0 ${chartW} ${chartH}`);
	svg.setAttribute('class', 'sl-chart-svg');

	// Grid lines
	const gridLines = 4;
	for (let i = 0; i <= gridLines; i++) {
		const y = padT + (i / gridLines) * plotH;
		const line = svgEl('line');
		line.setAttribute('x1', String(padL)); line.setAttribute('x2', String(chartW - padR));
		line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
		line.setAttribute('class', 'sl-chart-grid');
		svg.appendChild(line);
		const val = maxVal * (1 - i / gridLines);
		const lbl = svgEl('text');
		lbl.setAttribute('x', String(padL - 8)); lbl.setAttribute('y', String(y + 4));
		lbl.setAttribute('class', 'sl-chart-label');
		lbl.textContent = shortAmt(val, settings);
		svg.appendChild(lbl);
	}

	// Base line
	const baseLine = svgEl('line');
	baseLine.setAttribute('x1', String(padL)); baseLine.setAttribute('x2', String(chartW - padR));
	const baseY = String(padT + plotH);
	baseLine.setAttribute('y1', baseY); baseLine.setAttribute('y2', baseY);
	baseLine.setAttribute('class', 'sl-chart-zero');
	svg.appendChild(baseLine);

	// Bars + net dot
	for (let i = 0; i < points.length; i++) {
		const p = points[i]!;
		const cx = xGroup(i);
		const baseYNum = padT + plotH;

		// Income bar (left of center)
		if (p.income > 0) {
			const bh = (p.income / maxVal) * plotH;
			const rect = svgEl('rect');
			rect.setAttribute('x', String(cx - gap / 2 - barW));
			rect.setAttribute('y', String(baseYNum - bh));
			rect.setAttribute('width', String(barW));
			rect.setAttribute('height', String(bh));
			rect.setAttribute('class', 'sl-chart-bar-income');
			const title = svgEl('title');
			title.textContent = `${p.period} — Ingresos: ${fmtAmount(p.income, settings)}`;
			rect.appendChild(title);
			svg.appendChild(rect);
		}

		// Expense bar (right of center)
		if (p.expenses > 0) {
			const bh = (p.expenses / maxVal) * plotH;
			const rect = svgEl('rect');
			rect.setAttribute('x', String(cx + gap / 2));
			rect.setAttribute('y', String(baseYNum - bh));
			rect.setAttribute('width', String(barW));
			rect.setAttribute('height', String(bh));
			rect.setAttribute('class', 'sl-chart-bar-expense');
			const title = svgEl('title');
			title.textContent = `${p.period} — Gastos: ${fmtAmount(p.expenses, settings)}`;
			rect.appendChild(title);
			svg.appendChild(rect);
		}

		// Net dot
		const net = p.income - p.expenses;
		const circle = svgEl('circle');
		circle.setAttribute('cx', String(cx));
		circle.setAttribute('cy', String(yScale(Math.max(0, net))));
		circle.setAttribute('r', '3');
		circle.setAttribute('class', `sl-chart-dot ${net >= 0 ? 'sl-bar-net-pos' : 'sl-bar-net-neg'}`);
		const title = svgEl('title');
		title.textContent = `${p.period}\nIngresos: ${fmtAmount(p.income, settings)}\nGastos: ${fmtAmount(p.expenses, settings)}\nNeto: ${fmtAmount(net, settings)}`;
		circle.appendChild(title);
		svg.appendChild(circle);

		// Period label
		const lbl = svgEl('text');
		lbl.setAttribute('x', String(cx));
		lbl.setAttribute('y', String(chartH - padB + 16));
		lbl.setAttribute('class', 'sl-chart-date-label');
		lbl.textContent = p.label;
		svg.appendChild(lbl);
	}

	// Legend
	const legend = parent.createDiv('sl-chart-legend');
	const legInc = legend.createSpan({ cls: 'sl-legend-item' });
	legInc.createSpan({ cls: 'sl-legend-swatch sl-legend-income' });
	legInc.createSpan({ text: t('chart_legend_income') });
	const legExp = legend.createSpan({ cls: 'sl-legend-item' });
	legExp.createSpan({ cls: 'sl-legend-swatch sl-legend-expense' });
	legExp.createSpan({ text: t('chart_legend_expenses') });
	const legNet = legend.createSpan({ cls: 'sl-legend-item' });
	legNet.createSpan({ cls: 'sl-legend-swatch sl-legend-net' });
	legNet.createSpan({ text: t('chart_legend_net') });

	parent.appendChild(svg);
}
