import { App, PluginSettingTab, Setting } from 'obsidian';
import type ContactCardPlugin from '../main';

export class ContactCardSettingTab extends PluginSettingTab {
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
