import { App, MarkdownPostProcessorContext, MarkdownView, Plugin, PluginSettingTab, Setting, TFile, editorInfoField, editorLivePreviewField } from 'obsidian';
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';

interface ContactCardPluginSettings {
	birthdayDayFormat: string;
	birthdayMonthFormat: string;
	birthdayYearFormat: string;
	discordClient: boolean;
	renderFromProperties: boolean;
	hideProperties: boolean;
}

const DEFAULT_SETTINGS: ContactCardPluginSettings = {
	birthdayDayFormat: 'numeric',
	birthdayMonthFormat: 'short',
	birthdayYearFormat: 'numeric',
	discordClient: true,
	renderFromProperties: true,
	hideProperties: true
};

interface StringToStringArr {
    [key: string]: string[];
}

interface Contact {
    name: string;
	nickname: string[];
	birthday: string;
    phone: string[];
    email: string[];
    insta: string[];
	discord: Discord[];
}

interface Discord {
	handle: string;
	dm_channel_id?: string;
}

function parseStringsToMap(strings: string[]): StringToStringArr {
	const result: StringToStringArr = {};

	strings.forEach(str => {
		const [keyPart, valuePart] = str.split(':');

		if (valuePart !== undefined) {
			const key = keyPart.trim().toLowerCase();

			let valueTrimmed = valuePart.trim();
			if (valueTrimmed.startsWith('[') && valueTrimmed.endsWith(']')) {
				// Remove brackets
				valueTrimmed = valueTrimmed.slice(1, -1);
			}

			let value;
			if (key == 'birthday') {
				value = [valueTrimmed];
			} else {
				value = valueTrimmed.split(',').map(item => item.trim()).filter(item => item.length > 0);
			}

			if (Array.isArray(result[key])) {
				result[key].push(...value);
			} else {
				result[key] = value;
			}
		}
	});

	return result;
}

function parseMapToContact(map: StringToStringArr): Contact | null {
	const contact: Contact = {
		name: (map['name'] ?? [])[0],
		nickname: (map['name'] ?? []).slice(1),
		birthday: (map['birthday'] ?? [])[0],
		phone: map['phone'] ?? [],
		email: map['email'] ?? [],
		insta: map['insta'] ?? [],
		discord: (map['discord'] ?? []).map(stringToDiscordHandleAndChannelId)
	};

	if (contact.phone) {
		contact.phone = contact.phone.map(formatPhoneNumber);
	}
	if (contact.email) {
		contact.email = contact.email.filter(validateEmail);
	}
	if (contact.insta) {
		contact.insta = contact.insta.map(removeLeadingAt);
	}

	return contact;
}

function stringToDiscordHandleAndChannelId(text: string): Discord {
	const cleanedText = (text.startsWith('<') && text.endsWith('>'))
		? text.slice(1, -1)
		: text;
	if (cleanedText.contains('|')) {
		const [handle, dm_channel_id] = cleanedText.split('|');
		if (isNaN(Number(dm_channel_id))) {
			return {
				handle: handle
			};
		}
		return {
			handle: handle,
			dm_channel_id: dm_channel_id
		};
	} else {
		return {
			handle: cleanedText
		};
	}
}

function formatPhoneNumber(phone: string): string {
	let cleaned = phone.replace(/\D/g, '');
	if (!cleaned.startsWith('1') && cleaned.length === 10) {
	  cleaned = '1' + cleaned;
	}
	return cleaned.replace(/^(\d{1})(\d{3})(\d{3})(\d{4})$/, '+$1 ($2) $3-$4');
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function validateEmail(email: string): boolean {
	return emailRegex.test(email);
}

function removeLeadingAt(input: string): string {
	return input.startsWith('@') ? input.slice(1) : input;
}

// Matches 1900-2099 anywhere in the string (separated by some break), or 33-99 anywhere in the string
const yearRegex = /\b(?:(?:19|20)[0-9]{2})|(?:3[3-9]|[4-9][0-9])\b/;
function formatBirthday(birthdayString: string, dayFormat: string, monthFormat: string, yearFormat: string): string | null {
	const birthdate = new Date(birthdayString);

	// Check if the date parsing was successful
	if (isNaN(birthdate.getTime())) {
		return null;
	} else if (yearRegex.test(birthdayString)) {
		return Intl.DateTimeFormat('en-US', {
			day: dayFormat as 'numeric' | '2-digit' | undefined,
			month: monthFormat as 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' | undefined,
			year: yearFormat as 'numeric' | '2-digit' | undefined
		}).format(birthdate);
	} else {
		return Intl.DateTimeFormat('en-US', {
			day: dayFormat as 'numeric' | '2-digit' | undefined,
			month: monthFormat as 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' | undefined
		}).format(birthdate);
	}
}

function calculateAge(birthdayString: string): number | null {
	const birthdate = new Date(birthdayString);

	// Check if the date parsing was successful
	if (isNaN(birthdate.getTime())) {
	    return null;
	}

	// If the original string has no year, don't return an age
	if (!yearRegex.test(birthdayString)) {
		return null;
	}

	const today = new Date();
	let age = today.getFullYear() - birthdate.getFullYear();
	const monthDifference = today.getMonth() - birthdate.getMonth();
	const dayDifference = today.getDate() - birthdate.getDate();

	// Adjust the age if the birthdate hasn't occurred yet this year
	if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
	    age--;
	}

	return age;
}

// Canonical contact field -> the frontmatter property aliases that map to it (compared case-insensitively).
const KNOWN_FIELD_KEYS: { [canonical: string]: string[] } = {
	name: ['name'],
	birthday: ['birthday'],
	phone: ['phone'],
	email: ['email'],
	insta: ['insta', 'instagram'],
	discord: ['discord']
};

// Normalize any frontmatter value (scalar / list / Date / number) into a trimmed string array.
function toStringArray(value: unknown): string[] {
	if (value === null || value === undefined) {
		return [];
	}
	if (Array.isArray(value)) {
		return value.flatMap(toStringArray);
	}
	if (value instanceof Date) {
		// YAML may parse a date property (e.g. `birthday: 2000-02-01`) into a Date at UTC midnight.
		// Render it back as Y/M/D so Date parsing in formatBirthday stays in the user's locale.
		const y = value.getUTCFullYear();
		const m = String(value.getUTCMonth() + 1).padStart(2, '0');
		const d = String(value.getUTCDate()).padStart(2, '0');
		return [`${y}/${m}/${d}`];
	}
	const str = String(value).trim();
	return str.length > 0 ? [str] : [];
}

// Convert a parsed frontmatter object into the StringToStringArr shape parseMapToContact expects.
function frontmatterToMap(fm: Record<string, unknown>): StringToStringArr {
	const lowerCased: Record<string, unknown> = {};
	for (const key of Object.keys(fm)) {
		lowerCased[key.toLowerCase()] = fm[key];
	}

	const map: StringToStringArr = {};
	for (const canonical of Object.keys(KNOWN_FIELD_KEYS)) {
		let values: string[] = [];
		for (const alias of KNOWN_FIELD_KEYS[canonical]) {
			if (lowerCased[alias] !== undefined) {
				values = values.concat(toStringArray(lowerCased[alias]));
			}
		}
		// Dedupe so e.g. both `insta` and `Instagram` properties don't render twice.
		values = Array.from(new Set(values));
		if (values.length > 0) {
			map[canonical] = values;
		}
	}
	return map;
}

// True if the frontmatter contains at least one recognized contact field.
function hasContactFields(fm: Record<string, unknown> | null | undefined): boolean {
	if (!fm) {
		return false;
	}
	return Object.keys(frontmatterToMap(fm)).length > 0;
}

function frontmatterToContact(fm: Record<string, unknown>): Contact | null {
	const map = frontmatterToMap(fm);
	if (Object.keys(map).length === 0) {
		return null;
	}
	return parseMapToContact(map);
}

// Build the .contact-card element from a Contact. Shared by the code block, the reading-view
// post-processor, and the Live Preview editor widget. Returns null when there is nothing to show.
function buildContactCardEl(contact: Contact | null, settings: ContactCardPluginSettings): HTMLElement | null {
	if (!contact) {
		return null;
	}

	const contactCard = createDiv({ cls: 'contact-card' });
	if (contact.name) {
		contactCard.createDiv({ cls: 'contact-name', text: contact.name });
	}
	if (contact.nickname.length > 0) {
		contactCard.createDiv({ cls: 'contact-field', text: `Nickname${contact.nickname.length > 1 ? 's' : ''}: ${contact.nickname.join(', ')}` });
	}
	if (contact.birthday) {
		const birthdayString = formatBirthday(
			contact.birthday,
			settings.birthdayDayFormat,
			settings.birthdayMonthFormat,
			settings.birthdayYearFormat
		) ?? contact.birthday;
		const age = calculateAge(contact.birthday);
		const ageString = age ? ` (${age} years old)` : '';
		contactCard.createDiv({ cls: 'contact-field', text: `Birthday: ${birthdayString}${ageString}` });
	}
	contact.phone.forEach(phone => {
		const phoneDiv = contactCard.createDiv({ cls: 'contact-field', text: '📞 ' });
		phoneDiv.createEl('a', { href: 'tel:' + phone, text: phone });
		const messageDiv = contactCard.createDiv({ cls: 'contact-field', text: '💬 ' });
		messageDiv.createEl('a', { href: 'sms:' + phone, text: phone });
	});
	contact.email.forEach(email => {
		const emailDiv = contactCard.createDiv({ cls: 'contact-field', text: '📧 ' });
		emailDiv.createEl('a', { href: 'mailto:' + email, text: email });
	});
	contact.insta.forEach(insta => {
		const instaDiv = contactCard.createDiv({ cls: 'contact-field', text: '📷 ' });
		instaDiv.createEl('a', { href: `https://www.instagram.com/${insta}/`, text: '@' + insta });
	});
	contact.discord.forEach(discord => {
		if (discord.dm_channel_id) {
			const discordDiv = contactCard.createDiv({ cls: 'contact-field', text: '🎮 ' });
			discordDiv.createEl('a', {
				href: (settings.discordClient ? 'discord://' : 'https://discord.com') + `/channels/@me/${discord.dm_channel_id}`,
				text: discord.handle });
		} else {
			contactCard.createDiv({ cls: 'contact-field', text: '🎮 ' + discord.handle });
		}
	});
	if (contactCard.childElementCount <= 1) {
		contactCard.createDiv({ cls: 'contact-field', text: '(no contact info)' });
	}
	return contactCard;
}

// A CM6 state effect used to force the Live Preview widget to rebuild when frontmatter changes
// somewhere other than the editor's own document (e.g. via another pane or the metadata cache).
const contactCardRefreshEffect = StateEffect.define<null>();

class ContactCardWidget extends WidgetType {
	constructor(private contact: Contact, private settings: ContactCardPluginSettings) {
		super();
	}

	eq(other: ContactCardWidget): boolean {
		return JSON.stringify(this.contact) === JSON.stringify(other.contact)
			&& JSON.stringify(this.settings) === JSON.stringify(other.settings);
	}

	toDOM(): HTMLElement {
		const el = buildContactCardEl(this.contact, this.settings) ?? createDiv();
		// Marker so only the Live Preview frontmatter widget gets top spacing (see styles.css),
		// without affecting code-block cards that also render inside the editor.
		el.addClass('contact-card-frontmatter');
		return el;
	}
}

// Live Preview editor extension: renders the contact card as a block widget at the very top of the
// note. Block decorations must be provided by a StateField (CodeMirror forbids them from ViewPlugins).
function buildContactCardEditorExtension(plugin: ContactCardPlugin): StateField<DecorationSet> {
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
						widget: new ContactCardWidget(contact, plugin.settings),
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

class ContactCardSettingTab extends PluginSettingTab {
	plugin: ContactCardPlugin;

	constructor(app: App, plugin: ContactCardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Render from properties')
			.setDesc('Build a contact card from a note\'s properties (frontmatter) and show it at the top of the note, in addition to "contact" code blocks')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.renderFromProperties)
				.onChange(async (value) => {
					this.plugin.settings.renderFromProperties = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Hide properties panel on contact notes')
			.setDesc('Hide Obsidian\'s raw Properties panel on notes that show a properties contact card, so the card is the only header')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideProperties)
				.onChange(async (value) => {
					this.plugin.settings.hideProperties = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Birthday day format')
			.setDesc('Display the day without or with a leading zero (when below 10)')
			.addDropdown(dropdown => dropdown
				.addOption('numeric', '3')
				.addOption('2-digit', '03')
				.setValue(this.plugin.settings.birthdayDayFormat)
				.onChange(async (value) => {
					this.plugin.settings.birthdayDayFormat = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Birthday month format')
			.setDesc('Display the entire month name, the three-letter abbreviation, only the first letter, the number representation, or number with a leading zero (when below 10)')
			.addDropdown(dropdown => dropdown
				.addOption('long', 'March')
				.addOption('short', 'Mar')
				.addOption('narrow', 'M')
				.addOption('numeric', '3')
				.addOption('2-digit', '03')
				.setValue(this.plugin.settings.birthdayMonthFormat)
				.onChange(async (value) => {
					this.plugin.settings.birthdayMonthFormat = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Birthday year format')
			.setDesc('Display the entire year or only the last two digits')
			.addDropdown(dropdown => dropdown
				.addOption('numeric', '1999')
				.addOption('2-digit', '99')
				.setValue(this.plugin.settings.birthdayYearFormat)
				.onChange(async (value) => {
					this.plugin.settings.birthdayYearFormat = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Discord client installed')
			.setDesc('Enable if you want to Discord links to open in your desktop/mobile client, disable if you want to open the Discord website')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.discordClient)
				.onChange(async (value) => {
					this.plugin.settings.discordClient = value;
					await this.plugin.saveSettings();
				}));
	}
}
