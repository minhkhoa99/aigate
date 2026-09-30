// docs/contracts/usage.md "Days, periods, retention": pure time and period rules, so they are tested without a clock.

export const PERIODS = ["today", "24h", "7d", "30d", "90d", "custom"] as const;
export type Period = (typeof PERIODS)[number];
export const MAX_CUSTOM_DAYS = 400;
const HOUR_MS = 3_600_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export class InvalidPeriod extends Error {}

// A range the queries read: hourly buckets from events, or whole days from the rollup.
export type UsageRange =
  | { readonly period: Period; readonly bucket: "hour"; readonly fromMs: number; readonly toMs: number }
  | { readonly period: Period; readonly bucket: "day"; readonly fromDay: string; readonly toDay: string };

const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, timeZone: string): Record<string, number> {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatters.set(timeZone, format);
  }
  return Object.fromEntries(format.formatToParts(ms).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

// Throws RangeError for a zone Intl does not know (checked once at startup).
export function assertTimeZone(timeZone: string): void {
  new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
}

const pad = (value: number) => String(value).padStart(2, "0");
export function dayKey(ms: number, timeZone: string): string {
  const p = parts(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// The zone's offset from UTC at an instant, in ms.
function offsetAt(ms: number, timeZone: string): number {
  const p = parts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

// The instant a calendar day starts in the zone (the offset is taken again at the candidate, for DST days).
export function startOfDay(day: string, timeZone: string): number {
  const match = DAY.exec(day);
  if (!match) throw new InvalidPeriod(`${day} is not a YYYY-MM-DD date`);
  const midnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const first = midnight - offsetAt(midnight, timeZone);
  return midnight - offsetAt(first, timeZone);
}

export function addDays(day: string, days: number): string {
  const match = DAY.exec(day);
  if (!match) throw new InvalidPeriod(`${day} is not a YYYY-MM-DD date`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)).toISOString().slice(0, 10);
}

const validDay = (day: string): boolean => DAY.test(day) && addDays(day, 0) === day;
const daysBetween = (from: string, to: string): number => (Date.UTC(...split(to)) - Date.UTC(...split(from))) / 86_400_000;
function split(day: string): [number, number, number] {
  const [year, month, date] = day.split("-").map(Number);
  return [year, month - 1, date];
}

export function parsePeriod(query: { period?: unknown; from?: unknown; to?: unknown }, now: number, timeZone: string): UsageRange {
  const wanted = query.period ?? "7d";
  const period = PERIODS.find((known) => known === wanted);
  if (!period) throw new InvalidPeriod(`period must be one of ${PERIODS.join(", ")}.`);
  const today = dayKey(now, timeZone);
  switch (period) {
    case "today": return { period, bucket: "hour", fromMs: startOfDay(today, timeZone), toMs: now };
    case "24h": return { period, bucket: "hour", fromMs: now - 24 * HOUR_MS, toMs: now };
    case "7d": case "30d": case "90d": return { period, bucket: "day", fromDay: addDays(today, 1 - Number.parseInt(period, 10)), toDay: today };
    case "custom": {
      const { from, to } = query;
      if (typeof from !== "string" || typeof to !== "string" || !validDay(from) || !validDay(to)) throw new InvalidPeriod("A custom period needs from and to as YYYY-MM-DD dates.");
      const span = daysBetween(from, to) + 1;
      if (span < 1) throw new InvalidPeriod("from must be on or before to.");
      if (span > MAX_CUSTOM_DAYS) throw new InvalidPeriod(`A custom period covers at most ${MAX_CUSTOM_DAYS} days.`);
      return { period, bucket: "day", fromDay: from, toDay: to };
    }
  }
}

// routing.usage-recording-timing (9router): without upstream usage, about four characters per token.
export const estimateTokens = (chars: number): number => Math.ceil(Math.max(0, chars) / 4);

export function csvField(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  // A leading =, +, -, @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll("\"", "\"\"")}"` : safe;
}
