#!/usr/bin/env bun
import { $ } from "bun";
import { parseArgs } from "node:util";
import { HchError } from "./hc.ts";
import { version } from "./commands/version.ts";
import { where } from "./commands/where.ts";

const USAGE = `hch - herdr core helper

Usage: hch <command>

Commands
  where     show the space, tab and pane this terminal is in
  version   show the herdr core build this tab runs, and the installed one
  help      show this help`;

const commands: Record<string, () => Promise<void>> = { where, version };

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    options: { help: { type: "boolean", short: "h" } },
    allowPositionals: true,
    strict: false,
  });
  const [name] = positionals;
  if (!name || name === "help" || values.help) {
    console.log(USAGE);
    return 0;
  }
  const command = commands[name];
  if (!command) {
    console.error(`hch: unknown command '${name}'\n\n${USAGE}`);
    return 2;
  }
  await command();
  return 0;
}

try {
  process.exitCode = await main(Bun.argv.slice(2));
} catch (err) {
  if (err instanceof HchError) {
    console.error(`hch: ${err.message}`);
    process.exitCode = err.exitCode;
  } else if (err instanceof $.ShellError) {
    console.error(`hch: ${err.stderr.toString().trim() || err.message}`);
    process.exitCode = err.exitCode;
  } else {
    throw err;
  }
}
