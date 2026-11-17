import { realpathSync } from 'node:fs';
import { getTerminal, HchError, killTerminal, requireTerminalId, runTerminal } from '../hc.ts';

/** One `--label=k=v` per label, minus `herdr.seen` so the new terminal starts unseen. */
export function labelArgs(labels: Record<string, string>): string[] {
  return Object.entries(labels)
    .filter(([key]) => key !== 'herdr.seen')
    .map(([key, value]) => `--label=${key}=${value}`);
}

export function parseRunAddress(json: unknown): string {
  const address = (json as { address?: unknown } | null)?.address;
  if (typeof address !== 'string' || !address) throw new HchError("couldn't start the new terminal");
  return address;
}

/** The folder as the shell spelled it ($PWD, which keeps symlinks), unless $PWD is stale or unset. */
export function shellCwd(pwd = process.env.PWD, cwd = process.cwd()): string {
  try {
    if (pwd && realpathSync(pwd) === realpathSync(cwd)) return pwd;
  } catch {}
  return cwd;
}

/** Replace this terminal's shell with a fresh one in the same tab and cwd, then end this one. */
export async function up(): Promise<void> {
  const id = requireTerminalId();
  const t = await getTerminal(id);
  const next = parseRunAddress(await runTerminal(['--cwd', shellCwd(), ...labelArgs(t.labels)]));
  console.log(`hch up: ${id} -> ${next}`);
  await killTerminal(id);
}
