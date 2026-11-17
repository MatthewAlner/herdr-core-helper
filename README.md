# herdr-core-helper

`hch` is a small CLI of helpers for herdr core's `hc` command. It runs inside an `hc` terminal and reads `HC_TERMINAL_ID` from the environment.

## Commands

```
hch <command> [--json | --table | --markdown]
```

| Command              | What it does                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `hch where`          | Show the space, tab and pane this terminal is in, by name and id                                                                 |
| `hch version`        | Show the herdr core build this tab runs, and the installed one                                                                   |
| `hch update`         | When this tab runs an older herdr core, replace its shell with a fresh one on the installed build, in the same tab and directory |
| `hch completion zsh` | Print a zsh completion script                                                                                                    |
| `hch help`           | Show usage                                                                                                                       |

```console
$ hch where
space: my-project  spac0123456789abcdef0123456789abcd
tab:   1  tb0123456789abcdef0123456789abcdef
pane:  t14

$ hch version
herdr core 0.1.20, 0.1.21 installed: run hch update

$ hch update
herdr core 0.1.20, 0.1.21 installed: run hch update
Update this tab to 0.1.21? [y/N] y
hch update: t14 -> t15
```

When the tab is up to date, `hch version` and `hch update` both print `herdr core 0.1.21, up to date`, and `hch update` stops there. If the tab runs a newer build than the installed one, they print `herdr core 0.1.22, 0.1.21 installed (older)` instead.

### Updating a tab

`hch update` asks before it replaces the shell. Enter, or anything other than `y` or `yes`, leaves it alone. Two flags change that:

| Flag          | What it does                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `--force`     | Replace the shell even when the tab is up to date, after asking "anyway?"                             |
| `-y`, `--yes` | Don't ask. Needed when `hch update` would ask but can't: with `--json`, or with no terminal attached. |

The new shell prints its version line first, before your shell's startup files run, so the new pane shows what it now runs. `hch update` also focuses the new pane in the Herdr app with `herdr-app do pane.focus`, before it ends the old shell. Without `herdr-app` on your `PATH` it skips that step, and if Herdr can't focus the pane it says why and replaces the shell anyway.

For tables or JSON instead, see [Output formats](#output-formats).

## Output formats

Commands print plain text by default. Add one of these flags for other formats:

| Flag         | Prints                     | Commands                        |
| ------------ | -------------------------- | ------------------------------- |
| `--table`    | a box-drawn table          | `where`, `version`              |
| `--markdown` | a Markdown table           | `where`, `version`              |
| `--json`     | JSON, for scripts and `jq` | `where`, `version` and `update` |

```console
$ hch where --table
┌───────┬────────────┬────────────────────────────────────┐
│       │    Name    │                 ID                 │
├───────┼────────────┼────────────────────────────────────┤
│ Space │ my-project │ spac0123456789abcdef0123456789abcd │
├───────┼────────────┼────────────────────────────────────┤
│ Tab   │ 1          │ tb0123456789abcdef0123456789abcdef │
├───────┼────────────┼────────────────────────────────────┤
│ Pane  │            │ t14                                │
└───────┴────────────┴────────────────────────────────────┘

$ hch where --markdown
|       | Name       | ID                                 |
| ----- | ---------- | ---------------------------------- |
| Space | my-project | spac0123456789abcdef0123456789abcd |
| Tab   | 1          | tb0123456789abcdef0123456789abcdef |
| Pane  |            | t14                                |

$ hch where --json
{
  "space": {
    "name": "my-project",
    "id": "spac0123456789abcdef0123456789abcd"
  },
  "tab": {
    "name": "1",
    "id": "tb0123456789abcdef0123456789abcdef"
  },
  "pane": "t14"
}

$ hch version --table
┌───────────┬─────────┐
│           │ Version │
├───────────┼─────────┤
│ Tab       │ 0.1.20  │
├───────────┼─────────┤
│ Installed │ 0.1.21  │
└───────────┴─────────┘

$ hch version --markdown
|           | Version |
| --------- | ------- |
| Tab       | 0.1.20  |
| Installed | 0.1.21  |

$ hch version --json
{
  "tab": "0.1.20",
  "installed": "0.1.21",
  "up_to_date": false
}

$ hch update --json -y
{
  "from": "t14",
  "to": "t15"
}

$ hch update --json        # on an up-to-date tab, it stops
{
  "tab": "0.1.21",
  "installed": "0.1.21",
  "up_to_date": true,
  "updated": false
}
```

A missing name or id is `null` in JSON and an empty cell in the tables. Passing more than one format flag, or one the command doesn't take, is an error.

## Install

Needs [Bun](https://bun.com) and herdr core's `hc` on your `PATH`.

```bash
git clone https://github.com/MatthewAlner/herdr-core-helper.git
cd herdr-core-helper
bun run setup
```

`bun run setup` installs the dependencies and runs `bun link`, which puts `hch` in `~/.bun/bin`, running straight from the source, so edits take effect immediately.

## Completions

For tab completion in zsh, add this to your `.zshrc`, after `compinit` runs:

```zsh
source <(hch completion zsh)
```

It completes commands, and after a command, the format flags and options that command takes:

```console
$ hch <TAB>
completion  -- print a shell completion script (zsh)
help        -- show this help
update      -- update this tab's shell to the installed herdr core, asking first
version     -- show whether this tab runs the installed herdr core
where       -- show the space, tab and pane this terminal is in

$ hch where -<TAB>
--help      -h  -- show help
--json          -- print JSON
--markdown      -- print a Markdown table
--table         -- print a table

$ hch update -<TAB>
--force      -- replace the shell even when it's up to date
--help   -h  -- show help
--json       -- print JSON
--yes    -y  -- replace it without asking
```

## Develop

```bash
bun test
bun run typecheck
bun run format         # format everything with Prettier
bun run format:check   # check formatting without changing files
```
