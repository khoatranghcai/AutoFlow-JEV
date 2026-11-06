import { expect, test } from "vitest";
import { dictionaries, t } from "./index";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

test("en and vi have identical keys", () => {
  expect(Object.keys(dictionaries.vi).sort()).toEqual(Object.keys(dictionaries.en).sort());
});
test("placeholders match between locales", () => {
  for (const k of Object.keys(dictionaries.en))
    expect(placeholders(dictionaries.vi[k]!)).toBe(placeholders(dictionaries.en[k]!));
});
test("interpolates params", () => {
  expect(t("vi", "attempt", { n: 2 })).toBe("Lần thử 2/3");
});
