import { expect, test } from 'bun:test';
import { HchError } from '../hc.ts';
import { compareVersions, formatVersion, parseVersion, versionRows } from './version.ts';

test('parseVersion takes the second field of the first line', () => {
  expect(parseVersion('hc 0.1.21\n')).toBe('0.1.21');
});

test('parseVersion throws on output with no version', () => {
  expect(() => parseVersion('')).toThrow();
});

test('compareVersions says whether the tab is current, outdated or newer', () => {
  expect(compareVersions('0.1.21', '0.1.21')).toBe('current');
  expect(compareVersions('0.1.20', '0.1.21')).toBe('outdated');
  expect(compareVersions('0.1.22', '0.1.21')).toBe('newer');
});

test('compareVersions compares numerically and ranks a pre-release below its release', () => {
  expect(compareVersions('0.1.9', '0.1.10')).toBe('outdated');
  expect(compareVersions('0.1.21-dev', '0.1.21')).toBe('outdated');
});

test("compareVersions turns a version it can't read into an HchError", () => {
  expect(() => compareVersions('junk', '0.1.21')).toThrow(HchError);
  expect(() => compareVersions('junk', '0.1.21')).toThrow("couldn't compare versions 'junk' and '0.1.21'");
});

test('formatVersion leads with the verdict', () => {
  expect(formatVersion('0.1.21', '0.1.21')).toBe('herdr core 0.1.21, up to date');
  expect(formatVersion('0.1.20', '0.1.21')).toBe('herdr core 0.1.20, 0.1.21 installed: run hch update');
  expect(formatVersion('0.1.22', '0.1.21')).toBe('herdr core 0.1.22, 0.1.21 installed (older)');
});

test('versionRows gives a header and a row each for tab and installed', () => {
  expect(versionRows({ tab: '0.1.20', installed: '0.1.21', up_to_date: false })).toEqual({
    header: ['', 'Version'],
    rows: [
      ['Tab', '0.1.20'],
      ['Installed', '0.1.21'],
    ],
  });
});
