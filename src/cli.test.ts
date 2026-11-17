import { afterAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fakeBin = mkdtempSync(join(tmpdir(), 'hch-test-'));
const hcLog = join(fakeBin, 'hc.log');
function fake(dir: string, name: string, body: string) {
  writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`);
  chmodSync(join(dir, name), 0o755);
}
// A fake `hc`: `--version` reports $FAKE_INSTALLED; anything else is logged to $FAKE_HC_LOG, prints
// $FAKE_HC_STDOUT and $FAKE_HC_STDERR, and exits $FAKE_HC_EXIT.
fake(
  fakeBin,
  'hc',
  `if [ "$1" = --version ]; then echo "hc $FAKE_INSTALLED"; exit 0; fi
echo "$*" >> "$FAKE_HC_LOG"
printf '%s' "$FAKE_HC_STDOUT"
printf '%s' "$FAKE_HC_STDERR" >&2
exit "\${FAKE_HC_EXIT:-0}"`,
);
// `hch version` finds the tab's build from the shell's parent process: `ps` names it, `lsof` gives its
// executable, and that executable, a fake holder, reports $FAKE_TAB.
fake(fakeBin, 'ps', 'echo 1');
fake(fakeBin, 'lsof', `echo "n${join(fakeBin, 'holder')}"`);
fake(fakeBin, 'holder', 'echo "herdr-core $FAKE_TAB"');

// A fake `herdr-app`, in its own folder so a test can leave it off PATH, that logs its
// arguments to $FAKE_APP_LOG, prints $FAKE_APP_STDOUT and exits $FAKE_APP_EXIT.
const fakeAppBin = mkdtempSync(join(tmpdir(), 'hch-test-app-'));
writeFileSync(
  join(fakeAppBin, 'herdr-app'),
  `#!/bin/sh\necho "$*" >> "$FAKE_APP_LOG"\nprintf '%s' "$FAKE_APP_STDOUT"\nexit "\${FAKE_APP_EXIT:-0}"\n`,
);
chmodSync(join(fakeAppBin, 'herdr-app'), 0o755);
const appLog = join(fakeAppBin, 'log');
afterAll(() => {
  rmSync(fakeBin, { recursive: true, force: true });
  rmSync(fakeAppBin, { recursive: true, force: true });
});

type Hc = { stdout?: string; stderr?: string; exit?: number };
type App = { stdout?: string; exit?: number };
type Versions = { tab?: string; installed?: string };

/** Runs hch with only the fakes and the system folders on PATH, so the real hc and herdr-app are never reached. */
function hch(
  args: string[],
  { terminal, hc = {}, app, versions = {} }: { terminal?: string; hc?: Hc; app?: App; versions?: Versions } = {},
) {
  rmSync(appLog, { force: true });
  rmSync(hcLog, { force: true });
  const env: Record<string, string> = {
    PATH: [fakeBin, ...(app ? [fakeAppBin] : []), '/usr/bin', '/bin'].join(':'),
    FAKE_HC_STDOUT: hc.stdout ?? '',
    FAKE_HC_STDERR: hc.stderr ?? '',
    FAKE_HC_EXIT: String(hc.exit ?? 0),
    FAKE_APP_STDOUT: app?.stdout ?? '',
    FAKE_APP_EXIT: String(app?.exit ?? 0),
    FAKE_APP_LOG: appLog,
    FAKE_HC_LOG: hcLog,
    FAKE_TAB: versions.tab ?? '0.1.21',
    FAKE_INSTALLED: versions.installed ?? '0.1.21',
  };
  if (terminal) env.HC_TERMINAL_ID = terminal;
  const p = Bun.spawnSync([process.execPath, join(import.meta.dir, 'cli.ts'), ...args], { env });
  return { exit: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
}

/** The `hc` calls the last run made, one line of arguments each. */
async function hcCalls(): Promise<string[]> {
  const log = Bun.file(hcLog);
  return (await log.exists()) ? (await log.text()).trimEnd().split('\n') : [];
}

test('no command prints usage and exits 0', () => {
  const r = hch([]);
  expect(r.exit).toBe(0);
  expect(r.stdout).toContain('Usage: hch <command>');
});

test('an unknown command exits 2 with usage on stderr', () => {
  const r = hch(['nope']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: unknown command 'nope'");
  expect(r.stderr).toContain('Usage: hch <command>');
});

test('an unknown option exits 2 instead of being ignored', () => {
  const r = hch(['--version']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: unknown option '--version'");
  expect(r.stdout).toBe('');
});

test('outside an hc terminal exits 1', () => {
  const r = hch(['where']);
  expect(r.exit).toBe(1);
  expect(r.stderr).toBe('hch: not in an hc terminal\n');
});

test("an hc failure reports hc's error message and passes its exit code through", () => {
  const stderr = JSON.stringify({ error: { kind: 'not_found', message: 'no terminal "t9"' } });
  const r = hch(['where'], { terminal: 't9', hc: { stderr, exit: 3 } });
  expect(r.exit).toBe(3);
  expect(r.stderr).toBe('hch: no terminal "t9"\n');
});

test("an hc failure that isn't JSON is reported as is", () => {
  const r = hch(['where'], { terminal: 't9', hc: { stderr: 'boom', exit: 4 } });
  expect(r.exit).toBe(4);
  expect(r.stderr).toBe('hch: boom\n');
});

test("hc output that isn't JSON is a clean error, not a stack trace", () => {
  const r = hch(['where'], { terminal: 't9', hc: { stdout: 'not json' } });
  expect(r.exit).toBe(1);
  expect(r.stderr).toBe("hch: hc get t9 --json didn't return JSON: not json\n");
});

test('where formats the terminal hc returns', () => {
  const stdout = JSON.stringify({ address: 't9', pid: 1, cwd: '/', labels: { where: 's / 2' } });
  const r = hch(['where'], { terminal: 't9', hc: { stdout } });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe('space: s  \ntab:   2  \npane:  t9\n');
});

const terminal = JSON.stringify({ address: 't9', pid: 1, cwd: '/', labels: { where: 's / 2' } });

test('two format flags exit 2', () => {
  const r = hch(['where', '--json', '--table']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith('hch: choose one of --json, --table, --markdown');
  expect(r.stdout).toBe('');
});

test("a format the command doesn't support exits 2", () => {
  const r = hch(['update', '--table']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: update doesn't support --table");
  expect(r.stdout).toBe('');
});

test('a format flag on help or no command exits 2', () => {
  for (const args of [['help', '--json'], ['--json'], ['-h', '--markdown']]) {
    const r = hch(args);
    expect(r.exit).toBe(2);
    expect(r.stderr).toStartWith('hch: help doesn');
    expect(r.stdout).toBe('');
  }
});

test('a format flag before the command works', () => {
  const r = hch(['--json', 'where'], { terminal: 't9', hc: { stdout: terminal } });
  expect(r.exit).toBe(0);
});

test('where --json prints the terminal as JSON', () => {
  const r = hch(['where', '--json'], { terminal: 't9', hc: { stdout: terminal } });
  expect(r.exit).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({
    space: { name: 's', id: null },
    tab: { name: '2', id: null },
    pane: 't9',
  });
});

test('where --markdown prints a Markdown table', () => {
  const r = hch(['where', '--markdown'], { terminal: 't9', hc: { stdout: terminal } });
  expect(r.exit).toBe(0);
  expect(r.stdout).toStartWith('|       | Name |');
});

test('where --table prints a box table', () => {
  const r = hch(['where', '--table'], { terminal: 't9', hc: { stdout: terminal } });
  expect(r.exit).toBe(0);
  expect(r.stdout).toStartWith('┌');
});

// Satisfies both `hc get` and `hc run`, which the fake answers with the same stdout.
const newTerminal = JSON.stringify({ address: 't20', pid: 1, cwd: '/', labels: { 'herdr.space': 'sp1' } });

test('update --json prints the old and new terminal ids', () => {
  const r = hch(['update', '--json', '--force', '-y'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({ from: 't9', to: 't20' });
});

test('update --json prints nothing on stdout when hc fails', () => {
  const hc = { stderr: '{"error":{"message":"boom"}}', exit: 3 };
  const r = hch(['update', '--json', '--force', '-y'], { terminal: 't9', hc });
  expect(r.exit).toBe(3);
  expect(r.stdout).toBe('');
  expect(r.stderr).toBe('hch: boom\n');
});

test('update focuses the new terminal in Herdr', async () => {
  const r = hch(['update', '--force', '-y'], { terminal: 't9', hc: { stdout: newTerminal }, app: {} });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe('herdr core 0.1.21, up to date\nhch update: t9 -> t20\n');
  expect(r.stderr).toBe('');
  expect(await Bun.file(appLog).text()).toBe('do pane.focus --terminal t20\n');
});

test("update still replaces the shell when Herdr can't focus, and says why", async () => {
  const app = { stdout: '{"error": "cannot open the Herdr window"}', exit: 1 };
  const r = hch(['update', '--force', '-y'], { terminal: 't9', hc: { stdout: newTerminal }, app });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe('herdr core 0.1.21, up to date\nhch update: t9 -> t20\n');
  expect(r.stderr).toBe("hch: couldn't focus t20 in Herdr: cannot open the Herdr window\n");
});

test("update without herdr-app doesn't try to focus", async () => {
  const r = hch(['update', '--force', '-y'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(0);
  expect(r.stderr).toBe('');
  expect(await Bun.file(appLog).exists()).toBe(false);
});

test("update doesn't focus a terminal Herdr doesn't show", async () => {
  const r = hch(['update', '--force', '-y'], { terminal: 't9', hc: { stdout: terminal }, app: {} });
  expect(r.exit).toBe(0);
  expect(r.stderr).toBe('');
  expect(await Bun.file(appLog).exists()).toBe(false);
});

const outdated = { tab: '0.1.20', installed: '0.1.21' };

test('update on an up-to-date tab says so and stops', async () => {
  const r = hch(['update'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe('herdr core 0.1.21, up to date\n');
  expect((await hcCalls()).filter(c => c.startsWith('run'))).toEqual([]);
});

test('update --json on an up-to-date tab prints the versions without needing --yes', () => {
  const r = hch(['update', '--json'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({ tab: '0.1.21', installed: '0.1.21', up_to_date: true, updated: false });
});

test('update on a tab newer than the installed build says so and stops', () => {
  const r = hch(['update'], { terminal: 't9', hc: { stdout: newTerminal }, versions: { tab: '0.1.22' } });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe('herdr core 0.1.22, 0.1.21 installed (older)\n');
});

test("update on an outdated tab needs --yes when it can't ask", async () => {
  const r = hch(['update'], { terminal: 't9', hc: { stdout: newTerminal }, versions: outdated });
  expect(r.exit).toBe(2);
  expect(r.stderr).toBe("hch: update needs --yes when it can't ask\n");
  expect(r.stdout).toBe('');
  expect((await hcCalls()).filter(c => c.startsWith('run'))).toEqual([]);
});

test("update --force on a current tab needs --yes when it can't ask", () => {
  const r = hch(['update', '--force', '--json'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(2);
  expect(r.stderr).toBe("hch: update needs --yes when it can't ask\n");
});

test('update -y on an outdated tab replaces the shell through the version-printing wrapper', async () => {
  const r = hch(['update', '-y'], { terminal: 't9', hc: { stdout: newTerminal }, versions: outdated });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe('herdr core 0.1.20, 0.1.21 installed: run hch update\nhch update: t9 -> t20\n');
  const run = (await hcCalls()).find(c => c.startsWith('run'));
  expect(run).toContain('-- /bin/sh -c');
  expect(run).toContain('version; exec "${SHELL:-/bin/sh}" -l');
  expect(await hcCalls()).toContain('kill t9');
});

test('update --force -y --json on a current tab prints the old and new ids', () => {
  const r = hch(['update', '--force', '-y', '--json'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({ from: 't9', to: 't20' });
});

test('completion zsh prints a script that registers _hch', () => {
  const r = hch(['completion', 'zsh']);
  expect(r.exit).toBe(0);
  expect(r.stdout).toStartWith('#compdef hch');
  expect(r.stdout).toContain("'where:show the space, tab and pane this terminal is in'");
  expect(r.stdout).toContain('compdef _hch hch');
  expect(r.stderr).toBe('');
});

test('completion with no shell exits 2', () => {
  const r = hch(['completion']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith('hch: completion needs a shell: zsh');
});

test('completion with an unknown shell exits 2', () => {
  const r = hch(['completion', 'bash']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: unknown shell 'bash' (supported: zsh)");
});

test('completion rejects format flags', () => {
  const r = hch(['completion', 'zsh', '--json']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: completion doesn't support --json");
  expect(r.stdout).toBe('');
});

test('usage lists the completion command', () => {
  expect(hch(['help']).stdout).toContain('  completion  print a shell completion script (zsh)');
});

test.skipIf(!Bun.which('zsh'))('completion zsh output is a script zsh accepts', () => {
  const script = hch(['completion', 'zsh']).stdout;
  const p = Bun.spawnSync(['zsh', '-n'], { stdin: new TextEncoder().encode(script) });
  expect(p.stderr.toString()).toBe('');
  expect(p.exitCode).toBe(0);
});

test('a command rejects unexpected arguments', () => {
  for (const args of [
    ['completion', 'zsh', 'extra'],
    ['where', 'extra'],
  ]) {
    const r = hch(args);
    expect(r.exit).toBe(2);
    expect(r.stderr).toStartWith("hch: unexpected argument 'extra'");
    expect(r.stdout).toBe('');
  }
});

test("another command's flags are unknown options", () => {
  for (const flag of ['--force', '-y', '--yes']) {
    const r = hch(['where', flag]);
    expect(r.exit).toBe(2);
    expect(r.stderr).toStartWith(`hch: unknown option '${flag}'`);
    expect(r.stdout).toBe('');
  }
});

test("completion offers update's flags", () => {
  const out = hch(['completion', 'zsh']).stdout;
  expect(out).toContain('--force[');
  expect(out).toContain("'(-y --yes)'{-y,--yes}");
});

test("usage lists update's flags", () => {
  const out = hch(['help']).stdout;
  expect(out).toContain('--force');
  expect(out).toContain('-y, --yes');
});

test('help ignores extra arguments', () => {
  const r = hch(['help', 'where']);
  expect(r.exit).toBe(0);
  expect(r.stdout).toContain('Usage: hch <command>');
});
