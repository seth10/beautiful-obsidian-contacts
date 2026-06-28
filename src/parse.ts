import { Address, Contact, Discord, StringToStringArr } from './types';

// Keys whose value is a single free-text string, so commas inside it must not be split into a list
// (addresses and birthdays naturally contain commas).
const NON_LIST_KEYS = ['birthday', 'address', 'building', 'area', 'near', 'radius'];

export function parseStringsToMap(strings: string[]): StringToStringArr {
	const result: StringToStringArr = {};

	strings.forEach(str => {
		// Split on the first colon only, so values may themselves contain colons.
		const colonIndex = str.indexOf(':');
		const keyPart = colonIndex === -1 ? undefined : str.slice(0, colonIndex);
		const valuePart = colonIndex === -1 ? undefined : str.slice(colonIndex + 1);

		if (valuePart !== undefined && keyPart !== undefined) {
			const key = keyPart.trim().toLowerCase();

			let valueTrimmed = valuePart.trim();
			if (!NON_LIST_KEYS.includes(key) && valueTrimmed.startsWith('[') && valueTrimmed.endsWith(']')) {
				// Remove brackets
				valueTrimmed = valueTrimmed.slice(1, -1);
			}

			let value;
			if (NON_LIST_KEYS.includes(key)) {
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

export function parseMapToContact(map: StringToStringArr): Contact | null {
	const contact: Contact = {
		name: (map['name'] ?? [])[0],
		nickname: (map['name'] ?? []).slice(1),
		birthday: (map['birthday'] ?? [])[0],
		phone: map['phone'] ?? [],
		email: map['email'] ?? [],
		insta: map['insta'] ?? [],
		discord: (map['discord'] ?? []).map(stringToDiscordHandleAndChannelId),
		addresses: mapToAddresses(map)
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

// Build addresses from a code-block map. Code blocks only express current entries (one per
// address/near/area line); archives and per-entry metadata are frontmatter-only. A `building` line
// attaches to the address at the same index; a `radius` line attaches to `near` (or `area`).
function mapToAddresses(map: StringToStringArr): Address[] {
	const addresses: Address[] = [];
	const buildingList = map['building'] ?? [];
	const radiusList = map['radius'] ?? [];
	const nearList = map['near'] ?? [];

	(map['address'] ?? []).forEach((address, i) => {
		addresses.push({ address, building: buildingList[i], current: true });
	});
	nearList.forEach((near, i) => {
		addresses.push({ near, radius: radiusList[i], current: true });
	});
	(map['area'] ?? []).forEach((area, i) => {
		addresses.push({ area, radius: nearList.length ? undefined : radiusList[i], current: true });
	});

	return addresses;
}

export function stringToDiscordHandleAndChannelId(text: string): Discord {
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

export function formatPhoneNumber(phone: string): string {
	let cleaned = phone.replace(/\D/g, '');
	if (!cleaned.startsWith('1') && cleaned.length === 10) {
	  cleaned = '1' + cleaned;
	}
	return cleaned.replace(/^(\d{1})(\d{3})(\d{3})(\d{4})$/, '+$1 ($2) $3-$4');
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export function validateEmail(email: string): boolean {
	return emailRegex.test(email);
}

export function removeLeadingAt(input: string): string {
	return input.startsWith('@') ? input.slice(1) : input;
}

// Matches 1900-2099 anywhere in the string (separated by some break), or 33-99 anywhere in the string
const yearRegex = /\b(?:(?:19|20)[0-9]{2})|(?:3[3-9]|[4-9][0-9])\b/;
export function formatBirthday(birthdayString: string, dayFormat: string, monthFormat: string, yearFormat: string): string | null {
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

export function calculateAge(birthdayString: string): number | null {
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
