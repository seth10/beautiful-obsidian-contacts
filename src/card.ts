import { addressPrecision } from './address';
import { calculateAge, formatBirthday } from './parse';
import { Address, Contact, ContactCardPluginSettings } from './types';

// A Google Maps search URL for a free-text place — used as the address link target.
function mapsHref(query: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Render one address as contact-field row(s) on the card.
function appendAddress(contactCard: HTMLElement, addr: Address, settings: ContactCardPluginSettings): void {
	const precision = addressPrecision(addr);

	if (precision === 'precise' && settings.showBuildingName && addr.building) {
		contactCard.createDiv({ cls: 'contact-field', text: '🏢 ' + addr.building });
	}

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
		query = addr.address ?? [addr.street, addr.unit, addr.city, addr.region, addr.postal].filter(Boolean).join(', ');
		linkText = addr.address ?? query;
	}
	fieldDiv.createEl('a', { href: mapsHref(query), text: linkText });

	// When archived entries are shown (the "only current" setting is off), label them.
	if (!addr.current) {
		fieldDiv.appendText(addr.until ? ` (until ${addr.until})` : ' (past)');
	}
}

// Build the .contact-card element from a Contact. Shared by the code block, the reading-view
// post-processor, and the Live Preview editor widget. Returns null when there is nothing to show.
export function buildContactCardEl(contact: Contact | null, settings: ContactCardPluginSettings): HTMLElement | null {
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
	contact.addresses
		.filter(addr => addr.current || !settings.showOnlyCurrentAddresses)
		.forEach(addr => appendAddress(contactCard, addr, settings));
	if (contactCard.childElementCount <= 1) {
		contactCard.createDiv({ cls: 'contact-field', text: '(no contact info)' });
	}
	return contactCard;
}
