import { parseYaml } from 'obsidian';
import { addressPrecision, hasAddresses, parseAddresses } from './address';
import { parseEmploymentHistory } from './employment';
import { extractAddressBlock, parseMapToContact, parseStringsToMap } from './parse';
import { Address, AddressPrecision, Contact } from './types';

// Public, cross-plugin API exposed on the plugin instance as `plugin.api`.
export interface BocAddressApi {
	version: number;
	parseAddresses(fm: Record<string, unknown>): Address[];
	hasAddresses(fm: Record<string, unknown>): boolean;
	addressPrecision(a: Address): AddressPrecision;
	parseContactBlock(source: string): Contact | null;
}

// Keep code-block parsing and the public API on one implementation path.
export function parseContactBlock(source: string): Contact | null {
	const { flatRows, addressesYaml, employmentHistoryYaml } = extractAddressBlock(source);
	const contact = parseMapToContact(parseStringsToMap(flatRows));

	if (contact && addressesYaml) {
		try {
			const parsed = parseYaml(addressesYaml);
			if (parsed && typeof parsed === 'object') {
				contact.addresses = contact.addresses.concat(parseAddresses(parsed as Record<string, unknown>));
			}
		} catch {
			// Malformed YAML in the addresses block — keep the flat parse result.
		}
	}

	if (contact && employmentHistoryYaml) {
		try {
			const parsed = parseYaml(employmentHistoryYaml);
			if (parsed && typeof parsed === 'object') {
				contact.employmentHistory = parseEmploymentHistory(parsed as Record<string, unknown>);
			}
		} catch {
			// Malformed YAML in the employmentHistory block — keep the flat parse result.
		}
	}

	return contact;
}

export function createBocAddressApi(): BocAddressApi {
	return {
		version: 1,
		parseAddresses,
		hasAddresses,
		addressPrecision,
		parseContactBlock
	};
}
