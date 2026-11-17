# hch update flow: design

## Why

`hch update` (renamed from `hch up`) replaces the tab's shell straight away and says only `hch update: t14 -> t15`. In use, that's too little: you can't see whether the tab was out of date, whether replacing it was worth doing, or what the new shell runs. `hch version`'s `tab: 0.1.20  installed: 0.1.21` makes you compare two numbers yourself.

## Goals

- `hch version` leads with the verdict, in one line:
  - `herdr core 0.1.21, up to date`
  - `herdr core 0.1.20, 0.1.21 installed: run hch update`
  - `herdr core 0.1.22, 0.1.21 installed (older)` when the tab runs a newer build than the installed one.
- `hch update` prints that line first, then:
  - up to date: stops there, exit 0;
  - out of date: asks `Update this tab to 0.1.21? [y/N]`; `y` or `yes` (any case) replaces the shell, anything else stops with exit 0;
  - tab newer than installed: stops, as for up to date.
- `--force` replaces the shell even when it's up to date or newer; it still asks (`Replace this tab's shell anyway? [y/N]`) unless `-y`.
- `-y` / `--yes` skips the question.
- The new shell prints the version line first, before the rc file runs, so the new pane shows what it now runs.
- Keep what `hch update` already does: copy the labels except `herdr.seen`, keep the folder as typed, focus the new pane in Herdr before ending the old shell.

## Non-goals

- Installing a newer herdr core (`hc update` does that).
- Updating other tabs.

## Constraints

- A new terminal gets herdr core's environment, not the caller's: on a typical install its PATH has `hc` but not `bun` or `hch`. It does get `$SHELL` and `HC_TERMINAL_ID`. Without a command, `hc run` starts `$SHELL -l`.
- The repo is public and meant to be shared: no paths specific to one machine.

## Approaches

1. **Start the new shell through a wrapper** (picked). `hch update` runs the new terminal with `/bin/sh -c '<print version>; exec "$SHELL" -l'`. Self-contained, no delay, no setup. The line prints before the rc file's own output.
2. **`hc send <new> 'hch version'`** after starting it. The output comes after the prompt, but `hc send` waits for quiet (3 s or more), the old shell can't end until it returns, and a stuck rc file blocks it.
3. **A hook in `.zshrc`** that prints the version when `hch` left a marker. Cleanest output, but needs a setup line on every machine and does nothing without it.

## Design

- **Version data:** the tab's build comes from the herdr core process holding the shell, as now. The installed build is `hc --version`, replacing the hard-coded `~/.local/bin/herdr-core`: `hc` is that same binary, so this works wherever it's installed. A pure function compares the two versions (numerically, part by part) into `current`, `outdated` or `newer`.
- **Formats:** `--table` and `--markdown` keep their rows. `--json` gains `"up_to_date": true | false`.
- **The wrapper:** `hch update` builds the command from paths it knows in the old shell: `bun` from `process.execPath`, the script from `Bun.main`, the folder holding `hc` from `Bun.which('hc')`. It adds those folders to PATH for the version print only, quoting every path for `sh`:

  ```sh
  PATH='<hc dir>:<bun dir>':"$PATH" '<bun>' '<cli.ts>' version; exec "$SHELL" -l
  ```

  `;`, not `&&`, so a failed print still starts the shell.

- **The question:** read from the terminal. When stdin isn't a terminal, or with `--json`, `hch update` without `-y` doesn't ask: it fails with `hch: update needs --yes when it can't ask`, exit 2, before changing anything.
- **`--json`:** prints `{"from", "to"}` as now when it replaces the shell, or `{"tab", "installed", "up_to_date", "updated": false}` when it stops. JSON goes to stdout and nothing else does, so the version line isn't printed separately.
- **Flags:** `--force`, `-y` and `--yes` belong to `update` only; other commands reject them as unknown options. Completion offers them for `update`.

## Left to the builder

- Where the comparison and the wrapper-building functions live, as long as they're pure and unit-tested.
- The wording of the exit-2 usage message, if a clearer one fits the existing errors.
