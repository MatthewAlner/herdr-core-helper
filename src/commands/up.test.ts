import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { labelArgs, parseRunAddress, shellCwd } from './up.ts';

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
