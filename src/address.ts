import { Address, AddressPrecision } from './types';

// Address parsing lives in its own module because addresses are structured objects, unlike the
// flat string-array fields handled by frontmatter.ts / parse.ts. The hybrid frontmatter layout is:
//
//   address: 1700 Main St, Apt 4, Seattle WA 98101   # flat current address (Properties-UI editable)
//   building: The Pinnacle
//   addresses:                                        # list for archives + approximate places
//     - 456 Old Rd, Portland OR 97201                 # bare string = current precise address
//     - address: 789 Past Ave
//       until: 2023-08                                # archived (has an until date)
//     - area: Greenlake, Seattle
//     - near: Greenlake Park
//       radius: 3 blocks

// Coerce any YAML scalar (string / number / Date) into a trimmed string, or undefined when empty.
function toScalarString(value: unknown): string | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}
	if (value instanceof Date) {
		const y = value.getUTCFullYear();
		const m = String(value.getUTCMonth() + 1).padStart(2, '0');
		const d = String(value.getUTCDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const str = String(value).trim();
	return str.length > 0 ? str : undefined;
}

// Interpret a YAML boolean-ish value (true/false or "true"/"false"). Anything else → undefined.
function toBool(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const lowered = value.trim().toLowerCase();
		if (lowered === 'true') return true;
		if (lowered === 'false') return false;
	}
	return undefined;
}

// First defined value among the given case-insensitive aliases of a lowercased-key object.
function pick(obj: Record<string, unknown>, ...aliases: string[]): unknown {
	for (const alias of aliases) {
		if (obj[alias] !== undefined) {
			return obj[alias];
		}
	}
	return undefined;
}

// An entry is archived (not current) if it carries an explicit flag or a move-out date.
function deriveCurrent(archived: boolean | undefined, currentFlag: boolean | undefined, until: string | undefined): boolean {
	if (archived === true || currentFlag === false || until !== undefined) {
		return false;
	}
	return true;
}

// Normalize one list item — a bare string (shorthand for a current precise address) or an object.
export function normalizeAddressEntry(raw: unknown): Address | null {
	if (typeof raw === 'string') {
		const address = toScalarString(raw);
		return address ? { address, current: true } : null;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		return null;
	}

	// Lowercase keys so aliases match case-insensitively, matching frontmatter.ts conventions.
	const lower: Record<string, unknown> = {};
	for (const key of Object.keys(raw as Record<string, unknown>)) {
		lower[key.toLowerCase()] = (raw as Record<string, unknown>)[key];
	}

	const until = toScalarString(pick(lower, 'until'));
	const archived = toBool(pick(lower, 'archived'));
	const currentFlag = toBool(pick(lower, 'current'));

	const entry: Address = {
		address: toScalarString(pick(lower, 'address', 'location')),
		near: toScalarString(pick(lower, 'near')),
		area: toScalarString(pick(lower, 'area')),
		radius: toScalarString(pick(lower, 'radius')),
		building: toScalarString(pick(lower, 'building')),
		label: toScalarString(pick(lower, 'label', 'type')),
		street: toScalarString(pick(lower, 'street')),
		unit: toScalarString(pick(lower, 'unit')),
		city: toScalarString(pick(lower, 'city')),
		region: toScalarString(pick(lower, 'region', 'state')),
		postal: toScalarString(pick(lower, 'postal', 'zip', 'postcode')),
		country: toScalarString(pick(lower, 'country')),
		from: toScalarString(pick(lower, 'from')),
		until,
		archived,
		current: deriveCurrent(archived, currentFlag, until)
	};

	return hasLocation(entry) ? entry : null;
}

// True if an entry names a place in any form: a precise address, near, area, or even just a
// building name (which can render and link on its own). Entries with only dates/labels are dropped.
function hasLocation(a: Address): boolean {
	return !!(a.address || a.near || a.area || a.street || a.city || a.postal || a.building);
}

// Classify how precisely an entry locates the person — drives card wording now, the map later.
export function addressPrecision(a: Address): AddressPrecision {
	if (a.address || a.street || a.city || a.postal) {
		return 'precise';
	}
	if (a.near) {
		return 'approximate';
	}
	return 'area';
}

// Read every address out of a note's frontmatter: flat top-level keys + the `addresses` list.
export function parseAddresses(fm: Record<string, unknown>): Address[] {
	const lower: Record<string, unknown> = {};
	for (const key of Object.keys(fm)) {
		lower[key.toLowerCase()] = fm[key];
	}

	const entries: Address[] = [];

	// 1. Flat top-level scalars → current entries. `building` attaches to a flat `address`; a flat
	//    `radius` attaches to `near` (preferred) or `area`. Lists/objects under `address`/`location`
	//    fall through to step 2 instead.
	const flatBuilding = toScalarString(pick(lower, 'building'));
	const flatRadius = toScalarString(pick(lower, 'radius'));
	const flatNear = toScalarString(pick(lower, 'near'));
	const flatArea = toScalarString(pick(lower, 'area'));

	const rawAddress = pick(lower, 'address', 'location');
	if (typeof rawAddress === 'string') {
		const address = toScalarString(rawAddress);
		if (address) {
			entries.push({ address, building: flatBuilding, current: true });
		}
	}
	if (flatNear) {
		entries.push({ near: flatNear, radius: flatRadius, current: true });
	}
	if (flatArea) {
		entries.push({ area: flatArea, radius: flatNear ? undefined : flatRadius, current: true });
	}
	// A flat `building` with no address/near/area of its own still yields a (current) entry, so it
	// can render and link on its own.
	if (flatBuilding && typeof rawAddress !== 'string' && !flatNear && !flatArea) {
		entries.push({ building: flatBuilding, current: true });
	}

	// 2. The `addresses` list (plus `address`/`location` when given as a list or object) → entries.
	const listSources: unknown[] = [pick(lower, 'addresses')];
	if (rawAddress !== undefined && typeof rawAddress !== 'string') {
		listSources.push(rawAddress);
	}
	for (const source of listSources) {
		for (const item of toEntryArray(source)) {
			const entry = normalizeAddressEntry(item);
			if (entry) {
				entries.push(entry);
			}
		}
	}

	return entries;
}

// Flatten a list source into individual items (a single string/object becomes a one-item list).
function toEntryArray(value: unknown): unknown[] {
	if (value === null || value === undefined) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

// True if the frontmatter names at least one address (used to decide whether a note is a contact).
export function hasAddresses(fm: Record<string, unknown>): boolean {
	return parseAddresses(fm).length > 0;
}
