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

/** A Markdown table with padded columns. Pipes are escaped and line breaks flattened, so each cell stays in its column. */
export function renderMarkdown({ header, rows }: Rows): string {
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return markdownTable([header, ...rows].map(row => row.map(cell)));
}

export function renderJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/** A command's result in the chosen format: its own plain text, its JSON, or its rows as a table. */
export function render(format: Format, out: { plain: () => string; json: unknown; rows: () => Rows }): string {
  if (format === 'plain') return out.plain();
  if (format === 'json') return renderJson(out.json);
  if (format === 'table') return renderTable(out.rows());
  return renderMarkdown(out.rows());
}
