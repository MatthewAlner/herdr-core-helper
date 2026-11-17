import { afterAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A fake `hc` that prints $FAKE_HC_STDOUT and $FAKE_HC_STDERR and exits $FAKE_HC_EXIT.
const fakeBin = mkdtempSync(join(tmpdir(), 'hch-test-'));
writeFileSync(
  join(fakeBin, 'hc'),
  `#!/bin/sh\nprintf '%s' "$FAKE_HC_STDOUT"\nprintf '%s' "$FAKE_HC_STDERR" >&2\nexit "\${FAKE_HC_EXIT:-0}"\n`,
);
chmodSync(join(fakeBin, 'hc'), 0o755);
afterAll(() => rmSync(fakeBin, { recursive: true, force: true }));

type Hc = { stdout?: string; stderr?: string; exit?: number };

function hch(args: string[], { terminal, hc = {} }: { terminal?: string; hc?: Hc } = {}) {
  const env: Record<string, string> = {
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_HC_STDOUT: hc.stdout ?? '',
    FAKE_HC_STDERR: hc.stderr ?? '',
    FAKE_HC_EXIT: String(hc.exit ?? 0),
  };
  if (terminal) env.HC_TERMINAL_ID = terminal;
  const p = Bun.spawnSync([process.execPath, join(import.meta.dir, 'cli.ts'), ...args], { env });
  return { exit: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
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
  const r = hch(['up', '--table']);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: up doesn't support --table");
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
const newTerminal = JSON.stringify({ address: 't20', pid: 1, cwd: '/', labels: {} });

test('up --json prints the old and new terminal ids', () => {
  const r = hch(['up', '--json'], { terminal: 't9', hc: { stdout: newTerminal } });
  expect(r.exit).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({ from: 't9', to: 't20' });
});

test('up --json prints nothing on stdout when hc fails', () => {
  const r = hch(['up', '--json'], { terminal: 't9', hc: { stderr: '{"error":{"message":"boom"}}', exit: 3 } });
  expect(r.exit).toBe(3);
  expect(r.stdout).toBe('');
  expect(r.stderr).toBe('hch: boom\n');
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
