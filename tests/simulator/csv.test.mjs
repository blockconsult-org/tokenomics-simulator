// CSV export of the monthly series.
import test from "node:test";
import assert from "node:assert/strict";
import { seriesToCsv } from "@/simulator/engine/csv";

test("seriesToCsv writes a header and one CRLF-terminated line per month", () => {
  const csv = seriesToCsv(
    [0, 1, 2],
    [
      { label: "Price", values: [1, 1.25, 0.000001234] },
      { label: "Staking yield", values: [null, 0.1, -0.05] },
    ],
  );

  assert.equal(csv, '"month","Price","Staking yield"\r\n0,1,\r\n1,1.25,0.1\r\n2,0.000001234,-0.05\r\n');
});

test("header cells are quoted, escaped and guarded against spreadsheet formulas", () => {
  const csv = seriesToCsv([0], [{ label: 'Supply, "liquid"', values: [5] }, { label: "=HYPERLINK(1)", values: [6] }], "Monat");

  assert.equal(csv.split("\r\n")[0], '"Monat","Supply, ""liquid""","\'=HYPERLINK(1)"');
});

test("numeric cells are written raw, and a missing or non-finite value is an empty cell", () => {
  const csv = seriesToCsv(
    [0, 1],
    [
      { label: "a", values: [1234567.891, Number.NaN] },
      { label: "b", values: [1e21] },
    ],
  );

  // No grouping, a point as the decimal mark; the second column has no value for month 1.
  assert.deepEqual(csv.split("\r\n").slice(1, 3), ["0,1234567.891,1e+21", "1,,"]);
});
