import { $ } from 'bun';

/** One try at a Herdr command: `ok`, or the error `herdr-app` printed. */
export type AppResult = { ok: true } | { ok: false; error: string };

/** The `error` from `herdr-app do`'s `{"error": "..."}` output, or the output as is. */
export function appError(output: string): string {
  const text = output.trim();
  try {
    const error = JSON.parse(text)?.error;
    if (typeof error === 'string' && error) return error;
  } catch {}
  return text;
}

async function focusPane(terminal: string): Promise<AppResult> {
  const r = await $`herdr-app do pane.focus --terminal ${terminal}`.quiet().nothrow();
  if (r.exitCode === 0) return { ok: true };
  return { ok: false, error: appError(`${r.stdout}${r.stderr}`) || `herdr-app exited ${r.exitCode}` };
}

export type FocusOptions = {
  attempts?: number;
  delayMs?: number;
  run?: (terminal: string) => Promise<AppResult>;
};

/**
 * Focus the pane showing `terminal` in the Herdr window, selecting its tab.
 * Herdr adds a new terminal's pane a moment after hc starts it, so "no such pane" is retried.
 * Returns null once focused, or the error that stopped it.
 */
export async function focusTerminal(
  terminal: string,
  { attempts = 30, delayMs = 100, run = focusPane }: FocusOptions = {},
): Promise<string | null> {
  let error = 'no such pane';
  for (let i = 0; i < attempts; i++) {
    if (i) await Bun.sleep(delayMs);
    const r = await run(terminal);
    if (r.ok) return null;
    error = r.error;
    if (error !== 'no such pane') break;
  }
  return error;
}

/** Whether the Herdr app's CLI is installed here. */
export function hasHerdrApp(): boolean {
  return Bun.which('herdr-app') !== null;
}
