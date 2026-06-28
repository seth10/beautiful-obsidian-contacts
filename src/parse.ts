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
			const isBracketed = valueTrimmed.startsWith('[') && valueTrimmed.endsWith(']');

			let value;
			if (NON_LIST_KEYS.includes(key)) {
				// Free-text values keep their commas, so a bare value is one item. A bracketed value is
				// a list whose items must be quoted (e.g. `["123 Main St, Seattle", "456 South St"]`)
				// so the item-separating commas can be told apart from commas inside an address.
				value = isBracketed ? splitQuotedList(valueTrimmed.slice(1, -1)) : [valueTrimmed];
			} else {
				if (isBracketed) {
					// Remove brackets
					valueTrimmed = valueTrimmed.slice(1, -1);
				}
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

// Separate a `contact` code block into its flat `key: value` lines (parsed line-by-line, so repeated
// keys like multiple `address:` lines still work) and an optional nested `addresses:` block (handed
// to a real YAML parser for the list-of-objects form with per-entry until/archived). A code block
// can use either or both; only the YAML block can express archives.
export function extractAddressBlock(source: string): { flatRows: string[]; addressesYaml: string | null } {
	const flat: string[] = [];
	const block: string[] = [];
	let inBlock = false;

	for (const line of source.split('\n')) {
		const indented = /^\s/.test(line);
		const blank = line.trim().length === 0;
		// A block sequence item (`- ...`); YAML allows these at the same indent as the parent key,
		// so they may sit at column 0 with no leading whitespace.
		const listItem = /^\s*-/.test(line);

		// Once inside the block, keep consuming its list items, indented mapping lines, and blanks.
		if (inBlock && (indented || blank || listItem)) {
			block.push(line);
			continue;
		}
		inBlock = false;

		// A top-level `addresses:` line starts the block (inline flow list or a following indented block).
		if (/^addresses\s*:/i.test(line)) {
			block.push(line);
			inBlock = true;
			continue;
		}
		flat.push(line);
	}

	const flatRows = flat.map(row => row.trim()).filter(row => row.length > 0);
	return { flatRows, addressesYaml: block.length > 0 ? block.join('\n') : null };
}

// Split a bracketed free-text list on commas that fall outside quotes, so commas inside a quoted
// item (e.g. an address) are preserved. Surrounding single/double quotes are stripped from items.
function splitQuotedList(inner: string): string[] {
	const items: string[] = [];
	let current = '';
	let quote: string | null = null;

	for (const ch of inner) {
		if (quote) {
			if (ch === quote) {
				quote = null;
			} else {
				current += ch;
			}
		} else if (ch === '"' || ch === '\'') {
			quote = ch;
		} else if (ch === ',') {
			items.push(current.trim());
			current = '';
		} else {
			current += ch;
		}
	}
	items.push(current.trim());

	return items.filter(item => item.length > 0);
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

// Build addresses from the flat lines of a code-block map. These are always current entries (one per
// address/near/area line); archives and per-entry metadata come from the separate `addresses:` YAML
// block instead. A `building` line attaches to the address at the same index; a `radius` line
// attaches to `near` (or `area`).
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
