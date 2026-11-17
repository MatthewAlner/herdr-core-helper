import { $ } from 'bun';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getTerminal, HchError, requireTerminalId } from '../hc.ts';
import { render, type Format, type Rows } from '../output.ts';

export type VersionData = { tab: string; installed: string };

/** `hc 0.1.21` → `0.1.21` */
export function parseVersion(output: string): string {
  const version = output.split('\n')[0]?.trim().split(' ')[1];
  if (!version) throw new HchError(`couldn't read a version from '${output.trim()}'`);
  return version;
}

export function formatVersion(tab: string, installed: string): string {
  return `tab: ${tab}  installed: ${installed}`;
}

/** The executable of the herdr core process holding this terminal (the shell's parent). */
async function holderExecutable(shellPid: number): Promise<string> {
  const holder = (await $`ps -o ppid= -p ${shellPid}`.text()).trim();
  for await (const line of $`lsof -a -p ${holder} -d txt -Fn`.quiet().lines()) {
    if (line.startsWith('n')) return line.slice(1);
  }
  throw new HchError(`couldn't find the executable of process ${holder}`);
}

export async function version(format: Format): Promise<void> {
  const t = await getTerminal(requireTerminalId());
  const exe = await holderExecutable(t.pid);
  const tab = parseVersion(await $`${exe} --version`.text());
  const installed = parseVersion(await $`${join(homedir(), '.local/bin/herdr-core')} --version`.text());
  const data = { tab, installed };
  console.log(
    render(format, { plain: () => formatVersion(tab, installed), json: data, rows: () => versionRows(data) }),
  );
}

export function versionRows(d: VersionData): Rows {
  return {
    header: ['', 'Version'],
    rows: [
      ['Tab', d.tab],
      ['Installed', d.installed],
    ],
  };
}
