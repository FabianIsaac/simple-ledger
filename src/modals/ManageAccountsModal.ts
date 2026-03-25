import { App, Modal } from 'obsidian';
import { PluginSettings, ISimpleLedgerPlugin } from '../types';

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
		contentEl.createEl('h2', { text: 'Gestionar cuentas' });

		const categories: { key: keyof PluginSettings['defaultAccounts']; label: string; prefix: string }[] = [
			{ key: 'expenses', label: 'Gastos', prefix: 'Gastos' },
			{ key: 'income', label: 'Ingresos', prefix: 'Ingresos' },
			{ key: 'assets', label: 'Activos', prefix: 'Activos' },
			{ key: 'liabilities', label: 'Pasivos', prefix: 'Pasivos' },
		];

		for (const cat of categories) {
			const section = contentEl.createDiv('sl-accounts-section');
			section.createEl('h3', { text: cat.label });
			const list = section.createDiv('sl-accounts-list');
			this._renderAccountList(list, cat.key);

			const addRow = section.createDiv('sl-add-account-row');
			const input = addRow.createEl('input', { type: 'text', placeholder: `${cat.prefix}:NuevaCuenta` });
			const addBtn = addRow.createEl('button', { text: '+', cls: 'sl-add-btn' });
			addBtn.addEventListener('click', () => {
				let val = input.value.trim();
				if (!val) return;
				if (!val.startsWith(cat.prefix + ':')) {
					val = `${cat.prefix}:${val}`;
				}
				if (!this.plugin.settings.defaultAccounts[cat.key].includes(val)) {
					this.plugin.settings.defaultAccounts[cat.key].push(val);
					this.plugin.saveSettings();
					this._renderAccountList(list, cat.key);
					input.value = '';
				}
			});
		}
	}

	private _renderAccountList(container: HTMLElement, categoryKey: keyof PluginSettings['defaultAccounts']): void {
		container.empty();
		const accounts = this.plugin.settings.defaultAccounts[categoryKey];
		for (const acct of accounts) {
			const row = container.createDiv('sl-account-row');
			const nameSpan = row.createSpan({ text: acct, cls: 'sl-account-name' });
			const btns = row.createDiv('sl-account-btns');
			const editBtn = btns.createEl('button', { text: '✎', cls: 'sl-edit-acct-btn', attr: { title: 'Renombrar' } });
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
						const idx = accounts.indexOf(acct);
						if (idx !== -1) accounts[idx] = newName;
						this.plugin.renameAccount(acct, newName);
					}
					this.plugin.saveSettings();
					this._renderAccountList(container, categoryKey);
				};
				input.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') save();
					if (e.key === 'Escape') this._renderAccountList(container, categoryKey);
				});
				input.addEventListener('blur', save);
			});
			const delBtn = btns.createEl('button', { text: '×', cls: 'sl-del-btn', attr: { title: 'Eliminar' } });
			delBtn.addEventListener('click', () => {
				this.plugin.settings.defaultAccounts[categoryKey] = accounts.filter(a => a !== acct);
				this.plugin.saveSettings();
				this._renderAccountList(container, categoryKey);
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
