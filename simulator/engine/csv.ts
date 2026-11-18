import { csvCell } from "./csv-cell";

export interface CsvColumn {
  label: string;
  /** One value per month. Null, and anything that is not a finite number,
   *  becomes an empty cell. */
  values: (number | null)[];
}

function numberCell(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}

/**
 * The monthly series as CSV: one row per month, one column per series, with
 * the month in the first column.
 *
 * Labels can come from user input (a token symbol, a row name), so every
 * header cell goes through csvCell, which quotes it and defuses a leading
 * formula character. Numbers are written the way JavaScript prints them, with
 * a point as the decimal mark and no grouping, so the file does not depend on
 * the page's locale. Lines end in CRLF, as RFC 4180 asks.
 *
 * `monthLabel` heads the first column. The engine holds no wording, so a
 * caller with translated labels passes its own.
 */
export function seriesToCsv(
  months: number[],
  columns: CsvColumn[],
  monthLabel = "month",
): string {
  const header = [monthLabel, ...columns.map((column) => column.label)]
    .map(csvCell)
    .join(",");
  const rows = months.map((month, index) =>
    [month, ...columns.map((column) => column.values[index])]
      .map(numberCell)
      .join(","),
  );
  return [header, ...rows].map((line) => `${line}\r\n`).join("");
}
