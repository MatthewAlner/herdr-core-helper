#!/usr/bin/env bun
import { $ } from 'bun';
import { parseArgs } from 'node:util';
import { hcErrorMessage, HchError } from './hc.ts';
import type { Format } from './output.ts';
import { completionScript, shells, type CommandInfo } from './commands/completion.ts';
import { update } from './commands/update.ts';
import { version } from './commands/version.ts';
import { where } from './commands/where.ts';

type Command = Omit<CommandInfo, 'name'> & { run: (format: Format, args: string[]) => Promise<void> | void };

const commands: Record<string, Command> = {
  where: {
    description: 'show the space, tab and pane this terminal is in',
    formats: ['plain', 'json', 'table', 'markdown'],
    run: where,
  },
  version: {
    description: 'show the herdr core build this tab runs, and the installed one',
    formats: ['plain', 'json', 'table', 'markdown'],
    run: version,
  },
  update: {
    description: "replace this tab's shell with a fresh one on the installed herdr core",
    formats: ['plain', 'json'],
    run: update,
  },
  completion: {
    description: 'print a shell completion script (zsh)',
    formats: ['plain'],
    args: shells,
    run: (_format, [shell]) => console.log(completionScript(shell, commandInfo())),
  },
  help: { description: 'show this help', formats: ['plain'], run: () => console.log(USAGE) },
};

function commandInfo(): CommandInfo[] {
  return Object.entries(commands).map(([name, { run, ...info }]) => ({ name, ...info }));
}

const nameWidth = Math.max(...Object.keys(commands).map(name => name.length)) + 2;

const USAGE = `hch - herdr core helper

Usage: hch <command> [--json | --table | --markdown]

Commands
${commandInfo()
  .map(({ name, description }) => `  ${name.padEnd(nameWidth)}${description}`)
  .join('\n')}

Options
  --json      print JSON (where, version, update)
  --table     print a table (where, version)
  --markdown  print a Markdown table (where, version)`;

const formatFlags = ['json', 'table', 'markdown'] as const;

function usageError(message: string): number {
  console.error(`hch: ${message}\n\n${USAGE}`);
  return 2;
}

async function main(argv: string[]): Promise<number> {
  const options = {
    help: { type: 'boolean', short: 'h' },
    json: { type: 'boolean' },
    table: { type: 'boolean' },
    markdown: { type: 'boolean' },
  } as const;
  const { positionals, values, tokens } = parseArgs({
    args: argv,
    options,
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  const unknown = tokens.find(t => t.kind === 'option' && !(t.name in options));
  if (unknown?.kind === 'option') return usageError(`unknown option '${unknown.rawName}'`);
  const chosen = formatFlags.filter(flag => values[flag]);
  if (chosen.length > 1) return usageError('choose one of --json, --table, --markdown');
  const format: Format = chosen[0] ?? 'plain';
  const [first, ...args] = positionals;
  const name = values.help || !first ? 'help' : first;
  const command = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (!command) return usageError(`unknown command '${name}'`);
  if (!command.formats.includes(format)) return usageError(`${name} doesn't support --${format}`);
  const allowed = command.args ? 1 : 0;
  if (name !== 'help' && args.length > allowed) return usageError(`unexpected argument '${args[allowed]}'`);
  await command.run(format, args);
  return 0;
}

try {
  process.exitCode = await main(Bun.argv.slice(2));
} catch (err) {
  if (err instanceof HchError) {
    console.error(`hch: ${err.message}`);
    process.exitCode = err.exitCode;
  } else if (err instanceof $.ShellError) {
    console.error(`hch: ${hcErrorMessage(err.stderr.toString()) || err.message}`);
    process.exitCode = err.exitCode;
  } else {
    throw err;
  }
}
