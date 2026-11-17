import { $ } from "bun";

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
  if (!id) throw new HchError("not in an hc terminal");
  return id;
}

export async function getTerminal(id: string): Promise<Terminal> {
  return await $`hc get ${id} --json`.quiet().json();
}
