import Papa from 'papaparse';

export type DataRow = Record<string, string>;

export interface ParseResult {
  rows: DataRow[];
  columns: string[];
  error?: string;
}

export function parseCSV(text: string): ParseResult {
  const result = Papa.parse<DataRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  if (result.errors.length && !result.data.length) {
    return { rows: [], columns: [], error: result.errors[0].message };
  }

  const columns = result.meta.fields ?? [];
  return { rows: result.data, columns };
}

export function parseJSON(text: string): ParseResult {
  try {
    const parsed = JSON.parse(text);
    const arr: DataRow[] = Array.isArray(parsed) ? parsed : [parsed];
    const columns = arr.length ? Object.keys(arr[0]) : [];
    const rows = arr.map((item) =>
      Object.fromEntries(columns.map((col) => [col, String(item[col] ?? '')]))
    );
    return { rows, columns };
  } catch (e: any) {
    return { rows: [], columns: [], error: e.message };
  }
}

export function parseDataFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json')) {
        resolve(parseJSON(text));
      } else {
        resolve(parseCSV(text));
      }
    };
    reader.onerror = () => resolve({ rows: [], columns: [], error: 'Failed to read file' });
    reader.readAsText(file);
  });
}
