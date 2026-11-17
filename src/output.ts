import Table from 'cli-table3';
import { markdownTable } from 'markdown-table';

/** How a command prints its result. `plain` is each command's own text. */
export type Format = 'plain' | 'json' | 'table' | 'markdown';

/** A header row plus body rows, for the table and Markdown formats. */
export type Rows = { header: string[]; rows: string[][] };

/** A box-drawn table: centred headers, left-aligned body, a rule between every row. */
export function renderTable({ header, rows }: Rows): string {
  // The header goes in as the first row: cli-table3's types only allow centred cells there, not in `head`.
  const table = new Table({ style: { head: [], border: [] } });
  table.push(
    header.map(content => ({ content, hAlign: 'center' as const })),
    ...rows,
  );
  return table.toString();
}

/** A Markdown table with padded columns. */
export function renderMarkdown({ header, rows }: Rows): string {
  return markdownTable([header, ...rows]);
}

export function renderJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
