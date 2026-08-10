import { Employment } from './types';

// Employment is intentionally a frontmatter object list, so Bases can inspect entries directly
// (for example, `employmentHistory.filter(value.employer == this.file)`) without duplicate indexes.
function scalar(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (value instanceof Date) {
		const y = value.getUTCFullYear();
		const m = String(value.getUTCMonth() + 1).padStart(2, '0');
		const d = String(value.getUTCDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const text = String(value).trim();
	return text || undefined;
}

function valueAt(map: Record<string, string[]>, key: string): string | undefined {
	return map[key]?.[0];
}

export function currentEmploymentFromMap(map: Record<string, string[]>): Employment | null {
	return normalizeEmploymentEntry({
		employer: valueAt(map, 'employer'),
		title: valueAt(map, 'title'),
		department: valueAt(map, 'department'),
		manager: valueAt(map, 'manager'),
		started: valueAt(map, 'employmentstart') ?? valueAt(map, 'employmentstarted')
	});
}

export function currentEmploymentFromFrontmatter(frontmatter: Record<string, unknown>): Employment | null {
	const lower: Record<string, unknown> = {};
	for (const key of Object.keys(frontmatter)) {
		lower[key.toLowerCase()] = frontmatter[key];
	}
	return normalizeEmploymentEntry({
		employer: lower.employer,
		title: lower.title,
		department: lower.department,
		manager: lower.manager,
		started: lower.employmentstart ?? lower.employmentstarted
	});
}

// Normalize one history item. An employer is required: partial rows without one cannot be queried
// meaningfully and would render as an orphaned job description.
export function normalizeEmploymentEntry(raw: unknown): Employment | null {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const lower: Record<string, unknown> = {};
	for (const key of Object.keys(raw as Record<string, unknown>)) {
		lower[key.toLowerCase()] = (raw as Record<string, unknown>)[key];
	}
	const employer = scalar(lower.employer);
	if (!employer) return null;
	return {
		employer,
		title: scalar(lower.title),
		department: scalar(lower.department),
		manager: scalar(lower.manager),
		started: scalar(lower.employmentstarted)
			?? scalar(lower.employmentstart)
			?? scalar(lower.started)
			?? scalar(lower.start),
		ended: scalar(lower.employmentended)
			?? scalar(lower.employmentend)
			?? scalar(lower.ended)
			?? scalar(lower.end)
	};
}

export function parseEmploymentHistory(frontmatter: Record<string, unknown>): Employment[] {
	const source = Object.keys(frontmatter).find(key => key.toLowerCase() === 'employmenthistory');
	if (!source) return [];
	const raw = frontmatter[source];
	const entries = Array.isArray(raw) ? raw : [raw];
	return entries.map(normalizeEmploymentEntry).filter((entry): entry is Employment => entry !== null);
}

export function hasEmploymentHistory(frontmatter: Record<string, unknown>): boolean {
	return parseEmploymentHistory(frontmatter).length > 0;
}

interface EmploymentDate {
	date: Date;
	hasDay: boolean;
}

function parseEmploymentDate(value: string | undefined): EmploymentDate | null {
	if (!value) return null;
	const numericMatch = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
	const namedMatch = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
	if (!numericMatch && !namedMatch) return null;

	const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
		'july', 'august', 'september', 'october', 'november', 'december'];
	const namedMonth = namedMatch
		? monthNames.findIndex(month => month === namedMatch[1].toLowerCase()
			|| month.slice(0, 3) === namedMatch[1].toLowerCase()) + 1
		: 0;
	if (namedMatch && namedMonth === 0) return null;

	const year = Number(numericMatch?.[1] ?? namedMatch?.[2]);
	const month = numericMatch ? Number(numericMatch[2]) : namedMonth;
	const day = numericMatch?.[3] ? Number(numericMatch[3]) : 1;
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return { date, hasDay: !!numericMatch?.[3] };
}

export function formatEmploymentDate(value: string | undefined): string | null {
	const parsed = parseEmploymentDate(value);
	if (!parsed) return null;
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		year: 'numeric',
		...(parsed.hasDay ? { day: 'numeric' } : {}),
		timeZone: 'UTC'
	}).format(parsed.date);
}

export function employmentDuration(started: string | undefined, ended?: string, now = new Date()): string | null {
	const start = parseEmploymentDate(started);
	const finish = ended ? parseEmploymentDate(ended) : { date: now, hasDay: true };
	if (!start || !finish || finish.date < start.date) return null;
	let months = (finish.date.getUTCFullYear() - start.date.getUTCFullYear()) * 12
		+ finish.date.getUTCMonth() - start.date.getUTCMonth();
	if (finish.date.getUTCDate() < start.date.getUTCDate()) months--;
	const years = Math.floor(months / 12);
	const remainingMonths = months % 12;
	const parts: string[] = [];
	if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
	if (remainingMonths || !years) parts.push(`${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`);
	return parts.join(', ');
}
