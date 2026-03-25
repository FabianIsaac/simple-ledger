import { App, PluginSettingTab, Setting } from 'obsidian';
import { PluginSettings, ISimpleLedgerPlugin } from '../types';
import { ManageAccountsModal } from '../modals/ManageAccountsModal';

type Plugin = ISimpleLedgerPlugin;

export class LedgerSettingTab extends PluginSettingTab {
	private plugin: Plugin;

	constructor(app: App, plugin: Plugin) {
		super(app, plugin as never);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Simple Ledger - Ajustes' });

		new Setting(containerEl)
			.setName('Archivo de transacciones')
			.setDesc('Ruta del archivo .ledger dentro del vault')
			.addText(text => text
				.setPlaceholder('Finanzas.ledger')
				.setValue(this.plugin.settings.ledgerFile)
				.onChange(async (value) => {
					this.plugin.settings.ledgerFile = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Simbolo de moneda')
			.setDesc('Ej: $, €, £')
			.addText(text => text
				.setValue(this.plugin.settings.currencySymbol)
				.onChange(async (value) => {
					this.plugin.settings.currencySymbol = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Moneda despues del numero')
			.setDesc('Activar para formato "100.00 €" en vez de "$100.00"')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.currencyAfter)
				.onChange(async (value) => {
					this.plugin.settings.currencyAfter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Decimales')
			.addText(text => text
				.setValue(String(this.plugin.settings.decimals))
				.onChange(async (value) => {
					const parsed = parseInt(value);
					this.plugin.settings.decimals = isNaN(parsed) ? 2 : parsed;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Separador de miles')
			.setDesc('Solo para mostrar, no afecta el almacenamiento')
			.addDropdown(drop => drop
				.addOption('', 'Sin separador  (1000000)')
				.addOption('.', 'Punto  (1.000.000) — Chile, Europa')
				.addOption(',', 'Coma  (1,000,000) — EE.UU.')
				.addOption("'", "Apóstrofe  (1'000'000) — Suiza")
				.addOption(' ', 'Espacio  (1 000 000) — Francia')
				.setValue(this.plugin.settings.thousandSeparator ?? '.')
				.onChange(async (value) => {
					this.plugin.settings.thousandSeparator = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Carpeta de notas recurrentes')
			.setDesc('Ruta donde se crean las notas de cada transacción recurrente')
			.addText(text => text
				.setPlaceholder('Finanzas/Recurrentes')
				.setValue(this.plugin.settings.recurringNotesFolder ?? 'Finanzas/Recurrentes')
				.onChange(async (value) => {
					this.plugin.settings.recurringNotesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Gestionar cuentas')
			.setDesc('Agregar o eliminar cuentas predeterminadas')
			.addButton(btn => btn
				.setButtonText('Abrir')
				.onClick(() => {
					new ManageAccountsModal(this.app, this.plugin).open();
				}));
	}
}
