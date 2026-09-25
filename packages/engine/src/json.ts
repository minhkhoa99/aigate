// Narrowing helpers for JSON from outside the process (client bodies, upstream answers), so parsers
// never need a type assertion.
export type Json = Record<string, unknown>;

export const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
export const record = (value: unknown): Json => (isRecord(value) ? value : {});
export const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
export const list = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
