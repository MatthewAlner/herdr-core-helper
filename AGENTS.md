# herdr-core-helper

`hch` is a Bun CLI that wraps herdr core's `hc` command. See `README.md` for the commands, install and dev scripts, and `docs/superpowers/specs/` for the designs.

Commit design specs to `docs/superpowers/specs/`, but keep implementation plans out of git: `docs/superpowers/plans/` is ignored, because the code records the how and a stale plan misleads later searches.

## Code

- Each command lives in `src/commands/<name>.ts`. Keep its parsing and formatting in exported pure functions with unit tests beside it, and keep the `hc` calls in `src/hc.ts`.
- `src/cli.test.ts` runs `src/cli.ts` as a subprocess against a fake `hc` and `herdr-app` on `PATH`, leaving out the real ones. Cover exit codes and error messages there.
- Throw `HchError` for failures the user should see. `src/cli.ts` prints it as `hch: <message>` and exits with its code.
- Interpolating an array into Bun Shell's `` $`...` `` passes each element as a separate argument.

## Checking hch live

Run these after `bun test` passes, for changes that touch how `hch` talks to `hc`. `bun link` makes `hch` run from the source, so the checks see your edits. Remove every terminal and workspace you create.

`hch update` kills the terminal it runs in, so never run it with your own `HC_TERMINAL_ID`. Your tab is usually up to date, so these checks pass `--force`; without a terminal to ask through they also need `-y`. Point it at a throwaway terminal:

```bash
id=$(hc run --bg --no-parent --keep --json --label=test=x | jq -r .address)
HC_TERMINAL_ID=$id hch update --force -y   # the version line, then "hch update: <id> -> <new>"
hc get <new> --json | jq '{cwd, labels}'
hc kill <new>; hc rm $id; hc rm <new>
```

To check `hch update` in a real herdr core tab, run it from inside a terminal in your own tab. Copy your terminal's labels, except `herdr.seen`, so the new terminal joins your tab. Starting it in `/tmp`, a symlink to `/private/tmp` on macOS, also checks that the new shell keeps the folder as typed:

```bash
hc get "$HC_TERMINAL_ID" --json | jq -r '.labels | to_entries[] | select(.key != "herdr.seen") | "--label=\(.key)=\(.value)"'
hc run --bg --no-parent --keep --json --cwd /tmp --label=hchtest=1 <those labels...>   # gives <t>
hc send <t> 'cd /tmp && hch where; pwd; echo "id=$HC_TERMINAL_ID"'
hc wait <t> --output 'id=<t>'; hc read <t>
hc send <t> 'hch update --force'; hc send <t> 'n'
hc read <t>                             # the version line, "...anyway? [y/N] n", and <t> still live
hc send <t> 'hch update --force -y'
hc read <t>                             # "hch update: <t> -> <new>"; <t> is now finished
hc wait <new> --output 'herdr core'; hc read <new>   # the version line comes first
herdr-app status | jq .focused_pane    # the pane showing <new>: hch update focused it
hc send <new> 'hch where; pwd'          # same space and tab, pane <new>, /tmp
hc kill <new>; hc rm <t>; hc rm <new>
```

Panes in the older `herdr` multiplexer aren't `hc` terminals: they set `HERDR_ENV=1` and leave `HC_TERMINAL_ID` unset. To check that `hch` refuses cleanly there, use a throwaway workspace that doesn't take focus:

```bash
herdr workspace create --label hch-test --cwd /tmp --no-focus   # gives the workspace and its root pane
herdr pane run <pane> 'hch where; echo "exit=$?"'
herdr pane wait-output <pane> --match 'exit=' --timeout 20000
herdr pane read <pane> --source recent-unwrapped --lines 20     # "hch: not in an hc terminal", exit=1
herdr workspace close <workspace>
```

## Repo

- The repo is public. Keep personal paths and details out of committed files.
- Run `bun run format` before committing.

## Bun

Use Bun instead of Node.js:

- `bun <file>` instead of `node` or `ts-node`, `bun test` instead of jest or vitest, `bun install` instead of npm, yarn or pnpm, `bun run <script>` instead of `npm run`, and `bunx` instead of `npx`.
- Bun loads `.env` automatically, so there's no need for dotenv.
- Use `` Bun.$`cmd` `` instead of execa, and `Bun.file` instead of `node:fs` readFile and writeFile.
- The Bun API docs are in `node_modules/bun-types/docs/**.mdx`.
