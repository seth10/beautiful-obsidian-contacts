import { App, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface ContactCardPluginSettings {
	birthdayDayFormat: string;
	birthdayMonthFormat: string;
	birthdayYearFormat: string;
	discordClient: boolean;
}

const DEFAULT_SETTINGS: ContactCardPluginSettings = {
	birthdayDayFormat: 'numeric',
	birthdayMonthFormat: 'short',
	birthdayYearFormat: 'numeric',
	discordClient: true
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

function formatBirthday(birthdayString: string, dayFormat: string, monthFormat: string, yearFormat: string): string | null {
	const birthdate = new Date(birthdayString);

	// Check if the date parsing was successful
	if (isNaN(birthdate.getTime())) {
		return null;
	} else {
		return Intl.DateTimeFormat('en-US', {
			day: dayFormat as 'numeric' | '2-digit' | undefined,
			month: monthFormat as 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' | undefined,
			year: yearFormat as 'numeric' | '2-digit' | undefined
		}).format(birthdate);
	}
}

function calculateAge(birthdayString: string): number | null {
	const birthdate = new Date(birthdayString);

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
	settings: ContactCardPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ContactCardSettingTab(this.app, this));

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
					const birthdayString = formatBirthday(
						contact.birthday,
						this.settings.birthdayDayFormat,
						this.settings.birthdayMonthFormat,
						this.settings.birthdayYearFormat
					) ?? contact.birthday;
					const age = calculateAge(contact.birthday);
					const ageString = age ? ` (${age} years old)` : '';
					contactCard.createDiv({ cls: 'contact-field', text: `Birthday: ${birthdayString}${ageString}`});
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
						discordDiv.createEl('a', {
							href: (this.settings.discordClient ? 'discord://' : 'https://discord.com') + `/channels/@me/${discord.dm_channel_id}`,
							text: discord.handle});
					} else {
						contactCard.createDiv({ cls: 'contact-field', text: '🎮 '+discord.handle});
					}
				});
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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