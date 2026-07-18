/** Minimal RFC-4180 CSV serializer (no dependencies). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return lines.join('\r\n');
}

/** Serialize an array of records, deriving column order from the given keys. */
export function recordsToCsv(keys: string[], records: Array<Record<string, unknown>>): string {
  return toCsv(
    keys,
    records.map((r) => keys.map((k) => r[k])),
  );
}
