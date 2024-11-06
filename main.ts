import { Plugin, MarkdownPostProcessorContext } from 'obsidian';

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

function calculateAge(birthdateString: string): number | null {
	const birthdate = new Date(birthdateString);

	// Check if the date parsing was successful
	if (isNaN(birthdate.getTime())) {
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

export default class ContactCardPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor('contact', (source: string, element: HTMLElement, context: MarkdownPostProcessorContext) => {
			// Each line of the code block with content
			const rows = source.split('\n').map(row => row.trim()).filter(row => row.length > 0);
			const map = parseStringsToMap(rows);
			const contact = parseMapToContact(map);

			if (contact) {
				const contactCard = element.createDiv({ cls: 'contact-card' });
				if (contact.name) {
					contactCard.createDiv({ cls: 'contact-name', text: contact.name});
				}
				if (contact.nickname.length > 0) {
					contactCard.createDiv({ cls: 'contact-field', text: `Nickname${contact.nickname.length > 1 ? 's' : ''}: ${contact.nickname.join(', ')}`});
				}
				if (contact.birthday) {
					const age = calculateAge(contact.birthday);
					const ageString = age ? ` (${age} years old)` : '';
					contactCard.createDiv({ cls: 'contact-field', text: `Birthday: ${contact.birthday}${ageString}`});
				}
				contact.phone.forEach(phone => {
					const phoneDiv = contactCard.createDiv({ cls: 'contact-field', text: '📞 '});
					phoneDiv.createEl('a', { href: 'tel:'+phone, text: phone});
					const messageDiv = contactCard.createDiv({ cls: 'contact-field', text: '💬 '});
					messageDiv.createEl('a', { href: 'sms:'+phone, text: phone});
				});
				contact.email.forEach(email => {
					const emailDiv = contactCard.createDiv({ cls: 'contact-field', text: '📧 '});
					emailDiv.createEl('a', { href: 'mailto:'+email, text: email});
				});
				contact.insta.forEach(insta => {
					const instaDiv = contactCard.createDiv({ cls: 'contact-field', text: '📷 '});
					instaDiv.createEl('a', { href: `https://www.instagram.com/${insta}/`, text: '@'+insta});
				});
				contact.discord.forEach(discord => {
					if (discord.dm_channel_id) {
						const discordDiv = contactCard.createDiv({ cls: 'contact-field', text: '🎮 '});
						discordDiv.createEl('a', { href: `discord://-/channels/@me/${discord.dm_channel_id}`, text: discord.handle});
					} else {
						contactCard.createDiv({ cls: 'contact-field', text: '🎮 '+discord.handle});
					}
				});
			}
		});
	}
}
