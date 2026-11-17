# hch (herdr core helper): design

## Why

The user has a growing set of zsh functions (`hcw`, `hcv`, `hcup` in the user's zsh config) that wrap the `hc` CLI from herdr core. Handling `hc`'s JSON with jq inside zsh is getting awkward. Moving them into a small Bun CLI makes the JSON easy to work with in TypeScript and gives one discoverable command with subcommands.

## Goals

- `hch where`: print the space, tab and pane of the current terminal, by name and id (replaces `hcw`).
- `hch version`: print the herdr core build this terminal's holder process runs and the installed build (replaces `hcv`).
- `hch up`: replace this terminal's shell with a fresh one on the installed herdr core, in the same tab and cwd, then kill the old one (replaces `hcup`).
- `hch help` / `hch --help` / no args: usage.

## Non-goals

- Talking to the herdr core socket API directly (`hc connect` / `hc schema`). Shelling out to `hc` is enough for now.
- Commands that change the calling shell's state (cd, exec). A child process can't; those would need a zsh wrapper.
- A compiled single-file executable.

## Constraints

- Bun 1.4.2, TypeScript, no runtime dependencies.
- Reads `HC_TERMINAL_ID` from the environment; errors clearly when it's unset.
- Output matches the existing zsh functions so muscle memory carries over.

## Approaches

1. **Bun CLI run from source via `bun link`** (picked): `package.json` `bin` points at `src/cli.ts` with a `#!/usr/bin/env bun` shebang; `bun link` puts `hch` in `~/.bun/bin`, already on PATH. Edits take effect immediately.
2. Compiled executable (`bun build --compile`): faster start, but a build step after every change; not worth it for a personal helper.
3. Keep zsh functions: no new project, but jq handling keeps getting harder.

## Design

- Location: its own git repo, created with `bun init -y`.
- `src/cli.ts`: entry point; dispatches subcommands with `util.parseArgs`.
- `src/hc.ts`: typed wrappers over the `hc` CLI using Bun Shell (`$`), e.g. `getTerminal(id)`, `runTerminal(opts)`, `killTerminal(id)`.
- `src/commands/{where,version,up}.ts`: one file per command, each exporting a function; pure formatting split out so it can be tested.
- Tests with `bun test` for the pure parts (formatting `where`, building label args for `up`, parsing version strings).

## Left to the builder

- Exact help text and error messages.
- The `index.ts` that `bun init` created is removed in favour of `src/cli.ts`.

After `hch` works, ask the user before removing `hcw`, `hcv` and `hcup` from their zsh config.
