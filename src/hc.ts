import { $ } from 'bun';

/** The fields of `hc get --json` that hch uses. */
export type Terminal = {
  address: string;
  pid: number;
  cwd: string;
  labels: Record<string, string>;
};

/** An error hch reports as `hch: <message>` and exits with `exitCode`. */
export class HchError extends Error {
  constructor(
    message: string,
    public exitCode = 1,
  ) {
    super(message);
  }
}

export function requireTerminalId(env: Record<string, string | undefined> = process.env): string {
  const id = env.HC_TERMINAL_ID;
  if (!id) throw new HchError('not in an hc terminal');
  return id;
}

/** The message from hc's `{"error":{"message":...}}` stderr, or the stderr as is when it isn't that shape. */
export function hcErrorMessage(stderr: string): string {
  const text = stderr.trim();
  try {
    const message = JSON.parse(text)?.error?.message;
    if (typeof message === 'string' && message) return message;
  } catch {}
  return text;
}

/** Run `hc <args>` and parse its stdout as JSON. */
async function hcJson(args: string[]): Promise<unknown> {
  const text = await $`hc ${args}`.quiet().text();
  try {
    return JSON.parse(text);
  } catch {
    throw new HchError(`hc ${args.join(' ')} didn't return JSON: ${text.trim()}`);
  }
}

export async function getTerminal(id: string): Promise<Terminal> {
  return (await hcJson(['get', id, '--json'])) as Terminal;
}

/** Start a kept, parentless background terminal; returns `hc run`'s JSON. */
export async function runTerminal(args: string[]): Promise<unknown> {
  return await hcJson(['run', '--bg', '--no-parent', '--keep', '--json', ...args]);
}

export async function killTerminal(id: string): Promise<void> {
  await $`hc kill ${id}`.quiet();
}
