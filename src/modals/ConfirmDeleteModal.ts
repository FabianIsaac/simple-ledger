import { App, Modal } from 'obsidian';
import { t } from '../i18n';

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
		contentEl.createEl('h2', { text: t('modal_confirm_delete_title') });
		contentEl.createEl('p', { text: t('modal_confirm_delete_msg', { name: this.txName }) });
		contentEl.createEl('p', { text: t('modal_confirm_delete_warning'), cls: 'sl-warning-text' });

		const btnRow = contentEl.createDiv('sl-form-row sl-edit-btn-row');
		const cancelBtn = btnRow.createEl('button', { text: t('common_cancel'), cls: 'sl-cancel-btn' });
		cancelBtn.addEventListener('click', () => this.close());
		const confirmBtn = btnRow.createEl('button', { text: t('modal_confirm_delete_yes'), cls: 'sl-delete-btn' });
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
