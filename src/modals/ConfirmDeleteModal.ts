import { App, Modal } from 'obsidian';

export class ConfirmDeleteModal extends Modal {
	private txName: string;
	private onConfirm: () => void;

	constructor(app: App, txName: string, onConfirm: () => void) {
		super(app);
		this.txName = txName;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('simple-ledger-modal');
		contentEl.createEl('h2', { text: 'Eliminar transaccion' });
		contentEl.createEl('p', { text: `¿Seguro que quieres eliminar "${this.txName}"?` });
		contentEl.createEl('p', { text: 'Esta accion no se puede deshacer.', cls: 'sl-warning-text' });

		const btnRow = contentEl.createDiv('sl-form-row sl-edit-btn-row');
		const cancelBtn = btnRow.createEl('button', { text: 'Cancelar', cls: 'sl-cancel-btn' });
		cancelBtn.addEventListener('click', () => this.close());
		const confirmBtn = btnRow.createEl('button', { text: 'Si, eliminar', cls: 'sl-delete-btn' });
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
