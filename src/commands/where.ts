import { getTerminal, requireTerminalId, type Terminal } from '../hc.ts';

export function formatWhere(t: Terminal): string {
  const [space, tab] = (t.labels.where ?? '').split(' / ');
  return [
    `space: ${space || '?'}  ${t.labels['herdr.space'] ?? ''}`,
    `tab:   ${tab || '?'}  ${t.labels['herdr.tab'] ?? ''}`,
    `pane:  ${t.address}`,
  ].join('\n');
}

export async function where(): Promise<void> {
  console.log(formatWhere(await getTerminal(requireTerminalId())));
}
