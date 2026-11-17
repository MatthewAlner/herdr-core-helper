import { expect, test } from 'bun:test';
import { formatVersion, parseVersion, versionRows } from './version.ts';

test('parseVersion takes the second field of the first line', () => {
  expect(parseVersion('hc 0.1.21\n')).toBe('0.1.21');
});

test('parseVersion throws on output with no version', () => {
  expect(() => parseVersion('')).toThrow();
});

test('formatVersion shows tab and installed builds', () => {
  expect(formatVersion('0.1.20', '0.1.21')).toBe('tab: 0.1.20  installed: 0.1.21');
});

test('versionRows gives a header and a row each for tab and installed', () => {
  expect(versionRows({ tab: '0.1.20', installed: '0.1.21' })).toEqual({
    header: ['', 'Version'],
    rows: [
      ['Tab', '0.1.20'],
      ['Installed', '0.1.21'],
    ],
  });
});
