import { expect, test } from 'bun:test';
import { appError, focusTerminal, type AppResult } from './herdr-app.ts';

function runner(results: AppResult[]) {
  const calls: string[] = [];
  const run = async (terminal: string) => {
    calls.push(terminal);
    return results.shift() ?? { ok: true };
  };
  return { calls, run };
}

test('appError reads the error from herdr-app JSON, or keeps the text', () => {
  expect(appError('{\n  "error": "no such pane"\n}\n')).toBe('no such pane');
  expect(appError('herdr-app: --terminal needs a value\n')).toBe('herdr-app: --terminal needs a value');
  expect(appError('')).toBe('');
});

test('focusTerminal retries while the pane does not exist yet', async () => {
  const { calls, run } = runner([
    { ok: false, error: 'no such pane' },
    { ok: false, error: 'no such pane' },
    { ok: true },
  ]);
  expect(await focusTerminal('t20', { delayMs: 0, run })).toBeNull();
  expect(calls).toEqual(['t20', 't20', 't20']);
});

test('focusTerminal stops at any other error', async () => {
  const { calls, run } = runner([{ ok: false, error: 'cannot open the Herdr window' }]);
  expect(await focusTerminal('t20', { delayMs: 0, run })).toBe('cannot open the Herdr window');
  expect(calls).toHaveLength(1);
});

test('focusTerminal gives up after its attempts', async () => {
  const { calls, run } = runner(Array(5).fill({ ok: false, error: 'no such pane' }));
  expect(await focusTerminal('t20', { attempts: 3, delayMs: 0, run })).toBe('no such pane');
  expect(calls).toHaveLength(3);
});
