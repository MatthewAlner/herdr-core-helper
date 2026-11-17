# hch zsh completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `hch completion zsh` prints a zsh completion script, generated from the same command table that drives parsing and `USAGE`.

**Architecture:** The `commands` table in `src/cli.ts` gains a `description` per command and entries for `help` and `completion`, and `USAGE` is built from it. `src/commands/completion.ts` turns a list of command descriptions into a `#compdef hch` script that uses `_arguments` and `_describe`, ending with `compdef _hch hch` so it works when sourced.

**Tech Stack:** Bun, TypeScript, `bun:test`, zsh completion system.

**Spec:** `docs/superpowers/specs/2026-11-17-zsh-completion-design.md`

## Global Constraints

- Loaded with `source <(hch completion zsh)` in `.zshrc`, after `compinit`.
- Only `zsh` is supported. A missing or other shell is a usage error, exit 2.
- `completion` takes no format flags.
- Format flags offered per command: `--json`, `--table`, `--markdown` for `where` and `version`. Only `--json` for `up`. They're mutually exclusive in completion.
- `USAGE` keeps today's text, plus one line for `completion`. The commands column widens to fit `completion`: names are padded to the longest name plus two spaces.
- Keep parsing and formatting in exported pure functions with unit tests beside them (`AGENTS.md`).
- Run `bun run format` before each commit.

## Review Focus

- A description containing `'` (`up`'s "this tab's shell") must not break the script's single quoting. Pinned by `zshCompletion escapes single quotes` in Task 1.
- A description containing `:` would split a `_describe` entry. Pinned by `zshCompletion escapes colons in command descriptions` in Task 1.
- Sourcing the script must register it even though `#compdef` is ignored when sourced. Pinned by the `compdef _hch hch` assertion in Task 1 and the live check in Task 3.
- `hch completion zsh --json` must be rejected, not print a script. Pinned in Task 2's CLI tests.
- `hch -h`, `hch --json` and `hch help --json` must behave exactly as today after `help` moves into the table. The existing `cli.test.ts` help tests must still pass unchanged.

---

### Task 1: zsh script generator

**Files:**

- Create: `src/commands/completion.ts`
- Test: `src/commands/completion.test.ts`

**Interfaces:**

- Produces:
  - `export type CommandInfo = { name: string; description: string; formats: Format[]; args?: string[] }`. `formats` includes `'plain'`. `args` lists the values allowed for the command's first positional argument.
  - `export const shells = ['zsh']`
  - `export function zshCompletion(commands: CommandInfo[]): string`
  - `export function completionScript(shell: string | undefined, commands: CommandInfo[]): string`. It throws `HchError` with exit code 2: `completion needs a shell: zsh` when `shell` is undefined, and `unknown shell '<shell>' (supported: zsh)` otherwise.

The script `zshCompletion` should produce, shown here for `where` and `up` only. Flag descriptions are fixed: `--json` → `print JSON`, `--table` → `print a table`, `--markdown` → `print a Markdown table`. Quote every spec in single quotes, escaping `'` as `'\''`. In `_describe` entries, also escape `:` in descriptions as `\:`. A command with no non-plain formats and no `args` gets no `case` branch.

```zsh
#compdef hch

_hch() {
  local curcontext="$curcontext" state line
  typeset -A opt_args
  _arguments -C \
    '(- *)'{-h,--help}'[show help]' \
    '1: :->command' \
    '*:: :->args'
  case $state in
    command)
      local -a commands=(
        'where:show the space, tab and pane this terminal is in'
        'up:replace this tab'\''s shell with a fresh one on the installed herdr core'
      )
      _describe command commands
      ;;
    args)
      case $line[1] in
        where)
          _arguments \
            '(--json --table --markdown)--json[print JSON]' \
            '(--json --table --markdown)--table[print a table]' \
            '(--json --table --markdown)--markdown[print a Markdown table]'
          ;;
        up)
          _arguments \
            '(--json)--json[print JSON]'
          ;;
      esac
      ;;
  esac
}

compdef _hch hch
```

A command with `args` gets `'1: :(zsh)'` in its `_arguments` call, with the values separated by spaces.

- [ ] **Step 1: Write the failing tests** in `src/commands/completion.test.ts`:
  - `zshCompletion starts with #compdef and ends by registering with compdef`: `toStartWith('#compdef hch\n')`, and `trimEnd()` ends with `compdef _hch hch`.
  - `zshCompletion lists each command with its description`: for `[{ name: 'where', description: 'show where', formats: ['plain', 'json'] }]`, contains `'where:show where'`.
  - `zshCompletion escapes single quotes`: description `this tab's shell` gives `this tab'\''s shell`.
  - `zshCompletion escapes colons in command descriptions`: description `a:b` gives `'x:a\:b'` for command `x`.
  - `zshCompletion offers only a command's own format flags, mutually exclusive`: for `up` with `['plain', 'json']`, the `up)` branch contains `'(--json)--json[print JSON]'` and the script doesn't contain `--table`.
  - `zshCompletion completes positional values`: for `{ name: 'completion', description: 'c', formats: ['plain'], args: ['zsh'] }`, contains `'1: :(zsh)'`.
  - `zshCompletion leaves out a branch for a command with no flags or args`: for `help` with `['plain']`, doesn't contain `help)`.
  - `completionScript returns the zsh script for zsh`: equals `zshCompletion(commands)`.
  - `completionScript with no shell throws exit 2` and `completionScript with an unknown shell throws exit 2`: check that it throws `HchError`, and check `exitCode` 2 and the exact messages above.

- [ ] **Step 2: Run them to see them fail**

Run: `bun test src/commands/completion.test.ts`
Expected: FAIL, cannot find module `./completion.ts`.

- [ ] **Step 3: Implement `completion.ts`** with the signatures above. A small `quote(s: string): string` helper does the single-quote escaping.

- [ ] **Step 4: Run the tests to see them pass, and check the generated script parses**

Run: `bun test src/commands/completion.test.ts`
Expected: all pass.

Run: `bun -e "import { zshCompletion } from './src/commands/completion.ts'; console.log(zshCompletion([{ name: 'up', description: \"this tab's shell\", formats: ['plain', 'json'] }]))" | zsh -n`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/commands/completion.ts src/commands/completion.test.ts
git commit -m "feat: generate a zsh completion script"
```

### Task 2: Wire `hch completion` into the CLI

**Files:**

- Modify: `src/cli.ts`
- Test: `src/cli.test.ts`

**Interfaces:**

- Consumes: `CommandInfo`, `completionScript` from Task 1.

The `Command` type becomes `CommandInfo` minus `name`, plus `run: (format: Format, args: string[]) => Promise<void> | void`. The table gets descriptions copied from today's `USAGE`, and two entries:

- `help`: description `show this help`, formats `['plain']`, run prints the usage.
- `completion`: description `print a shell completion script (zsh)`, formats `['plain']`, args `shells`. Run prints `completionScript(args[0], <the table as CommandInfo[]>)`, with no added trailing newline beyond `console.log`'s.

Order: `where`, `version`, `up`, `completion`, `help`. `USAGE` becomes a function, or a constant computed after the table. It builds the `Commands` section as two spaces, then the name padded to the longest name plus two, then the description, in that order, and the rest of the text stays unchanged. In `main`, `values.help` or no positional selects `help`. Then the existing lookup and format check handle it, so `help --json` still gives `help doesn't support --json`. Pass `positionals.slice(1)` as `args`.

An `HchError` with exit 2 from `completionScript` prints as `hch: <message>` through the existing catch. That's enough for this command: don't append the usage.

- [ ] **Step 1: Write the failing CLI tests** in `src/cli.test.ts`:
  - `completion zsh prints a script that registers _hch`: exit 0, stdout starts with `#compdef hch`, contains `'where:show the space, tab and pane this terminal is in'` and `compdef _hch hch`, and stderr is empty.
  - `completion with no shell exits 2`: stderr starts with `hch: completion needs a shell: zsh`.
  - `completion with an unknown shell exits 2`: `['completion', 'bash']`, stderr starts with `hch: unknown shell 'bash' (supported: zsh)`.
  - `completion rejects format flags`: `['completion', 'zsh', '--json']`, exit 2, stderr starts with `hch: completion doesn't support --json`, stdout empty.
  - `usage lists the completion command`: `hch help` stdout contains `  completion  print a shell completion script (zsh)`.

- [ ] **Step 2: Run them to see them fail**

Run: `bun test src/cli.test.ts`
Expected: the five new tests fail, and the existing ones pass.

- [ ] **Step 3: Refactor `cli.ts`** as described above.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `bun test && bun run typecheck`
Expected: all pass, including the existing help and format-flag tests unchanged.

Run: `bun src/cli.ts completion zsh | zsh -n`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
bun run format
git add src/cli.ts src/cli.test.ts
git commit -m "feat: add hch completion zsh"
```

### Task 3: Docs and live check

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add the command to the README's Commands table**: `` `hch completion zsh` `` | `Print a zsh completion script`.

- [ ] **Step 2: Add a `## Completions` section after `## Install`**:

````markdown
## Completions

For tab completion in zsh, add this to your `.zshrc`, after `compinit` runs:

```zsh
source <(hch completion zsh)
```

It completes commands and each command's format flags.
````

- [ ] **Step 3: Live check in a real zsh.** Load the script and confirm it registers the function. Then drive a completion with `zpty` and confirm `hch <TAB>` lists the commands and `hch up --<TAB>` offers only `--json`:

Run: `zsh -fc 'autoload -U compinit; compinit -u; source <(bun src/cli.ts completion zsh); print -r -- ${_comps[hch]}'`
Expected: `_hch`

Then use a `zpty` session (`zmodload zsh/zpty`, start `zsh -f`, load compinit and the script, send `hch up --\t`, and read the output) to confirm the candidates. If `zpty` proves flaky, report what was and wasn't checked rather than claiming success.

- [ ] **Step 4: Commit**

```bash
bun run format
git add README.md
git commit -m "docs: document zsh completion"
```
