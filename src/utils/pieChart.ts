import { PluginSettings } from '../types';
import { fmtAmount } from './formatting';

const PIE_COLORS = [
	'#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
	'#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

export interface PieSlice {
	label: string;
	value: number;
}

/**
 * Aggregates flat balances into pie slices grouped at the given nesting level.
 * nivel=1 → groups by 2nd segment (e.g. Gastos:Comida)
 * nivel=2 → groups by 3rd segment (e.g. Gastos:Comida:Restaurantes)
 */
export function computePieData(
	balances: Record<string, number>,
	prefix: string,
	nivel: 1 | 2,
): PieSlice[] {
	const prefixDepth = prefix.split(':').length;
	const groups: Record<string, number> = {};

	for (const [acct, amt] of Object.entries(balances)) {
		if (!acct.startsWith(prefix)) continue;
		const parts = acct.split(':');
		const groupKey = parts.slice(0, prefixDepth + nivel).join(':');
		groups[groupKey] = (groups[groupKey] ?? 0) + Math.abs(amt);
	}

	const slices: PieSlice[] = Object.entries(groups)
		.map(([key, value]) => ({
			label: key.split(':').slice(prefixDepth).join(':'),
			value,
		}))
		.filter(s => s.value > 0)
		.sort((a, b) => b.value - a.value);

	// Cap at 9 slices + "Otros" for the rest
	if (slices.length > 9) {
		const shown = slices.slice(0, 9);
		const othersValue = slices.slice(9).reduce((s, d) => s + d.value, 0);
		shown.push({ label: 'Otros', value: othersValue });
		return shown;
	}
	return slices;
}

function svgEl(tag: string): SVGElement {
	return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

/**
 * Builds a responsive SVG donut pie chart.
 * @param shortAmount  Optional formatter for the center total label.
 */
export function buildPieSvg(
	pieData: PieSlice[],
	settings: PluginSettings,
	shortAmount?: (v: number) => string,
): SVGElement {
	const total = pieData.reduce((s, d) => s + d.value, 0);

	// Layout
	const svgW = 520;
	const svgH = Math.max(260, 40 + pieData.length * 22);
	const cx = 130;
	const cy = svgH / 2;
	const r = Math.min(110, cy - 20);
	const innerR = r * 0.42;
	const legendX = cx * 2 + 20;

	const svg = svgEl('svg') as SVGSVGElement;
	svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
	svg.setAttribute('class', 'sl-chart-svg sl-pie-svg');

	// Draw slices
	let startAngle = -Math.PI / 2;
	for (let i = 0; i < pieData.length; i++) {
		const { label, value } = pieData[i]!;
		const fraction = value / total;
		const endAngle = startAngle + fraction * 2 * Math.PI;
		const color = PIE_COLORS[i % PIE_COLORS.length]!;
		const largeArc = fraction > 0.5 ? 1 : 0;

		const x1 = cx + r * Math.cos(startAngle);
		const y1 = cy + r * Math.sin(startAngle);
		const x2 = cx + r * Math.cos(endAngle);
		const y2 = cy + r * Math.sin(endAngle);
		const ix1 = cx + innerR * Math.cos(startAngle);
		const iy1 = cy + innerR * Math.sin(startAngle);
		const ix2 = cx + innerR * Math.cos(endAngle);
		const iy2 = cy + innerR * Math.sin(endAngle);

		const path = svgEl('path');
		path.setAttribute('d', `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`);
		path.setAttribute('fill', color);
		path.setAttribute('class', 'sl-pie-slice');
		const titleEl = svgEl('title');
		titleEl.textContent = `${label}: ${fmtAmount(value, settings)} (${(fraction * 100).toFixed(1)}%)`;
		path.appendChild(titleEl);
		svg.appendChild(path);

		startAngle = endAngle;
	}

	// Center label
	const centerLabel = svgEl('text');
	centerLabel.setAttribute('x', String(cx));
	centerLabel.setAttribute('y', String(cy - 6));
	centerLabel.setAttribute('class', 'sl-pie-center-label');
	centerLabel.textContent = 'Total';
	svg.appendChild(centerLabel);

	const centerAmt = svgEl('text');
	centerAmt.setAttribute('x', String(cx));
	centerAmt.setAttribute('y', String(cy + 14));
	centerAmt.setAttribute('class', 'sl-pie-center-amount');
	centerAmt.textContent = shortAmount ? shortAmount(total) : fmtAmount(total, settings);
	svg.appendChild(centerAmt);

	// Legend
	for (let i = 0; i < pieData.length; i++) {
		const { label, value } = pieData[i]!;
		const color = PIE_COLORS[i % PIE_COLORS.length]!;
		const pct = ((value / total) * 100).toFixed(1);
		const ly = 20 + i * 22;

		const swatch = svgEl('rect');
		swatch.setAttribute('x', String(legendX));
		swatch.setAttribute('y', String(ly));
		swatch.setAttribute('width', '11');
		swatch.setAttribute('height', '11');
		swatch.setAttribute('fill', color);
		swatch.setAttribute('rx', '2');
		svg.appendChild(swatch);

		const labelText = svgEl('text');
		labelText.setAttribute('x', String(legendX + 16));
		labelText.setAttribute('y', String(ly + 9));
		labelText.setAttribute('class', 'sl-pie-legend-label');
		labelText.textContent = `${label}  ${pct}%`;
		svg.appendChild(labelText);

		const amtText = svgEl('text');
		amtText.setAttribute('x', String(svgW - 4));
		amtText.setAttribute('y', String(ly + 9));
		amtText.setAttribute('class', 'sl-pie-legend-amount');
		amtText.textContent = fmtAmount(value, settings);
		svg.appendChild(amtText);
	}

	return svg as unknown as SVGElement;
}
