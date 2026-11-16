import { App, PluginSettingTab, Setting } from 'obsidian';
import type ContactCardPlugin from '../main';
import type { ContactCardPluginSettings } from './types';

type DeclarativeSettingDefinition = {
	name: string;
	desc?: string;
	control:
		| { type: 'toggle'; key: keyof ContactCardPluginSettings }
		| { type: 'dropdown'; key: keyof ContactCardPluginSettings; options: Record<string, string> };
};

export class ContactCardSettingTab extends PluginSettingTab {
	plugin: ContactCardPlugin;

	constructor(app: App, plugin: ContactCardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Obsidian 1.13+ renders and indexes these declarative definitions. Keep display() in sync
	// below as the fallback for the older versions this plugin still supports.
	getSettingDefinitions(): DeclarativeSettingDefinition[] {
		return [
			{
				name: 'Render from properties',
				desc: 'Build a contact card from a note\'s properties (frontmatter) and show it at the top of the note, in addition to "contact" code blocks',
				control: { type: 'toggle', key: 'renderFromProperties' }
			},
			{
				name: 'Hide properties panel on contact notes',
				desc: 'Hide Obsidian\'s raw Properties panel on notes that show a properties contact card, so the card is the only header',
				control: { type: 'toggle', key: 'hideProperties' }
			},
			{
				name: 'Show only current addresses',
				desc: 'Show only current addresses on the contact card, hiding archived/past ones (those with an end date or marked archived)',
				control: { type: 'toggle', key: 'showOnlyCurrentAddresses' }
			},
			{
				name: 'Show apartment/building complex name',
				desc: 'Display the apartment or building complex name alongside an address',
				control: { type: 'toggle', key: 'showBuildingName' }
			},
			{
				name: 'Birthday day format',
				desc: 'Display the day without or with a leading zero (when below 10)',
				control: {
					type: 'dropdown',
					key: 'birthdayDayFormat',
					options: { numeric: '3', '2-digit': '03' }
				}
			},
			{
				name: 'Birthday month format',
				desc: 'Display the entire month name, the three-letter abbreviation, only the first letter, the number representation, or number with a leading zero (when below 10)',
				control: {
					type: 'dropdown',
					key: 'birthdayMonthFormat',
					options: { long: 'March', short: 'Mar', narrow: 'M', numeric: '3', '2-digit': '03' }
				}
			},
			{
				name: 'Birthday year format',
				desc: 'Display the entire year or only the last two digits',
				control: {
					type: 'dropdown',
					key: 'birthdayYearFormat',
					options: { numeric: '1999', '2-digit': '99' }
				}
			},
			{
				name: 'Discord client installed',
				desc: 'Enable if you want to Discord links to open in your desktop/mobile client, disable if you want to open the Discord website',
				control: { type: 'toggle', key: 'discordClient' }
			}
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		// Keep the existing refresh behavior when declarative controls save a setting.
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
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
			.setName('Show only current addresses')
			.setDesc('Show only current addresses on the contact card, hiding archived/past ones (those with an end date or marked archived)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showOnlyCurrentAddresses)
				.onChange(async (value) => {
					this.plugin.settings.showOnlyCurrentAddresses = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Show apartment/building complex name')
			.setDesc('Display the apartment or building complex name alongside an address')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showBuildingName)
				.onChange(async (value) => {
					this.plugin.settings.showBuildingName = value;
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
