import en from "./locales/en.json" with { type: "json" };
import vi from "./locales/vi.json" with { type: "json" };

export type Language = "en" | "vi";
export type MessageKey = keyof typeof en;
export type Params = Readonly<Record<string, string | number>>;
export type Message = { key: MessageKey; params?: Params };
export const LANGUAGE_KEY = "aigate-language";
export const normalizeLanguage = (value: unknown): Language => value === "vi" ? "vi" : "en";
export function readLanguage(read: () => string | null): Language {
  try { return normalizeLanguage(read()); } catch { return "en"; }
}
export function persistLanguage(language: Language, write: (value: Language) => void): boolean {
  try { write(language); return true; } catch { return false; }
}
export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (marker, name: string) => Object.hasOwn(params, name) ? String(params[name]) : marker);
}
export function lookupMessage(language: Language, key: string, catalogs: Readonly<Record<Language, Readonly<Record<string, string>>>>): string {
  if (Object.hasOwn(catalogs[language], key)) return catalogs[language][key];
  return Object.hasOwn(catalogs.en, key) ? catalogs.en[key] : key;
}
export function translate(language: Language, key: MessageKey, params?: Params): string {
  return interpolate(lookupMessage(language, key, { en, vi }), params);
}

export function createFormatters(language: Language, timeZone?: string) {
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "always" });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const smallMoney = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const time = new Intl.DateTimeFormat(locale, { timeZone, timeStyle: "medium" });
  const date = new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "short", timeStyle: "medium" });
  return { number: number.format, compact: compact.format, decimal: decimal.format, percent: percent.format,
    signedPercent: signed.format, usd: (value: number) => (value > 0 && value < .01 ? smallMoney : money).format(value),
    time: (at: number) => time.format(at), dateTime: (at: number) => date.format(at) };
}
