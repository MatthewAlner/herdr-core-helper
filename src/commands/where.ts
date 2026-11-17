import { getTerminal, requireTerminalId, type Terminal } from '../hc.ts';
import { render, type Format, type Rows } from '../output.ts';

type Named = { name: string | null; id: string | null };
export type WhereData = { space: Named; tab: Named; pane: string };

export function formatWhere(t: Terminal): string {
  const [space, tab] = (t.labels.where ?? '').split(' / ');
  return [
    `space: ${space || '?'}  ${t.labels['herdr.space'] ?? ''}`,
    `tab:   ${tab || '?'}  ${t.labels['herdr.tab'] ?? ''}`,
    `pane:  ${t.address}`,
  ].join('\n');
}

export function whereData(t: Terminal): WhereData {
  const [space, tab] = (t.labels.where ?? '').split(' / ');
  return {
    space: { name: space || null, id: t.labels['herdr.space'] ?? null },
    tab: { name: tab || null, id: t.labels['herdr.tab'] ?? null },
    pane: t.address,
  };
}

export function whereRows(d: WhereData): Rows {
  return {
    header: ['', 'Name', 'ID'],
    rows: [
      ['Space', d.space.name ?? '', d.space.id ?? ''],
      ['Tab', d.tab.name ?? '', d.tab.id ?? ''],
      ['Pane', '', d.pane],
    ],
  };
}

export async function where(format: Format): Promise<void> {
  const t = await getTerminal(requireTerminalId());
  const data = whereData(t);
  console.log(render(format, { plain: () => formatWhere(t), json: data, rows: () => whereRows(data) }));
}
