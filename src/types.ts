export interface ContactCardPluginSettings {
	birthdayDayFormat: string;
	birthdayMonthFormat: string;
	birthdayYearFormat: string;
	discordClient: boolean;
	renderFromProperties: boolean;
	hideProperties: boolean;
}

export const DEFAULT_SETTINGS: ContactCardPluginSettings = {
	birthdayDayFormat: 'numeric',
	birthdayMonthFormat: 'short',
	birthdayYearFormat: 'numeric',
	discordClient: true,
	renderFromProperties: true,
	hideProperties: true
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
