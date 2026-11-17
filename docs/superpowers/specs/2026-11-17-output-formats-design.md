# hch output formats: design

## Intent

Give `hch` output modes besides its plain text: `--table` for a boxed table that's easy to read in a terminal, `--markdown` for a table to paste into notes, PRs and chat, and `--json` for scripts and agents. The plain output stays the default, so nothing that reads it today changes.

The repo also gets Prettier, so the code has one enforced style before the feature lands.

## Goals

- `hch where` and `hch version` accept `--json`, `--table` and `--markdown`.
- `hch up` accepts `--json`, printing the old and new terminal IDs.
- The box table matches this style: box-drawing borders, centred headers, a rule between every row.
- The Markdown table has padded columns, already aligned the way Prettier leaves it.

## Non-goals

- No automatic switch to JSON when output is piped (unlike `hc`). Output only changes when a flag asks for it.
- No `--table` or `--markdown` for `up`: it acts rather than reports, and a one-row table adds nothing.
- No output flags for `help`.

## Approaches

1. **Libraries (chosen).** `cli-table3` draws the box table and `markdown-table` draws the Markdown table. Both were tried and match the target output exactly. Socket scores both 100 on supply chain and vulnerability. Chosen by Matt.
2. **Own renderer.** About 40 lines and no dependency, but it means writing and testing border and width logic that the libraries already get right.
3. **Prettier at runtime for Markdown.** It works, adding about 70 ms, but it's an 11 MB runtime dependency for output that `markdown-table` already produces identically. Prettier is used only as a dev tool for formatting code.

`Bun.inspect.table` was ruled out: it adds an index column, has no rules between rows, and left-aligns headers.

## Design

### Step 1: Prettier

- `prettier` as a dev dependency, configured by `.prettierrc`: `printWidth` 120, `singleQuote` true, `arrowParens` `"avoid"`.
- Scripts: `format` (`prettier --write .`) and `format:check` (`prettier --check .`).
- Reformat the whole repo in its own commit, before any feature code.
- `AGENTS.md` says to run `bun run format` before committing, replacing the narrower rule about Markdown tables.

### Step 2: Output formats

- **Flags:** `--json`, `--table`, `--markdown`, parsed in `src/cli.ts`. Passing more than one is a usage error: `hch: choose one of --json, --table, --markdown`, exit 2. A flag the command doesn't support, such as `hch up --table`, is also a usage error with exit 2. `hch help` and bare `hch` take no format flags.
- **Data, then format:** each command builds its data once, then a shared module (`src/output.ts`) renders it in the chosen format. A command declares which formats it supports.
- **`where`:**
  - plain: unchanged.
  - JSON: `{"space":{"name","id"},"tab":{"name","id"},"pane"}`. A missing name or id is `null`.
  - table and Markdown: header `["", "Name", "ID"]`, rows `Space`, `Tab` and `Pane`, where `Pane` has an empty name. Missing values are empty cells.
- **`version`:**
  - plain: unchanged.
  - JSON: `{"tab","installed"}`.
  - table and Markdown: header `["", "Version"]`, rows `Tab` and `Installed`.
- **`up`:** plain is unchanged. JSON is `{"from","to"}`, printed before the old terminal is killed, as the plain line is today.
- **Box table:** `cli-table3` with no colour, headers centred, body cells left-aligned, a rule between every row.
- **Markdown:** `markdown-table` with its default padding.
- **Help text:** the usage lists the three flags and which commands take them.
- **README:** document the flags, with an example of each format.

### Testing

- Unit tests for each renderer in `src/output.ts`, and for each command's data builder.
- CLI tests in `src/cli.test.ts` against the fake `hc`: each format for `where`, a conflicting pair of flags exiting 2, an unsupported flag on `up` exiting 2, and `up --json`.
- After the tests pass, check `where` and `version` in each format live, and `up --json` on a throwaway terminal, as described in `AGENTS.md`.

## Left to the builder

- Exact names and the module layout inside `src/output.ts`.
- Exact wording of the help text.
