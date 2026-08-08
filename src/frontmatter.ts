import { hasAddresses, parseAddresses } from './address';
import { parseMapToContact } from './parse';
import { Contact, StringToStringArr } from './types';

// Canonical contact field -> the frontmatter property aliases that map to it (compared case-insensitively).
const KNOWN_FIELD_KEYS: { [canonical: string]: string[] } = {
	name: ['name'],
	legalName: ['legalname'],
	birthday: ['birthday'],
	phone: ['phone'],
	email: ['email'],
	insta: ['insta', 'instagram'],
	beli: ['beli'],
	beliName: ['beliname'],
	NSO: ['nso'],
	NSOfriendCode: ['nsofriendcode'],
	discord: ['discord']
};

// Normalize any frontmatter value (scalar / list / Date / number) into a trimmed string array.
function toStringArray(value: unknown): string[] {
	if (value === null || value === undefined) {
		return [];
	}
	if (Array.isArray(value)) {
		return value.flatMap(toStringArray);
	}
	if (value instanceof Date) {
		// YAML may parse a date property (e.g. `birthday: 2000-02-01`) into a Date at UTC midnight.
		// Render it back as Y/M/D so Date parsing in formatBirthday stays in the user's locale.
		const y = value.getUTCFullYear();
		const m = String(value.getUTCMonth() + 1).padStart(2, '0');
		const d = String(value.getUTCDate()).padStart(2, '0');
		return [`${y}/${m}/${d}`];
	}
	const str = String(value).trim();
	return str.length > 0 ? [str] : [];
}

// Convert a parsed frontmatter object into the StringToStringArr shape parseMapToContact expects.
function frontmatterToMap(fm: Record<string, unknown>): StringToStringArr {
	const lowerCased: Record<string, unknown> = {};
	for (const key of Object.keys(fm)) {
		lowerCased[key.toLowerCase()] = fm[key];
	}

	const map: StringToStringArr = {};
	for (const canonical of Object.keys(KNOWN_FIELD_KEYS)) {
		let values: string[] = [];
		for (const alias of KNOWN_FIELD_KEYS[canonical]) {
			if (lowerCased[alias] !== undefined) {
				values = values.concat(toStringArray(lowerCased[alias]));
			}
		}
		// Dedupe so e.g. both `insta` and `Instagram` properties don't render twice.
		values = Array.from(new Set(values));
		if (values.length > 0) {
			map[canonical] = values;
		}
	}
	return map;
}

// True if the frontmatter contains at least one recognized contact field (including an address).
export function hasContactFields(fm: Record<string, unknown> | null | undefined): boolean {
	if (!fm) {
		return false;
	}
	return Object.keys(frontmatterToMap(fm)).length > 0 || hasAddresses(fm);
}

export function frontmatterToContact(fm: Record<string, unknown>): Contact | null {
	const map = frontmatterToMap(fm);
	const addresses = parseAddresses(fm);
	if (Object.keys(map).length === 0 && addresses.length === 0) {
		return null;
	}
	const contact = parseMapToContact(map);
	if (!contact) {
		return null;
	}
	contact.addresses = addresses;
	return contact;
}
