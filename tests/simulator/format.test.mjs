// Number formatting and form-input parsing in the two site locales.
import test from "node:test";
import assert from "node:assert/strict";
import { modelFields } from "@/simulator/engine/fields";
import {
  EMPTY,
  formatCompact,
  formatFieldValue,
  formatNumber,
  formatPercent,
  formatPrice,
  formatUsd,
  fromDisplay,
  orEmpty,
  parseFieldInput,
  toDisplay,
} from "@/simulator/engine/format";

const tokens = modelFields["token.genesisSupply"];
const percent = modelFields["emissions.sellRate"];

// Which apostrophe groups Swiss thousands, and which kind of space sits beside a currency sign or a
// compact suffix, changes between ICU releases. The tests are about digits, marks and units.
const plain = (text) => text.replace(/[  ]/g, " ").replace(/’/g, "'");

test("formatters use each locale's grouping and a point as the decimal mark", () => {
  assert.equal(formatNumber(1234567.891, "en"), "1,234,567.89");
  assert.equal(plain(formatNumber(1234567.891, "de")), "1'234'567.89");

  assert.equal(formatCompact(1_250_000, "en"), "1.25M");
  assert.equal(plain(formatCompact(1_250_000, "de")), "1.25 Mio.");
  assert.equal(formatCompact(999.456, "en"), "999.46", "values under 1,000 are not abbreviated");

  assert.equal(formatPrice(0.01234567, "en"), "$0.01235", "a sub-cent price keeps about four significant digits");
  assert.equal(plain(formatPrice(1234.5, "de")), "$ 1'234.50");

  assert.equal(formatUsd(1_250_000, "en"), "$1.25M");
  assert.equal(plain(formatUsd(42.5, "de")), "$ 42.50");

  assert.equal(formatPercent(0.125, "en"), "12.5%");
  assert.equal(plain(formatPercent(0.125, "de")), "12.5%");

  assert.equal(orEmpty(null, String), EMPTY);
  assert.equal(orEmpty(Number.NaN, String), EMPTY);
});

test("parseFieldInput reads suffixes, grouping and either decimal mark", () => {
  assert.equal(parseFieldInput(tokens, "1.5m", "en"), 1_500_000);
  assert.equal(parseFieldInput(tokens, "2k", "de"), 2_000);
  assert.equal(parseFieldInput(tokens, "1,000", "en"), 1_000, "a lone comma groups thousands in English");
  assert.equal(parseFieldInput(tokens, "12,5", "de"), 12.5, "and is the decimal mark in German");
  assert.equal(parseFieldInput(tokens, "1'000", "de"), 1_000);
  assert.equal(parseFieldInput(tokens, "1’000", "de"), 1_000);
  assert.equal(parseFieldInput(tokens, "1,234.56", "en"), 1234.56);
  assert.equal(parseFieldInput(tokens, "1.234,56", "de"), 1234.56, "with both marks, the later one is the decimal mark");
});

test("parseFieldInput stores a percent field as a fraction", () => {
  assert.equal(parseFieldInput(percent, "12.5%", "en"), 0.125);
  assert.equal(parseFieldInput(percent, "25%", "de"), 0.25);
  assert.equal(parseFieldInput(percent, "25", "en"), 0.25, "the % sign is optional");
});

test("parseFieldInput returns null for text that is not a number", () => {
  for (const text of ["", "   ", "abc", "-", ".", "k", "1.2.3", "12abc"]) {
    assert.equal(parseFieldInput(tokens, text, "en"), null, JSON.stringify(text));
  }
});

test("a percent field shows what was stored and parses back to it", () => {
  // 0.07 × 100 is 7.000000000000001; neither the display nor the round trip may show that.
  assert.equal(fromDisplay(percent, toDisplay(percent, 0.07)), 0.07);
  for (const locale of ["en", "de"]) {
    assert.equal(formatFieldValue(percent, 0.07, locale), "7");
    for (const stored of [0.07, 0.125, 0.0005, 1]) {
      const typed = formatFieldValue(percent, stored, locale);
      assert.ok(Math.abs(parseFieldInput(percent, typed, locale) - stored) < 1e-12, `${stored} via "${typed}" (${locale})`);
    }
  }
  // A grouped whole number makes the same trip in the locale that wrote it.
  assert.equal(parseFieldInput(tokens, formatFieldValue(tokens, 1e9, "de"), "de"), 1e9);
  assert.equal(parseFieldInput(tokens, formatFieldValue(tokens, 1e9, "en"), "en"), 1e9);
});
