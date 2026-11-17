import { expect, test } from 'bun:test';
import { HchError } from '../hc.ts';
import { completionScript, shells, zshCompletion, type CommandInfo } from './completion.ts';

const where: CommandInfo = { name: 'where', description: 'show where', formats: ['plain', 'json'] };

test('zshCompletion starts with #compdef and ends by registering with compdef', () => {
  const script = zshCompletion([where]);
  expect(script).toStartWith('#compdef hch\n');
  expect(script.trimEnd()).toEndWith('compdef _hch hch');
});

test('zshCompletion lists each command with its description', () => {
  expect(zshCompletion([where])).toContain("'where:show where'");
});

test('zshCompletion escapes single quotes', () => {
  const script = zshCompletion([{ name: 'up', description: "this tab's shell", formats: ['plain'] }]);
  expect(script).toContain("'up:this tab'\\''s shell'");
});

test('zshCompletion escapes colons in command descriptions', () => {
  const script = zshCompletion([{ name: 'x', description: 'a:b', formats: ['plain'] }]);
  expect(script).toContain("'x:a\\:b'");
});

test('zshCompletion offers only a command’s own format flags, mutually exclusive', () => {
  const script = zshCompletion([{ name: 'up', description: 'u', formats: ['plain', 'json'] }]);
  expect(script).toContain(
    "up)\n          _arguments \\\n            '(- *)'{-h,--help}'[show help]' \\\n            '(--json)--json[print JSON]'",
  );
  expect(script).not.toContain('--table');
});

test('zshCompletion makes every format flag exclude the others', () => {
  const script = zshCompletion([{ name: 'where', description: 'w', formats: ['plain', 'json', 'table', 'markdown'] }]);
  expect(script).toContain("'(--json --table --markdown)--json[print JSON]'");
  expect(script).toContain("'(--json --table --markdown)--table[print a table]'");
  expect(script).toContain("'(--json --table --markdown)--markdown[print a Markdown table]'");
});

test('zshCompletion completes positional values', () => {
  const script = zshCompletion([{ name: 'completion', description: 'c', formats: ['plain'], args: ['zsh'] }]);
  expect(script).toContain("'1: :(zsh)'");
});

test('zshCompletion offers -h and --help after a command', () => {
  const script = zshCompletion([{ name: 'version', description: 'v', formats: ['plain'] }]);
  expect(script).toContain("version)\n          _arguments \\\n            '(- *)'{-h,--help}'[show help]'\n");
});

test('every listed shell has a completion script', () => {
  expect(shells).toEqual(['zsh']);
  for (const shell of shells) expect(completionScript(shell, [where])).toStartWith('#compdef hch');
});

test('completionScript returns the zsh script for zsh', () => {
  expect(completionScript('zsh', [where])).toBe(zshCompletion([where]));
});

function thrown(fn: () => unknown): HchError {
  try {
    fn();
  } catch (err) {
    if (err instanceof HchError) return err;
    throw err;
  }
  throw new Error('expected an HchError');
}

test('completionScript with no shell throws exit 2', () => {
  const err = thrown(() => completionScript(undefined, [where]));
  expect(err.exitCode).toBe(2);
  expect(err.message).toBe('completion needs a shell: zsh');
});

test('completionScript with an unknown shell throws exit 2', () => {
  const err = thrown(() => completionScript('bash', [where]));
  expect(err.exitCode).toBe(2);
  expect(err.message).toBe("unknown shell 'bash' (supported: zsh)");
});
