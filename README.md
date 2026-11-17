# herdr-core-helper

`hch` is a small CLI of helpers for herdr core's `hc` command. It runs inside an `hc` terminal and reads `HC_TERMINAL_ID` from the environment.

## Commands

| Command       | What it does                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `hch where`   | Show the space, tab and pane this terminal is in, by name and id                                     |
| `hch version` | Show the herdr core build this tab runs, and the installed one                                       |
| `hch up`      | Replace this tab's shell with a fresh one on the installed herdr core, in the same tab and directory |
| `hch help`    | Show usage                                                                                           |

```console
$ hch where
space: my-project  spac0123456789abcdef0123456789abcd
tab:   1  tb0123456789abcdef0123456789abcdef
pane:  t14

$ hch version
tab: 0.1.20  installed: 0.1.21
```

## Install

Needs [Bun](https://bun.com) and herdr core's `hc` on your `PATH`.

```bash
git clone https://github.com/MatthewAlner/herdr-core-helper.git
cd herdr-core-helper
bun install
bun link
```

`bun link` puts `hch` in `~/.bun/bin`, running straight from the source, so edits take effect immediately.

## Develop

```bash
bun test
bun run typecheck
```
