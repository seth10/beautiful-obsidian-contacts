import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { buildContactCardEl } from './card';
import { frontmatterToContact, hasContactFields } from './frontmatter';
import { Contact, ContactCardPluginSettings } from './types';
import type ContactCardPlugin from '../main';

// A CM6 state effect used to force the Live Preview widget to rebuild when frontmatter changes
// somewhere other than the editor's own document (e.g. via another pane or the metadata cache).
export const contactCardRefreshEffect = StateEffect.define<null>();

class ContactCardWidget extends WidgetType {
	constructor(private contact: Contact, private settings: ContactCardPluginSettings, private plugin: ContactCardPlugin, private sourcePath: string) {
		super();
	}

	eq(other: ContactCardWidget): boolean {
		return JSON.stringify(this.contact) === JSON.stringify(other.contact)
			&& JSON.stringify(this.settings) === JSON.stringify(other.settings);
	}

	toDOM(): HTMLElement {
		const el = buildContactCardEl(this.contact, this.settings, { app: this.plugin.app, sourcePath: this.sourcePath }) ?? createDiv();
		// Marker so only the Live Preview frontmatter widget gets top spacing (see styles.css),
		// without affecting code-block cards that also render inside the editor.
		el.addClass('contact-card-frontmatter');
		return el;
	}
}

// Live Preview editor extension: renders the contact card as a block widget at the very top of the
// note. Block decorations must be provided by a StateField (CodeMirror forbids them from ViewPlugins).
export function buildContactCardEditorExtension(plugin: ContactCardPlugin): StateField<DecorationSet> {
	function build(state: EditorState): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		if (!plugin.settings.renderFromProperties) {
			return builder.finish();
		}
		// Only render in Live Preview, not in the raw source-mode editor.
		if (!state.field(editorLivePreviewField, false)) {
			return builder.finish();
		}

		const file = state.field(editorInfoField, false)?.file;
		if (file) {
			const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
			if (hasContactFields(fm)) {
				const contact = frontmatterToContact(fm as Record<string, unknown>);
				if (contact) {
					builder.add(0, 0, Decoration.widget({
						widget: new ContactCardWidget(contact, plugin.settings, plugin, file.path),
						block: true,
						side: -1
					}));
				}
			}
		}
		return builder.finish();
	}

	return StateField.define<DecorationSet>({
		create(state) {
			return build(state);
		},
		update(value, tr) {
			// Rebuild on document edits (which include frontmatter edits) or an explicit refresh
			// (frontmatter changed elsewhere, or settings changed). Otherwise keep the current set.
			if (tr.docChanged || tr.effects.some(e => e.is(contactCardRefreshEffect))) {
				return build(tr.state);
			}
			return value;
		},
		provide(field) {
			return EditorView.decorations.from(field);
		}
	});
}
