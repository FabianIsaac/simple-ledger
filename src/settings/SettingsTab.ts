import { App, Modal, PluginSettingTab, Setting } from 'obsidian';
import { ISimpleLedgerPlugin, AccountPrefixes } from '../types';
import { ManageAccountsModal } from '../modals/ManageAccountsModal';
import { t } from '../i18n';
import { setACCT, DEFAULT_PREFIXES_ES, DEFAULT_PREFIXES_EN, DEFAULT_ACCOUNTS_ES, DEFAULT_ACCOUNTS_EN } from '../constants';

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
		containerEl.createEl('h2', { text: t('settings_title') });

		new Setting(containerEl)
			.setName(t('settings_ledger_file'))
			.setDesc(t('settings_ledger_file_desc'))
			.addText(text => text
				.setPlaceholder('Finanzas.ledger')
				.setValue(this.plugin.settings.ledgerFile)
				.onChange(async (value) => {
					this.plugin.settings.ledgerFile = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_currency_symbol'))
			.setDesc(t('settings_currency_symbol_desc'))
			.addText(text => text
				.setValue(this.plugin.settings.currencySymbol)
				.onChange(async (value) => {
					this.plugin.settings.currencySymbol = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_currency_after'))
			.setDesc(t('settings_currency_after_desc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.currencyAfter)
				.onChange(async (value) => {
					this.plugin.settings.currencyAfter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_decimals'))
			.addText(text => text
				.setValue(String(this.plugin.settings.decimals))
				.onChange(async (value) => {
					const parsed = parseInt(value);
					this.plugin.settings.decimals = isNaN(parsed) ? 2 : parsed;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_thousands'))
			.setDesc(t('settings_thousands_desc'))
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
			.setName(t('settings_recurring_folder'))
			.setDesc(t('settings_recurring_folder_desc'))
			.addText(text => text
				.setPlaceholder('Finanzas/Recurrentes')
				.setValue(this.plugin.settings.recurringNotesFolder ?? 'Finanzas/Recurrentes')
				.onChange(async (value) => {
					this.plugin.settings.recurringNotesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_manage_accounts'))
			.setDesc(t('settings_manage_accounts_desc'))
			.addButton(btn => btn
				.setButtonText(t('settings_manage_accounts_btn'))
				.onClick(() => {
					new ManageAccountsModal(this.app, this.plugin).open();
				}));

		// ── Status bar ──────────────────────────────────────────────────────────
		containerEl.createEl('h3', { text: t('settings_statusbar_title') });

		new Setting(containerEl)
			.setName(t('settings_statusbar_show'))
			.setDesc(t('settings_statusbar_show_desc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBarDebts ?? true)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBarDebts = value;
					await this.plugin.saveSettings();
					(this.plugin as any)._updateStatusBar();
				}));

		new Setting(containerEl)
			.setName(t('settings_statusbar_days'))
			.setDesc(t('settings_statusbar_days_desc'))
			.addSlider(slider => slider
				.setLimits(1, 30, 1)
				.setValue(this.plugin.settings.statusBarLookaheadDays ?? 7)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.statusBarLookaheadDays = value;
					await this.plugin.saveSettings();
					(this.plugin as any)._updateStatusBar();
				}));

		// ── Account prefixes ─────────────────────────────────────────────────────
		containerEl.createEl('h3', { text: t('settings_prefixes_title') });
		containerEl.createEl('p', { text: t('settings_prefixes_desc'), cls: 'setting-item-description' });

		new Setting(containerEl)
			.setName(t('settings_prefix_expenses'))
			.addText(text => text
				.setValue(this.plugin.settings.accountPrefixes?.expenses ?? 'Gastos')
				.onChange(async (value) => {
					this.plugin.settings.accountPrefixes.expenses = value;
					setACCT(this.plugin.settings.accountPrefixes);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_prefix_income'))
			.addText(text => text
				.setValue(this.plugin.settings.accountPrefixes?.income ?? 'Ingresos')
				.onChange(async (value) => {
					this.plugin.settings.accountPrefixes.income = value;
					setACCT(this.plugin.settings.accountPrefixes);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_prefix_assets'))
			.addText(text => text
				.setValue(this.plugin.settings.accountPrefixes?.assets ?? 'Activos')
				.onChange(async (value) => {
					this.plugin.settings.accountPrefixes.assets = value;
					setACCT(this.plugin.settings.accountPrefixes);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_prefix_liabilities'))
			.addText(text => text
				.setValue(this.plugin.settings.accountPrefixes?.liabilities ?? 'Pasivos')
				.onChange(async (value) => {
					this.plugin.settings.accountPrefixes.liabilities = value;
					setACCT(this.plugin.settings.accountPrefixes);
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('p', { text: t('settings_prefix_warning'), cls: 'setting-item-description sl-settings-warning' });

		// ── Language presets ─────────────────────────────────────────────────────
		containerEl.createEl('h3', { text: t('settings_preset_label') });
		containerEl.createEl('p', { text: t('settings_preset_desc'), cls: 'setting-item-description' });

		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText(t('settings_preset_es_btn'))
				.onClick(() => {
					const current = this.plugin.settings.accountPrefixes;
					new PresetConfirmModal(this.app, current, DEFAULT_PREFIXES_ES, async () => {
						this.plugin.settings.accountPrefixes = { ...DEFAULT_PREFIXES_ES };
						this.plugin.settings.defaultAccounts = { ...DEFAULT_ACCOUNTS_ES };
						setACCT(this.plugin.settings.accountPrefixes);
						await this.plugin.saveSettings();
						this.display();
					}).open();
				}))
			.addButton(btn => btn
				.setButtonText(t('settings_preset_en_btn'))
				.onClick(() => {
					const current = this.plugin.settings.accountPrefixes;
					new PresetConfirmModal(this.app, current, DEFAULT_PREFIXES_EN, async () => {
						this.plugin.settings.accountPrefixes = { ...DEFAULT_PREFIXES_EN };
						this.plugin.settings.defaultAccounts = { ...DEFAULT_ACCOUNTS_EN };
						setACCT(this.plugin.settings.accountPrefixes);
						await this.plugin.saveSettings();
						this.display();
					}).open();
				}));
	}
}

class PresetConfirmModal extends Modal {
	constructor(
		app: App,
		private current: AccountPrefixes,
		private target: AccountPrefixes,
		private onConfirm: () => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: t('settings_preset_confirm_title') });

		const fromLabel = `${this.current.expenses} / ${this.current.income} / ${this.current.assets} / ${this.current.liabilities}`;
		const toLabel = `${this.target.expenses} / ${this.target.income} / ${this.target.assets} / ${this.target.liabilities}`;
		const msg = t('settings_preset_confirm_msg', { from: fromLabel, to: toLabel });

		msg.split('\n').forEach(line => {
			if (line.trim()) contentEl.createEl('p', { text: line });
		});

		const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

		btnRow.createEl('button', { text: t('settings_preset_cancel_btn') })
			.addEventListener('click', () => this.close());

		const confirmBtn = btnRow.createEl('button', {
			text: t('settings_preset_confirm_btn'),
			cls: 'mod-warning',
		});
		confirmBtn.addEventListener('click', async () => {
			await this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
