import { HchError } from '../hc.ts';
import type { Format } from '../output.ts';

/** What completion needs to know about a command. `args` lists the values its first positional argument takes. */
export type CommandInfo = { name: string; description: string; formats: Format[]; args?: string[] };

const flagDescriptions: Record<Exclude<Format, 'plain'>, string> = {
  json: 'print JSON',
  table: 'print a table',
  markdown: 'print a Markdown table',
};

/** Single-quotes a string for zsh. */
function quote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}

const helpSpec = `'(- *)'{-h,--help}'[show help]'`;

/** The `_arguments` specs for one command: help, its format flags, and its positional values. */
function argumentSpecs({ formats, args }: CommandInfo): string[] {
  const flags = formats.filter(f => f !== 'plain');
  const exclusions = `(${flags.map(f => `--${f}`).join(' ')})`;
  const specs = [helpSpec, ...flags.map(f => quote(`${exclusions}--${f}[${flagDescriptions[f]}]`))];
  if (args?.length) specs.push(quote(`1: :(${args.join(' ')})`));
  return specs;
}

/** A zsh completion script for `hch`, to be loaded with `source <(hch completion zsh)`. */
export function zshCompletion(commands: CommandInfo[]): string {
  const entries = commands.map(c => `        ${quote(`${c.name}:${c.description.replaceAll(':', '\\:')}`)}`);
  const branches = commands.flatMap(c => {
    const specs = argumentSpecs(c);
    return [
      `        ${c.name})`,
      `          _arguments \\`,
      `            ${specs.join(' \\\n            ')}`,
      `          ;;`,
    ];
  });
  return `#compdef hch

_hch() {
  local curcontext="$curcontext" state line
  typeset -A opt_args
  _arguments -C \\
    ${helpSpec} \\
    '1: :->command' \\
    '*:: :->args'
  case $state in
    command)
      local -a commands=(
${entries.join('\n')}
      )
      _describe command commands
      ;;
    args)
      case $line[1] in
${branches.join('\n')}
      esac
      ;;
  esac
}

compdef _hch hch
`;
}

/** Each supported shell's script generator. Adding a shell here is all it takes to support it. */
const generators: Record<string, (commands: CommandInfo[]) => string> = { zsh: zshCompletion };

export const shells = Object.keys(generators);

/** The completion script for `shell`. */
export function completionScript(shell: string | undefined, commands: CommandInfo[]): string {
  if (shell === undefined) throw new HchError(`completion needs a shell: ${shells.join(', ')}`, 2);
  if (!Object.hasOwn(generators, shell)) {
    throw new HchError(`unknown shell '${shell}' (supported: ${shells.join(', ')})`, 2);
  }
  return generators[shell]!(commands);
}
