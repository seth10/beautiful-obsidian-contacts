import { App } from 'obsidian';
import { addressPrecision } from './address';
import { employmentDuration, formatEmploymentDate } from './employment';
import { calculateAge, formatBirthday } from './parse';
import { Address, Contact, ContactCardPluginSettings, Employment } from './types';

export interface CardContext {
	app: App;
	sourcePath?: string;
}

// A Google Maps search URL for a free-text place — used as the address link target.
function mapsHref(query: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Steam profile URLs use /id/ for a custom profile name and /profiles/ for a numeric SteamID64.
// Accept either bare identifier so contact properties remain concise, or a pasted Steam Community URL.
function steamProfileHref(steam: string): string {
	const pastedProfile = steam.match(/^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(id|profiles)\/([^/?#]+)\/?(?:[?#].*)?$/i);
	if (pastedProfile) {
		return `https://steamcommunity.com/${pastedProfile[1].toLowerCase()}/${pastedProfile[2]}/`;
	}
	return /^\d+$/.test(steam)
		? `https://steamcommunity.com/profiles/${steam}/`
		: `https://steamcommunity.com/id/${encodeURIComponent(steam)}/`;
}

// A precise street address as one query string, from the freeform value or structured components.
function preciseQuery(addr: Address): string {
	return addr.address ?? [addr.street, addr.unit, addr.city, addr.region, addr.postal].filter(Boolean).join(', ');
}

// Render one address as contact-field row(s) on the card.
function appendAddress(contactCard: HTMLElement, addr: Address, settings: ContactCardPluginSettings): void {
	const precision = addressPrecision(addr);
	const showBuilding = !!(settings.showBuildingName && addr.building);
	const hasPlace = !!(addr.address || addr.street || addr.city || addr.postal || addr.near || addr.area);

	// When archived entries are shown (the "only current" setting is off), label them.
	const markArchived = (div: HTMLElement) => {
		if (!addr.current) {
			div.appendText(addr.until ? ` (until ${addr.until})` : ' (past)');
		}
	};

	// A building-only entry with the building-name setting off has nothing to show.
	if (!hasPlace && !showBuilding) {
		return;
	}

	// A building with no address of its own: show it under the building glyph, linked to Maps.
	if (showBuilding && !hasPlace) {
		const div = contactCard.createDiv({ cls: 'contact-field', text: '🏢 ' });
		div.createEl('a', { href: mapsHref(addr.building as string), text: addr.building as string });
		markArchived(div);
		return;
	}

	// A building paired with a precise address: group both under one 📍 on two lines. The building
	// isn't linked — the address link below points at the same place, so a second link is redundant.
	if (showBuilding && precision === 'precise') {
		contactCard.createDiv({ cls: 'contact-field', text: '📍 ' + addr.building });
		const div = contactCard.createDiv({ cls: 'contact-field contact-address-line' });
		const query = preciseQuery(addr);
		div.createEl('a', { href: mapsHref(query), text: addr.address ?? query });
		markArchived(div);
		return;
	}

	// Otherwise a single 📍 line: a precise address, an approximate "near", or a named area.
	const fieldDiv = contactCard.createDiv({ cls: 'contact-field', text: '📍 ' });
	let query: string;
	let linkText: string;
	if (precision === 'approximate') {
		query = addr.near as string;
		linkText = 'near ' + addr.near + (addr.radius ? ` (~${addr.radius})` : '');
	} else if (precision === 'area') {
		query = addr.area as string;
		linkText = addr.area + ' (area)';
	} else {
		query = preciseQuery(addr);
		linkText = addr.address ?? query;
	}
	fieldDiv.createEl('a', { href: mapsHref(query), text: linkText });
	markArchived(fieldDiv);
}

// Render `[[target|label]]` values as working internal links. Text remains usable when a user has
// not created a separate company or manager note.
function appendLinkedText(parent: HTMLElement, value: string, context?: CardContext): void {
	const match = value.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
	if (!match || !context) {
		parent.appendText(value);
		return;
	}
	const target = match[1];
	const label = match[2] || target.replace(/#.*/, '');
	const link = parent.createEl('a', { cls: 'internal-link', text: label, href: target });
	link.dataset.href = target;
	link.addEventListener('click', event => {
		event.preventDefault();
		context.app.workspace.openLinkText(target, context.sourcePath ?? '', event.ctrlKey || event.metaKey);
	});
}

function appendEmployment(parent: HTMLElement, employment: Employment, context: CardContext | undefined, former: boolean): void {
	const employer = parent.createDiv({ cls: 'contact-field', text: '💼 ' });
	appendLinkedText(employer, employment.employer, context);
	if (employment.title || employment.department) {
		parent.createDiv({ cls: 'contact-field contact-employment-detail', text: [employment.title, employment.department].filter(Boolean).join(' · ') });
	}
	if (employment.manager) {
		const manager = parent.createDiv({ cls: 'contact-field contact-employment-detail', text: 'Reports to ' });
		appendLinkedText(manager, employment.manager, context);
	}
	const start = formatEmploymentDate(employment.started);
	const end = formatEmploymentDate(employment.ended);
	const duration = former
		? (employment.ended ? employmentDuration(employment.started, employment.ended) : null)
		: employmentDuration(employment.started);
	if (start || end) {
		const prefix = former ? [start, end].filter(Boolean).join(' – ') : (start ? `Since ${start}` : '');
		parent.createDiv({ cls: 'contact-field contact-employment-detail', text: [prefix, duration].filter(Boolean).join(' · ') });
	}
}

// Build the .contact-card element from a Contact. Shared by the code block, the reading-view
// post-processor, and the Live Preview editor widget. Returns null when there is nothing to show.
export function buildContactCardEl(contact: Contact | null, settings: ContactCardPluginSettings, context?: CardContext): HTMLElement | null {
	if (!contact) {
		return null;
	}

	const contactCard = createDiv({ cls: 'contact-card' });
	if (contact.name) {
		contactCard.createDiv({ cls: 'contact-name', text: contact.name });
	}
	if (contact.nickname.length > 0) {
		contactCard.createDiv({ cls: 'contact-field', text: `${contact.nickname.join(', ')}` });
	}
	if (contact.legalName) {
		contactCard.createDiv({ cls: 'contact-legal-name', text: contact.legalName });
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
	if (contact.currentEmployment) {
		appendEmployment(contactCard, contact.currentEmployment, context, false);
	}
	if (contact.employmentHistory.length > 0) {
		const history = contactCard.createEl('details', { cls: 'contact-employment-history' });
		history.createEl('summary', { text: `Employment history (${contact.employmentHistory.length})` });
		contact.employmentHistory.forEach(employment => appendEmployment(history, employment, context, true));
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
	contact.steam.forEach(steam => {
		const steamDiv = contactCard.createDiv({ cls: 'contact-field', text: '👾 ' });
		steamDiv.createEl('a', { href: steamProfileHref(steam), text: steam });
	});
	contact.beli.forEach((beli, index) => {
		const beliDiv = contactCard.createDiv({ cls: 'contact-field', text: '🍽️ ' });
		beliDiv.createEl('a', { href: `https://beliapp.co/app/${beli}`, text: beli });
		const beliName = contact.beliName[index];
		if (beliName) {
			beliDiv.appendText(` (${beliName})`);
		}
	});
	contact.NSO.forEach((nso, index) => {
		const nsoDiv = contactCard.createDiv({ cls: 'contact-field', text: '🟥 ' + nso });
		const friendCode = contact.NSOfriendCode[index];
		if (friendCode) {
			nsoDiv.createSpan({ cls: 'contact-nso-friend-code', text: ` (${friendCode})` });
		}
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
	contact.addresses
		.filter(addr => addr.current || !settings.showOnlyCurrentAddresses)
		.forEach(addr => appendAddress(contactCard, addr, settings));
	if (contactCard.childElementCount <= 1) {
		contactCard.createDiv({ cls: 'contact-field', text: '(no contact info)' });
	}
	return contactCard;
}
