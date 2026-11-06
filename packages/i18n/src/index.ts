import en from "./en.json";
import vi from "./vi.json";

export type Locale = "en" | "vi";
export type Key = keyof typeof en;
export const dictionaries: Record<Locale, Record<string, string>> = { en, vi };

export function t(locale: Locale, key: Key, params: Record<string, string | number> = {}): string {
  const raw = dictionaries[locale][key] ?? en[key];
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}
