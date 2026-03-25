import { PluginSettings } from './types';

export const PLUGIN_ID = 'simple-ledger';

/** Prefijos canónicos de las categorías de cuentas. */
export const ACCT = {
	income: 'Ingresos',
	expenses: 'Gastos',
	assets: 'Activos',
	liabilities: 'Pasivos',
} as const;
export const VIEW_TYPE_LEDGER = 'simple-ledger-view';
export const VIEW_TYPE_LEDGER_MAIN = 'simple-ledger-main-view';
export const VIEW_TYPE_RECURRING = 'simple-ledger-recurring-view';
export const VIEW_TYPE_QUICK_ADD = 'simple-ledger-quick-add';

export const DEFAULT_SETTINGS: PluginSettings = {
	ledgerFile: 'Finanzas.ledger',
	currencySymbol: '$',
	currencyAfter: false,
	decimals: 2,
	thousandSeparator: '.',
	recurringNotesFolder: 'Finanzas/Recurrentes',
	defaultAccounts: {
		expenses: [
			'Gastos:Comida',
			'Gastos:Transporte',
			'Gastos:Hogar',
			'Gastos:Salud',
			'Gastos:Entretenimiento',
			'Gastos:Ropa',
			'Gastos:Educacion',
			'Gastos:Servicios',
			'Gastos:Otros',
		],
		income: ['Ingresos:Salario', 'Ingresos:Freelance', 'Ingresos:Otros'],
		assets: ['Activos:Banco', 'Activos:Efectivo', 'Activos:Ahorros'],
		liabilities: ['Pasivos:TarjetaCredito', 'Pasivos:Prestamo'],
	},
	archivedAccounts: [],
	recurringTransactions: [],
	credits: [],
	savedFilters: { from: '', to: '', account: '', search: '' },
};
