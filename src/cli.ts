#!/usr/bin/env bun
import { $ } from 'bun';
import { parseArgs } from 'node:util';
import { hcErrorMessage, HchError } from './hc.ts';
import type { Format } from './output.ts';
import { up } from './commands/up.ts';
import { version } from './commands/version.ts';
import { where } from './commands/where.ts';

const USAGE = `hch - herdr core helper

Usage: hch <command> [--json | --table | --markdown]

Commands
  where     show the space, tab and pane this terminal is in
  version   show the herdr core build this tab runs, and the installed one
  up        replace this tab's shell with a fresh one on the installed herdr core
  help      show this help

Options
  --json      print JSON (where, version, up)
  --table     print a table (where, version)
  --markdown  print a Markdown table (where, version)`;

type Command = { run: (format: Format) => Promise<void>; formats: Format[] };

const commands: Record<string, Command> = {
  where: { run: where, formats: ['plain', 'json', 'table', 'markdown'] },
  version: { run: version, formats: ['plain', 'json', 'table', 'markdown'] },
  up: { run: up, formats: ['plain', 'json'] },
};

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
  const [name] = positionals;
  if (!name || name === 'help' || values.help) {
    if (format !== 'plain') return usageError(`help doesn't support --${format}`);
    console.log(USAGE);
    return 0;
  }
  const command = commands[name];
  if (!command) return usageError(`unknown command '${name}'`);
  if (!command.formats.includes(format)) return usageError(`${name} doesn't support --${format}`);
  await command.run(format);
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
