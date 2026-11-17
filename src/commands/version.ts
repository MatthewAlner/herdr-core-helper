import { $ } from 'bun';
import { getTerminal, HchError, hcVersion, requireTerminalId } from '../hc.ts';
import { render, type Format, type Rows } from '../output.ts';

export type VersionData = { tab: string; installed: string; up_to_date: boolean };

/** How the tab's build compares with the installed one. */
export type Freshness = 'current' | 'outdated' | 'newer';

/** `hc 0.1.21` → `0.1.21` */
export function parseVersion(output: string): string {
  const version = output.split('\n')[0]?.trim().split(' ')[1];
  if (!version) throw new HchError(`couldn't read a version from '${output.trim()}'`);
  return version;
}

export function compareVersions(tab: string, installed: string): Freshness {
  let order: number;
  try {
    order = Bun.semver.order(tab, installed);
  } catch {
    throw new HchError(`couldn't compare versions '${tab}' and '${installed}'`);
  }
  return order === 0 ? 'current' : order < 0 ? 'outdated' : 'newer';
}

/** One line that leads with whether the tab is up to date. */
export function formatVersion(tab: string, installed: string): string {
  const freshness = compareVersions(tab, installed);
  if (freshness === 'current') return `herdr core ${tab}, up to date`;
  if (freshness === 'outdated') return `herdr core ${tab}, ${installed} installed: run hch update`;
  return `herdr core ${tab}, ${installed} installed (older)`;
}

/** The executable of the herdr core process holding this terminal (the shell's parent). */
async function holderExecutable(shellPid: number): Promise<string> {
  const holder = (await $`ps -o ppid= -p ${shellPid}`.text()).trim();
  for await (const line of $`lsof -a -p ${holder} -d txt -Fn`.quiet().lines()) {
    if (line.startsWith('n')) return line.slice(1);
  }
  throw new HchError(`couldn't find the executable of process ${holder}`);
}

/** The build this terminal's herdr core holder runs, and the installed one. */
export async function readVersions(): Promise<{ tab: string; installed: string }> {
  const t = await getTerminal(requireTerminalId());
  const exe = await holderExecutable(t.pid);
  const tab = parseVersion(await $`${exe} --version`.text());
  const installed = parseVersion(await hcVersion());
  return { tab, installed };
}

export async function version(format: Format): Promise<void> {
  const { tab, installed } = await readVersions();
  const data: VersionData = { tab, installed, up_to_date: compareVersions(tab, installed) === 'current' };
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
