import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isYes, labelArgs, parseRunAddress, shellCommand, shellCwd, shQuote, updateQuestion } from './update.ts';

test('shellCwd keeps $PWD as typed when it is the same folder as cwd', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'hch-cwd-')));
  try {
    mkdirSync(join(root, 'real'));
    mkdirSync(join(root, 'other'));
    symlinkSync(join(root, 'real'), join(root, 'link'));
    const cwd = join(root, 'real');
    expect(shellCwd(join(root, 'link'), cwd)).toBe(join(root, 'link'));
    expect(shellCwd(join(root, 'other'), cwd)).toBe(cwd); // stale $PWD
    expect(shellCwd(join(root, 'missing'), cwd)).toBe(cwd);
    expect(shellCwd(undefined, cwd)).toBe(cwd);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('labelArgs copies every label except herdr.seen', () => {
  expect(labelArgs({ 'herdr.seen': '1', where: 'a / 1', 'herdr.tab': 'tb' })).toEqual([
    '--label=where=a / 1',
    '--label=herdr.tab=tb',
  ]);
});

test('labelArgs with no labels gives no args', () => {
  expect(labelArgs({})).toEqual([]);
});

test("parseRunAddress returns the new terminal's address", () => {
  expect(parseRunAddress({ address: 't20' })).toBe('t20');
});

test('parseRunAddress throws when there is no address', () => {
  for (const json of [{}, { address: null }, { address: '' }, null]) {
    expect(() => parseRunAddress(json)).toThrow("couldn't start the new terminal");
  }
});

test('updateQuestion asks to update an outdated tab, with or without --force', () => {
  expect(updateQuestion('outdated', '0.1.21', false)).toBe('Update this tab to 0.1.21? [y/N]');
  expect(updateQuestion('outdated', '0.1.21', true)).toBe('Update this tab to 0.1.21? [y/N]');
});

test('updateQuestion stops for a current or newer tab unless --force', () => {
  expect(updateQuestion('current', '0.1.21', false)).toBeNull();
  expect(updateQuestion('newer', '0.1.21', false)).toBeNull();
  expect(updateQuestion('current', '0.1.21', true)).toBe("Replace this tab's shell anyway? [y/N]");
  expect(updateQuestion('newer', '0.1.21', true)).toBe("Replace this tab's shell anyway? [y/N]");
});

test('isYes takes y or yes in any case, and nothing else', () => {
  for (const a of ['y', 'Y', ' yes ', 'YES']) expect(isYes(a)).toBe(true);
  for (const a of ['', 'n', 'yep', null]) expect(isYes(a)).toBe(false);
});

test('shQuote single-quotes for sh, escaping single quotes', () => {
  expect(shQuote("it's")).toBe(`'it'\\''s'`);
});

test('shellCommand prints the version with hc and bun on PATH, then starts the login shell', () => {
  expect(shellCommand({ bun: '/b/bin/bun', script: '/s/src/cli.ts', hcDir: '/h/bin' })).toBe(
    `PATH='/h/bin:/b/bin':"$PATH" '/b/bin/bun' '/s/src/cli.ts' version; exec "\${SHELL:-/bin/sh}" -l`,
  );
});

test('shellCommand leaves out the hc folder when hc was not found', () => {
  expect(shellCommand({ bun: '/b/bin/bun', script: '/s/cli.ts', hcDir: null })).toStartWith(`PATH='/b/bin':"$PATH" `);
});

test('shellCommand runs under sh with spaces and quotes in its paths', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'hch-sh-')));
  try {
    const dir = join(root, 'a b', "it's");
    mkdirSync(dir, { recursive: true });
    const bun = join(dir, 'bun');
    writeFileSync(bun, '#!/bin/sh\necho "$@"\n');
    chmodSync(bun, 0o755);
    const script = join(dir, 'cli.ts');
    const p = Bun.spawnSync(['/bin/sh', '-c', shellCommand({ bun, script, hcDir: null })], {
      env: { SHELL: '/usr/bin/true', PATH: '/usr/bin:/bin' },
    });
    expect(p.stdout.toString()).toBe(`${script} version\n`);
    expect(p.exitCode).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shellCommand still starts a shell when $SHELL is empty', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'hch-sh-')));
  try {
    const bun = join(root, 'bun');
    writeFileSync(bun, '#!/bin/sh\n');
    chmodSync(bun, 0o755);
    const p = Bun.spawnSync(['/bin/sh', '-c', shellCommand({ bun, script: '/x/cli.ts', hcDir: null })], {
      env: { SHELL: '', PATH: '/usr/bin:/bin' },
      stdin: 'ignore',
    });
    expect(p.exitCode).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
