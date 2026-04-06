import { App, Modal, Notice, TFile } from 'obsidian';
import { Transaction, ISimpleLedgerPlugin } from '../types';
import { t } from '../i18n';
import { LedgerParser } from '../parser/LedgerParser';
import { fmtAmount } from '../utils/formatting';

type Plugin = ISimpleLedgerPlugin;

export class ImportTransactionsModal extends Modal {
	private plugin: Plugin;
	private onImported: () => void;
	private parsed: Transaction[] = [];

	constructor(app: App, plugin: Plugin, onImported: () => void) {
		super(app);
		this.plugin = plugin;
		this.onImported = onImported;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal', 'sl-import-modal');
		contentEl.createEl('h2', { text: t('modal_import_title') });

		// AI helper bar
		const aiBar = contentEl.createDiv('sl-import-ai-bar');
		aiBar.createSpan({ text: t('modal_import_step1'), cls: 'sl-import-ai-hint' });
		const copyBtn = aiBar.createEl('button', { text: t('modal_import_btn_copy'), cls: 'sl-quick-btn sl-import-copy-btn' });
		copyBtn.addEventListener('click', () => {
			const prompt = this._buildAiPrompt();
			navigator.clipboard.writeText(prompt).then(() => {
				copyBtn.textContent = t('modal_import_btn_copied');
				setTimeout(() => { copyBtn.textContent = t('modal_import_btn_copy'); }, 2000);
			});
		});

		contentEl.createEl('p', { text: t('modal_import_step2'), cls: 'sl-import-hint' });

		// Textarea
		const textarea = contentEl.createEl('textarea', {
			cls: 'sl-import-textarea',
			attr: { placeholder: '2026/03/25 * Supermercado\n    Gastos:Comida          $15.000\n    Activos:Banco\n\n2026/03/25 * Netflix\n    Gastos:Entretenimiento  $9.990\n    Pasivos:TarjetaCredito', rows: '12' },
		});

		// Buttons — declarados antes de updatePreview para que el closure los vea
		const btnRow = contentEl.createDiv('sl-form-row sl-btn-row');
		const cancelBtn = btnRow.createEl('button', { text: t('modal_import_btn_cancel') });
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = btnRow.createEl('button', {
			text: t('modal_import_btn_import'),
			cls: 'mod-cta sl-submit-btn',
		});
		submitBtn.disabled = true;
		submitBtn.addEventListener('click', async () => {
			if (this.parsed.length === 0) return;
			await this._doImport(textarea.value.trim());
		});

		// Preview area
		const preview = contentEl.createDiv('sl-import-preview');
		const previewStatus = preview.createDiv('sl-import-status');
		const previewList = preview.createDiv('sl-import-list');

		const updatePreview = () => {
			const text = textarea.value;
			this.parsed = text.trim() ? LedgerParser.parse(text) : [];
			previewStatus.empty();
			previewList.empty();

			if (!text.trim()) {
				previewStatus.createSpan({ text: t('modal_import_neutral'), cls: 'sl-import-neutral' });
				submitBtn.disabled = true;
				submitBtn.textContent = t('modal_import_btn_import');
				return;
			}

			if (this.parsed.length === 0) {
				previewStatus.createSpan({ text: t('modal_import_error_format'), cls: 'sl-import-error' });
				submitBtn.disabled = true;
				submitBtn.textContent = t('modal_import_btn_import');
				return;
			}

			const n = this.parsed.length;
			previewStatus.createSpan({
				text: n === 1 ? t('modal_import_found_one') : t('modal_import_found_many', { n }),
				cls: 'sl-import-ok',
			});
			submitBtn.disabled = false;
			submitBtn.textContent = n === 1 ? t('modal_import_btn_import_one') : t('modal_import_btn_import_many', { n });

			const settings = this.plugin.settings;
			for (const tx of this.parsed) {
				const row = previewList.createDiv('sl-import-tx-row');
				const meta = row.createDiv('sl-import-tx-meta');
				meta.createSpan({ text: tx.date, cls: 'sl-import-tx-date' });
				meta.createSpan({ text: tx.payee, cls: 'sl-import-tx-payee' });
				const posPosting = tx.postings.find(p => (p.amount ?? 0) > 0) ?? tx.postings[0];
				if (posPosting?.amount != null) {
					row.createSpan({
						text: fmtAmount(Math.abs(posPosting.amount), settings),
						cls: 'sl-import-tx-amount',
					});
				}
			}
		};

		textarea.addEventListener('input', updatePreview);
		updatePreview();

		setTimeout(() => textarea.focus(), 50);
	}

	private async _doImport(rawText: string): Promise<void> {
		const settings = this.plugin.settings;
		const filePath = settings.ledgerFile;

		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file) {
				const header = `; Simple Ledger - Archivo de transacciones\n; Formato compatible con ledger-cli\n; Creado: ${new Date().toISOString().slice(0, 10)}\n\n`;
				await this.app.vault.create(filePath, header + rawText + '\n');
			} else if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				await this.app.vault.modify(file, content + '\n' + rawText + '\n');
			}
		} catch (e) {
			console.error('Simple Ledger: error al importar', e);
			new Notice(t('notice_import_error'));
			return;
		}

		await this.plugin.loadTransactions();
		const n = this.parsed.length;
		new Notice(n === 1 ? t('notice_imported_one') : t('notice_imported_many', { n }));
		this.onImported();
		this.close();
	}

	private _buildAiPrompt(): string {
		const settings = this.plugin.settings;
		const txAccounts = new Set<string>();
		for (const tx of this.plugin.transactions) {
			for (const p of tx.postings) txAccounts.add(p.account);
		}

		const categories: { label: string; key: keyof typeof settings.defaultAccounts }[] = [
			{ label: 'GASTOS',    key: 'expenses' },
			{ label: 'INGRESOS',  key: 'income' },
			{ label: 'ACTIVOS',   key: 'assets' },
			{ label: 'PASIVOS',   key: 'liabilities' },
		];

		const lines: string[] = [
			'Tengo las siguientes cuentas en mi sistema de contabilidad (formato ledger-cli):',
			'',
		];

		for (const cat of categories) {
			const defaults = settings.defaultAccounts[cat.key];
			const prefixMap: Record<string, string> = { expenses: 'Gastos', income: 'Ingresos', assets: 'Activos', liabilities: 'Pasivos' };
			const prefix = prefixMap[cat.key] ?? '';
			const fromTxs = [...txAccounts].filter(a => a.startsWith(prefix));
			const all = [...new Set([...defaults, ...fromTxs])].sort();
			lines.push(`${cat.label}: ${all.join(', ')}`);
		}

		lines.push(
			'',
			'Convierte los movimientos bancarios que te voy a pegar al formato ledger-cli,',
			'usando SOLO las cuentas listadas arriba. Si no estás seguro de la categoría,',
			'usa la cuenta "Otros" del tipo correspondiente.',
			'',
			'Formato esperado:',
			'',
			'2026/03/25 * Descripcion del movimiento',
			'    Gastos:Categoria          $monto',
			'    Activos:Banco',
			'',
			'Responde SOLO con el texto en formato ledger, sin explicaciones ni comentarios.',
			'',
			'Movimientos a convertir:',
			'[PEGA AQUÍ TU EXTRACTO O CORREO DEL BANCO]',
		);

		return lines.join('\n');
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
