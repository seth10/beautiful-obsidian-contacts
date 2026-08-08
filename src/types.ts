export interface ContactCardPluginSettings {
	birthdayDayFormat: string;
	birthdayMonthFormat: string;
	birthdayYearFormat: string;
	discordClient: boolean;
	renderFromProperties: boolean;
	hideProperties: boolean;
	// Show only current addresses on the card, hiding archived/past ones.
	showOnlyCurrentAddresses: boolean;
	// Show the apartment/building complex name alongside an address.
	showBuildingName: boolean;
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
	showOnlyCurrentAddresses: true,
	showBuildingName: true,
	lastSeenVersion: ''
};

export interface StringToStringArr {
	[key: string]: string[];
}

export interface Contact {
	name: string;
	nickname: string[];
	legalName: string;
	birthday: string;
	phone: string[];
	email: string[];
	insta: string[];
	beli: string[];
	discord: Discord[];
	addresses: Address[];
}

export interface Discord {
	handle: string;
	dm_channel_id?: string;
}

export type AddressPrecision = 'precise' | 'area' | 'approximate';

export interface Address {
	// Exactly one of these defines the place (precedence: address > near > area).
	address?: string;   // freeform, envelope-style street address  → precise
	near?: string;      // reference point the person lives near     → approximate
	area?: string;      // named neighborhood/region                → area
	radius?: string;    // uncertainty for near/area, raw text ("3 blocks", "0.5 mi")

	building?: string;  // apartment/building complex name (display option)
	label?: string;     // home | work | other  (maps to Google `type` later)

	// Optional structured components — opt-in, for future sync/geocoding accuracy.
	street?: string;
	unit?: string;
	city?: string;
	region?: string;
	postal?: string;
	country?: string;

	from?: string;      // optional move-in date
	until?: string;     // optional move-out date (presence ⇒ archived)
	archived?: boolean; // explicit flag (also accepts `current: false`)

	current: boolean;   // DERIVED: false if archived || until present, else true
}
