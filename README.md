# herdr-core-helper

`hch` is a small CLI of helpers for herdr core's `hc` command. It runs inside an `hc` terminal and reads `HC_TERMINAL_ID` from the environment.

## Commands

```
hch <command> [--json | --table | --markdown]
```

| Command              | What it does                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `hch where`          | Show the space, tab and pane this terminal is in, by name and id                                                            |
| `hch version`        | Show the herdr core build this tab runs, and the installed one                                                              |
| `hch update`         | Replace this tab's shell with a fresh one on the installed herdr core, in the same tab and directory, and focus it in Herdr |
| `hch completion zsh` | Print a zsh completion script                                                                                               |
| `hch help`           | Show usage                                                                                                                  |

```console
$ hch where
space: my-project  spac0123456789abcdef0123456789abcd
tab:   1  tb0123456789abcdef0123456789abcdef
pane:  t14

$ hch version
tab: 0.1.20  installed: 0.1.21

$ hch update
hch update: t14 -> t15
```

`hch update` focuses the new terminal's pane in the Herdr app with `herdr-app do pane.focus`, before it ends the old shell. Without `herdr-app` on your `PATH` it skips that step, and if Herdr can't focus the pane it says why and replaces the shell anyway.

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
  "installed": "0.1.21"
}

$ hch update --json
{
  "from": "t14",
  "to": "t15"
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

It completes commands and each command's format flags:

```console
$ hch <TAB>
completion  -- print a shell completion script (zsh)
help        -- show this help
update      -- replace this tab's shell with a fresh one on the installed herdr core
version     -- show the herdr core build this tab runs, and the installed one
where       -- show the space, tab and pane this terminal is in

$ hch where -<TAB>
--help      -h  -- show help
--json          -- print JSON
--markdown      -- print a Markdown table
--table         -- print a table
```

## Develop

```bash
bun test
bun run typecheck
bun run format         # format everything with Prettier
bun run format:check   # check formatting without changing files
```
