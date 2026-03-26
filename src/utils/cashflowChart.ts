import { Transaction, PluginSettings } from '../types';
import { ACCT } from '../constants';
import { fmtAmount } from './formatting';

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

/**
 * Builds the cashflow chart (bars + cumulative net line) into `parent`.
 * Used by both LedgerMainView and the ledger-cashflow code block renderer.
 */
export function buildCashflowContent(
	parent: HTMLElement,
	txs: Transaction[],
	settings: PluginSettings,
): void {
	if (txs.length === 0) {
		parent.createEl('p', { text: 'Sin datos para mostrar', cls: 'sl-empty-msg' });
		return;
	}

	const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
	const dailyData: Record<string, { income: number; expenses: number }> = {};
	for (const tx of sorted) {
		if (!dailyData[tx.date]) dailyData[tx.date] = { income: 0, expenses: 0 };
		const day = dailyData[tx.date]!;
		for (const p of tx.postings) {
			if (p.account.startsWith(ACCT.income) && p.amount !== null) {
				day.income += Math.abs(p.amount);
			} else if (p.account.startsWith(ACCT.expenses) && p.amount !== null) {
				day.expenses += Math.abs(p.amount);
			}
		}
	}

	const dates = Object.keys(dailyData).sort();
	if (dates.length === 0) return;

	const points: { date: string; net: number; income: number; expenses: number }[] = [];
	let cumulative = 0;
	for (const d of dates) {
		const day = dailyData[d]!;
		cumulative += day.income - day.expenses;
		points.push({ date: d, net: cumulative, income: day.income, expenses: day.expenses });
	}

	const chartW = 700; const chartH = 200;
	const padL = 60; const padR = 20; const padT = 20; const padB = 40;
	const plotW = chartW - padL - padR;
	const plotH = chartH - padT - padB;

	const nets = points.map(p => p.net);
	const minVal = Math.min(0, ...nets);
	const maxVal = Math.max(0, ...nets);
	const range = maxVal - minVal || 1;

	const xScale = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
	const yScale = (v: number) => padT + plotH - ((v - minVal) / range) * plotH;

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
		const val = maxVal - (i / gridLines) * range;
		const lbl = svgEl('text');
		lbl.setAttribute('x', String(padL - 8)); lbl.setAttribute('y', String(y + 4));
		lbl.setAttribute('class', 'sl-chart-label');
		lbl.textContent = shortAmt(val, settings);
		svg.appendChild(lbl);
	}

	// Zero line
	if (minVal < 0) {
		const zLine = svgEl('line');
		zLine.setAttribute('x1', String(padL)); zLine.setAttribute('x2', String(chartW - padR));
		const zy = String(yScale(0));
		zLine.setAttribute('y1', zy); zLine.setAttribute('y2', zy);
		zLine.setAttribute('class', 'sl-chart-zero');
		svg.appendChild(zLine);
	}

	// Bars
	const barW = Math.max(2, plotW / points.length * 0.35);
	for (let i = 0; i < points.length; i++) {
		const p = points[i]!;
		if (p.income > 0) {
			const barH = (p.income / range) * plotH;
			const rect = svgEl('rect');
			rect.setAttribute('x', String(xScale(i) - barW));
			rect.setAttribute('y', String(yScale(0) - barH));
			rect.setAttribute('width', String(barW));
			rect.setAttribute('height', String(barH));
			rect.setAttribute('class', 'sl-chart-bar-income');
			const title = svgEl('title');
			title.textContent = `${p.date} — Ingresos: ${fmtAmount(p.income, settings)}`;
			rect.appendChild(title);
			svg.appendChild(rect);
		}
		if (p.expenses > 0) {
			const barH = (p.expenses / range) * plotH;
			const rect = svgEl('rect');
			rect.setAttribute('x', String(xScale(i)));
			rect.setAttribute('y', String(yScale(0) - barH));
			rect.setAttribute('width', String(barW));
			rect.setAttribute('height', String(barH));
			rect.setAttribute('class', 'sl-chart-bar-expense');
			const title = svgEl('title');
			title.textContent = `${p.date} — Gastos: ${fmtAmount(p.expenses, settings)}`;
			rect.appendChild(title);
			svg.appendChild(rect);
		}
	}

	// Net line
	if (points.length > 1) {
		const pathParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.net)}`);
		const path = svgEl('path');
		path.setAttribute('d', pathParts.join(' '));
		path.setAttribute('class', 'sl-chart-line');
		svg.appendChild(path);
	}

	// Dots with tooltip
	for (let i = 0; i < points.length; i++) {
		const p = points[i]!;
		const circle = svgEl('circle');
		circle.setAttribute('cx', String(xScale(i)));
		circle.setAttribute('cy', String(yScale(p.net)));
		circle.setAttribute('r', '4');
		circle.setAttribute('class', 'sl-chart-dot');
		const title = svgEl('title');
		title.textContent = `${p.date}\nIngresos: ${fmtAmount(p.income, settings)}\nGastos: ${fmtAmount(p.expenses, settings)}\nNeto acum: ${fmtAmount(p.net, settings)}`;
		circle.appendChild(title);
		svg.appendChild(circle);
	}

	// Date labels (first / middle / last)
	const labelIndices = points.length <= 3
		? points.map((_, i) => i)
		: [0, Math.floor(points.length / 2), points.length - 1];
	for (const i of labelIndices) {
		const p = points[i];
		if (!p) continue;
		const lbl = svgEl('text');
		lbl.setAttribute('x', String(xScale(i)));
		lbl.setAttribute('y', String(chartH - 5));
		lbl.setAttribute('class', 'sl-chart-date-label');
		lbl.textContent = p.date.substring(5);
		svg.appendChild(lbl);
	}

	// Legend
	const legend = parent.createDiv('sl-chart-legend');
	const legInc = legend.createSpan({ cls: 'sl-legend-item' });
	legInc.createSpan({ cls: 'sl-legend-swatch sl-legend-income' });
	legInc.createSpan({ text: ' Ingresos' });
	const legExp = legend.createSpan({ cls: 'sl-legend-item' });
	legExp.createSpan({ cls: 'sl-legend-swatch sl-legend-expense' });
	legExp.createSpan({ text: ' Gastos' });
	const legNet = legend.createSpan({ cls: 'sl-legend-item' });
	legNet.createSpan({ cls: 'sl-legend-swatch sl-legend-net' });
	legNet.createSpan({ text: ' Neto acumulado' });

	parent.appendChild(svg);
}
