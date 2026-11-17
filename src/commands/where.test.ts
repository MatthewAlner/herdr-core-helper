import { expect, test } from 'bun:test';
import { requireTerminalId } from '../hc.ts';
import { formatWhere, whereData, whereRows } from './where.ts';

const t = {
  address: 't14',
  pid: 1,
  cwd: '/',
  labels: { where: 'ai-sandbox / 1', 'herdr.space': 'spacb1', 'herdr.tab': 'tb3e' },
};

test('formats space, tab and pane', () => {
  expect(formatWhere(t)).toBe('space: ai-sandbox  spacb1\ntab:   1  tb3e\npane:  t14');
});

test('missing labels fall back to ? and empty ids', () => {
  expect(formatWhere({ ...t, labels: {} })).toBe('space: ?  \ntab:   ?  \npane:  t14');
});

test('requireTerminalId throws HchError when unset', () => {
  expect(() => requireTerminalId({})).toThrow('not in an hc terminal');
  expect(requireTerminalId({ HC_TERMINAL_ID: 't14' })).toBe('t14');
});

test('whereData splits names and ids', () => {
  expect(whereData(t)).toEqual({
    space: { name: 'ai-sandbox', id: 'spacb1' },
    tab: { name: '1', id: 'tb3e' },
    pane: 't14',
  });
});

test('whereData gives null for missing labels', () => {
  expect(whereData({ ...t, labels: {} })).toEqual({
    space: { name: null, id: null },
    tab: { name: null, id: null },
    pane: 't14',
  });
});

test('whereRows gives a header and a row each for space, tab and pane', () => {
  expect(whereRows(whereData(t))).toEqual({
    header: ['', 'Name', 'ID'],
    rows: [
      ['Space', 'ai-sandbox', 'spacb1'],
      ['Tab', '1', 'tb3e'],
      ['Pane', '', 't14'],
    ],
  });
});

test('whereRows leaves missing values empty', () => {
  expect(whereRows(whereData({ ...t, labels: {} })).rows).toEqual([
    ['Space', '', ''],
    ['Tab', '', ''],
    ['Pane', '', 't14'],
  ]);
});
