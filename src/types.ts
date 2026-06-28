export interface ContactCardPluginSettings {
	birthdayDayFormat: string;
	birthdayMonthFormat: string;
	birthdayYearFormat: string;
	discordClient: boolean;
	renderFromProperties: boolean;
	hideProperties: boolean;
	// Version of the plugin that last wrote data.json. Empty string means "never stamped" (a fresh
	// install, or an upgrade from a version that didn't write this field). Used to give future
	// upgrades a reliable signal even when the user never changes a setting.
	lastSeenVersion: string;
}

export const DEFAULT_SETTINGS: ContactCardPluginSettings = {
	birthdayDayFormat: 'numeric',
	birthdayMonthFormat: 'short',
	birthdayYearFormat: 'numeric',
	discordClient: true,
	renderFromProperties: true,
	hideProperties: true,
	lastSeenVersion: ''
};

export interface StringToStringArr {
	[key: string]: string[];
}

export interface Contact {
	name: string;
	nickname: string[];
	birthday: string;
	phone: string[];
	email: string[];
	insta: string[];
	discord: Discord[];
}

export interface Discord {
	handle: string;
	dm_channel_id?: string;
}
