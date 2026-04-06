import { App, Modal } from 'obsidian';
import { PluginSettings, ISimpleLedgerPlugin } from '../types';
import { t } from '../i18n';

type Plugin = ISimpleLedgerPlugin;

export class ManageAccountsModal extends Modal {
	private plugin: Plugin;

	constructor(app: App, plugin: Plugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');
		contentEl.createEl('h2', { text: t('modal_manage_title') });

		const categories: { key: keyof PluginSettings['defaultAccounts']; label: string; prefix: string }[] = [
			{ key: 'expenses',    label: 'Gastos',    prefix: 'Gastos' },
			{ key: 'income',      label: 'Ingresos',  prefix: 'Ingresos' },
			{ key: 'assets',      label: 'Activos',   prefix: 'Activos' },
			{ key: 'liabilities', label: 'Pasivos',   prefix: 'Pasivos' },
		];

		for (const cat of categories) {
			const section = contentEl.createDiv('sl-accounts-section');
			section.createEl('h3', { text: cat.label });
			const list = section.createDiv('sl-accounts-list');
			this._renderAccountList(list, cat.key, categories);

			const addRow = section.createDiv('sl-add-account-row');
			const prefixSelect = addRow.createEl('select', { cls: 'sl-modal-prefix-select' });
			for (const c of categories) {
				const opt = prefixSelect.createEl('option', { value: c.prefix, text: c.prefix });
				if (c.key === cat.key) opt.selected = true;
			}
			addRow.createSpan({ text: ':', cls: 'sl-manage-sep' });
			const input = addRow.createEl('input', { type: 'text', placeholder: 'NuevaCuenta' });
			const addBtn = addRow.createEl('button', { text: '+', cls: 'sl-add-btn' });
			addBtn.addEventListener('click', () => {
				const sub = input.value.trim();
				if (!sub) return;
				const full = `${prefixSelect.value}:${sub}`;
				const targetCat = categories.find(c => c.prefix === prefixSelect.value);
				if (!targetCat) return;
				const accts = this.plugin.settings.defaultAccounts[targetCat.key];
				if (!accts.includes(full)) {
					accts.push(full);
					this.plugin.saveSettings();
					this._renderAccountList(list, cat.key, categories);
					input.value = '';
				}
			});
			input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
		}
	}

	private _renderAccountList(
		container: HTMLElement,
		categoryKey: keyof PluginSettings['defaultAccounts'],
		categories: { key: keyof PluginSettings['defaultAccounts']; label: string; prefix: string }[]
	): void {
		container.empty();
		const accounts = [...this.plugin.settings.defaultAccounts[categoryKey]].sort();
		for (const acct of accounts) {
			const row = container.createDiv('sl-account-row');
			const nameSpan = row.createSpan({ text: acct, cls: 'sl-account-name' });
			const btns = row.createDiv('sl-account-btns');
			const editBtn = btns.createEl('button', { text: '✎', cls: 'sl-edit-acct-btn', attr: { title: t('common_rename') } });
			editBtn.addEventListener('click', () => {
				const input = document.createElement('input');
				input.type = 'text';
				input.value = acct;
				input.className = 'sl-rename-input';
				nameSpan.replaceWith(input);
				input.focus();
				input.select();
				const save = () => {
					const newName = input.value.trim();
					if (newName && newName !== acct) {
						const srcAccounts = this.plugin.settings.defaultAccounts[categoryKey];
						const idx = srcAccounts.indexOf(acct);
						if (idx !== -1) srcAccounts[idx] = newName;
						this.plugin.renameAccount(acct, newName);
					} else {
						this.plugin.saveSettings();
					}
					this._renderAccountList(container, categoryKey, categories);
				};
				input.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') save();
					if (e.key === 'Escape') this._renderAccountList(container, categoryKey, categories);
				});
				input.addEventListener('blur', save);
			});
			const delBtn = btns.createEl('button', { text: '×', cls: 'sl-del-btn', attr: { title: t('common_delete') } });
			delBtn.addEventListener('click', () => {
				this.plugin.settings.defaultAccounts[categoryKey] = this.plugin.settings.defaultAccounts[categoryKey].filter(a => a !== acct);
				this.plugin.saveSettings();
				this._renderAccountList(container, categoryKey, categories);
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
