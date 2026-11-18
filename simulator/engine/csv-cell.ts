// A CSV is opened as a spreadsheet more often than as text. Prefix formula-leading cells so a
// client-authored name such as `=HYPERLINK(...)` stays data rather than becoming executable input.
export const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
