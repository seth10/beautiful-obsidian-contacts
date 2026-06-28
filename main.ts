import { MarkdownPostProcessorContext, MarkdownView, Plugin, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { buildContactCardEl } from './src/card';
import { buildContactCardEditorExtension, contactCardRefreshEffect } from './src/livePreview';
import { frontmatterToContact, hasContactFields } from './src/frontmatter';
import { parseMapToContact, parseStringsToMap } from './src/parse';
import { ContactCardSettingTab } from './src/settings';
import { ContactCardPluginSettings, DEFAULT_SETTINGS } from './src/types';

export default class ContactCardPlugin extends Plugin {
	settings: ContactCardPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ContactCardSettingTab(this.app, this));

		// 1. Existing code-block rendering (kept for backwards compatibility).
		this.registerMarkdownCodeBlockProcessor('contact', (source: string, element: HTMLElement, _context: MarkdownPostProcessorContext) => {
			// Each line of the code block with content
			const rows = source.split('\n').map(row => row.trim()).filter(row => row.length > 0);
			const map = parseStringsToMap(rows);
			const contact = parseMapToContact(map);

			const card = buildContactCardEl(contact, this.settings);
			if (card) {
				element.appendChild(card);
			}
		});

		// 2. Reading-view rendering from frontmatter, prepended to the top of the note body.
		// This fires once per rendered section, so it covers notes that have body content and keeps
		// the card alive when the preview re-renders on scroll. Notes with *only* frontmatter render
		// no sections (so this never fires for them) and are handled by refreshContactViews() instead.
		this.registerMarkdownPostProcessor((el, ctx) => {
			const fm = ctx.frontmatter ?? this.getFrontmatterForPath(ctx.sourcePath);
			const sizer = el.closest('.markdown-preview-sizer');
			if (sizer) {
				this.upsertReadingCard(sizer, fm);
			}
		});

		// 3. Live Preview rendering from frontmatter via a CodeMirror block widget.
		this.registerEditorExtension(buildContactCardEditorExtension(this));

		// 4. Hide the raw Properties panel on contact notes and keep everything in sync.
		this.registerEvent(this.app.workspace.on('file-open', () => this.refreshContactViews()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshContactViews()));
		this.registerEvent(this.app.workspace.on('layout-change', () => this.refreshContactViews()));
		this.registerEvent(this.app.metadataCache.on('changed', () => this.refreshContactViews()));

		this.app.workspace.onLayoutReady(() => this.refreshContactViews());
	}

	getFrontmatterForPath(sourcePath: string): Record<string, unknown> | undefined {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (file instanceof TFile) {
			return this.app.metadataCache.getFileCache(file)?.frontmatter;
		}
		return undefined;
	}

	// Update every open markdown view, then run once more on the next frame because the reading
	// view's DOM is often rendered a tick after the event that triggered this.
	refreshContactViews() {
		this.applyToMarkdownViews();
		activeWindow.requestAnimationFrame(() => this.applyToMarkdownViews());
	}

	applyToMarkdownViews() {
		this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
			const view = leaf.view as MarkdownView;
			const file = view.file;
			const fm = file ? this.app.metadataCache.getFileCache(file)?.frontmatter : null;
			const isContact = this.settings.renderFromProperties && hasContactFields(fm);

			// Hide the raw Properties panel on contact notes.
			view.containerEl.toggleClass('beautiful-contact-note', this.settings.hideProperties && isContact);

			// Reading-view card: covers frontmatter-only notes the post-processor never fires for.
			view.containerEl.querySelectorAll('.markdown-reading-view .markdown-preview-sizer').forEach(sizer => {
				this.upsertReadingCard(sizer, fm);
			});

			// Force the Live Preview StateField widget to rebuild from current frontmatter.
			// @ts-expect-error - the CodeMirror EditorView is not exposed on the typed Editor.
			const cm = view.editor?.cm as EditorView | undefined;
			cm?.dispatch({ effects: contactCardRefreshEffect.of(null) });
		});
	}

	// Insert/update/remove the frontmatter contact card as the first child of a reading-view sizer.
	// A signature stored on the element avoids rebuilding (and flickering) when nothing changed.
	upsertReadingCard(sizer: Element, fm: Record<string, unknown> | null | undefined) {
		const existing = sizer.querySelector(':scope > .contact-card') as HTMLElement | null;
		const contact = (this.settings.renderFromProperties && hasContactFields(fm))
			? frontmatterToContact(fm as Record<string, unknown>)
			: null;

		if (!contact) {
			existing?.remove();
			return;
		}

		const signature = JSON.stringify([contact, this.settings]);
		if (existing && existing.dataset.contactSig === signature) {
			return;
		}

		const card = buildContactCardEl(contact, this.settings);
		if (!card) {
			existing?.remove();
			return;
		}
		card.dataset.contactSig = signature;
		if (existing) {
			existing.replaceWith(card);
			return;
		}

		// Insert below the note's leading header elements (pusher, inline title, the hidden
		// properties panel) and above the first rendered content section.
		const HEADER_SELECTOR = '.markdown-preview-pusher, .inline-title, .mod-header, .metadata-container, .frontmatter';
		let anchor: Element | null = null;
		for (const child of Array.from(sizer.children)) {
			if (child.matches(HEADER_SELECTOR)) {
				anchor = child;
			} else {
				break;
			}
		}
		if (anchor) {
			anchor.after(card);
		} else {
			sizer.prepend(card);
		}
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		// New installs (no data.json → loadData() returns null) keep the default (on).
		// Users upgrading from a version that predates properties rendering have saved data that
		// lacks this key — preserve their prior behavior by leaving the card off until they opt in
		// via the "Render from properties" settings toggle.
		if (data && !('renderFromProperties' in data)) {
			this.settings.renderFromProperties = false;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshContactViews();
	}
}
