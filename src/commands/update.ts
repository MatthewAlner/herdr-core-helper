import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { getTerminal, HchError, killTerminal, requireTerminalId, runTerminal } from '../hc.ts';
import { focusTerminal, hasHerdrApp } from '../herdr-app.ts';
import { renderJson, type Format } from '../output.ts';
import { compareVersions, formatVersion, readVersions, type Freshness } from './version.ts';

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

/** The question to ask before replacing the shell, or null to stop without asking. */
export function updateQuestion(freshness: Freshness, installed: string, force: boolean): string | null {
  if (freshness === 'outdated') return `Update this tab to ${installed}? [y/N]`;
  return force ? "Replace this tab's shell anyway? [y/N]" : null;
}

/** `y` or `yes` in any case; anything else, including no answer (EOF), is no. */
export function isYes(answer: string | null): boolean {
  const a = answer?.trim().toLowerCase();
  return a === 'y' || a === 'yes';
}

/** Single-quotes a string for sh. */
export function shQuote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}

/**
 * The sh command the new terminal runs: print the version, then become the login shell hc would have started.
 * A new terminal gets herdr core's environment, whose PATH may lack bun and hc, so their folders go on PATH
 * for the version print only. `;` starts the shell even when the print fails.
 */
export function shellCommand({ bun, script, hcDir }: { bun: string; script: string; hcDir: string | null }): string {
  const path = [...(hcDir ? [hcDir] : []), dirname(bun)].join(':');
  return `PATH=${shQuote(path)}:"$PATH" ${shQuote(bun)} ${shQuote(script)} version; exec "$SHELL" -l`;
}

/**
 * Show the tab's version and, when it's out of date (or with --force), replace this terminal's shell with a
 * fresh one in the same tab and cwd, after asking unless --yes. The new shell prints its version first.
 * Focus comes before ending the old shell: hch runs inside it, so it ends with it.
 */
export async function update(format: Format, _args: string[] = [], flags = new Set<string>()): Promise<void> {
  const id = requireTerminalId();
  const { tab, installed } = await readVersions();
  const freshness = compareVersions(tab, installed);
  const question = updateQuestion(freshness, installed, flags.has('force'));
  if (!question) {
    const up_to_date = freshness === 'current';
    console.log(
      format === 'json' ? renderJson({ tab, installed, up_to_date, updated: false }) : formatVersion(tab, installed),
    );
    return;
  }
  if (!flags.has('yes')) {
    if (format === 'json' || !process.stdin.isTTY) throw new HchError("update needs --yes when it can't ask", 2);
    console.log(formatVersion(tab, installed));
    if (!isYes(prompt(question))) return;
  } else if (format !== 'json') {
    console.log(formatVersion(tab, installed));
  }

  const t = await getTerminal(id);
  const hc = Bun.which('hc');
  const command = shellCommand({ bun: process.execPath, script: Bun.main, hcDir: hc ? dirname(hc) : null });
  const next = parseRunAddress(
    await runTerminal(['--cwd', shellCwd(), ...labelArgs(t.labels), '--', '/bin/sh', '-c', command]),
  );
  // Only a terminal with a herdr.space label gets a pane in Herdr; the new one copies it.
  const error = 'herdr.space' in t.labels && hasHerdrApp() ? await focusTerminal(next) : null;
  if (error) console.error(`hch: couldn't focus ${next} in Herdr: ${error}`);
  console.log(format === 'json' ? renderJson({ from: id, to: next }) : `hch update: ${id} -> ${next}`);
  await killTerminal(id);
}
