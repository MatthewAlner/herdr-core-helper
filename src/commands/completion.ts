import { HchError } from '../hc.ts';
import type { Format } from '../output.ts';

/** What completion needs to know about a command. `args` lists the values its first positional argument takes. */
export type CommandInfo = { name: string; description: string; formats: Format[]; args?: string[] };

export const shells = ['zsh'];

const flagDescriptions: Record<Exclude<Format, 'plain'>, string> = {
  json: 'print JSON',
  table: 'print a table',
  markdown: 'print a Markdown table',
};

/** Single-quotes a string for zsh. */
function quote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`;
}

/** The `_arguments` specs for one command, or none when it takes no flags or arguments. */
function argumentSpecs({ formats, args }: CommandInfo): string[] {
  const flags = formats.filter(f => f !== 'plain');
  const exclusions = `(${flags.map(f => `--${f}`).join(' ')})`;
  const specs = flags.map(f => quote(`${exclusions}--${f}[${flagDescriptions[f]}]`));
  if (args?.length) specs.push(quote(`1: :(${args.join(' ')})`));
  return specs;
}

/** A zsh completion script for `hch`, to be loaded with `source <(hch completion zsh)`. */
export function zshCompletion(commands: CommandInfo[]): string {
  const entries = commands.map(c => `        ${quote(`${c.name}:${c.description.replaceAll(':', '\\:')}`)}`);
  const branches = commands.flatMap(c => {
    const specs = argumentSpecs(c);
    if (!specs.length) return [];
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
    '(- *)'{-h,--help}'[show help]' \\
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

/** The completion script for `shell`. */
export function completionScript(shell: string | undefined, commands: CommandInfo[]): string {
  if (shell === undefined) throw new HchError(`completion needs a shell: ${shells.join(', ')}`, 2);
  if (shell !== 'zsh') throw new HchError(`unknown shell '${shell}' (supported: ${shells.join(', ')})`, 2);
  return zshCompletion(commands);
}
