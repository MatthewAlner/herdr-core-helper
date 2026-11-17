# hch Output Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Prettier to the repo, then `--json`, `--table` and `--markdown` output for `hch where` and `hch version`, and `--json` for `hch up`.

**Architecture:** `src/cli.ts` parses one output format and checks the command supports it. Each command builds its data once and renders it through `src/output.ts`, which wraps `cli-table3` (box table) and `markdown-table` (Markdown).

**Tech Stack:** Bun, TypeScript, `cli-table3`, `markdown-table`, Prettier (dev only).

**Spec:** `docs/superpowers/specs/2026-11-17-output-formats-design.md`

## Global Constraints

- Plain output stays the default and is byte-for-byte unchanged.
- No automatic JSON when piped.
- More than one format flag: `hch: choose one of --json, --table, --markdown`, exit 2.
- A format the command doesn't support (e.g. `hch up --table`, `hch help --json`): usage error, exit 2.
- Box table: no colour, centred headers, left-aligned body, a rule between every row.
- Prettier config: `printWidth` 120, `singleQuote` true, `arrowParens` `"avoid"`.
- `git add` and `git commit` as separate commands; no heredocs in commit messages.
- Bun's `minimumReleaseAge` is 3 days and Socket scans installs; let Bun pick versions.

## Review Focus

- **Flag before the command** (`hch --json where`): works the same as after. Test in Task 3.
- **Missing labels** in `where`: JSON has `null`, table and Markdown have empty cells, never `?`. Tests in Task 4.
- **Format flag on `help` or bare `hch`**: exit 2, not usage on stdout. Test in Task 3.
- **`up --json` when `hc run` fails**: stdout stays empty, the error goes to stderr as today. Test in Task 6.
- **JSON is one value per run, ending in a newline**, so `jq` reads it. Asserted by `JSON.parse` in the CLI tests of Tasks 4–6.

---

### Task 1: Prettier

**Files:**

- Create: `.prettierrc`, `.prettierignore` (if needed, to skip `bun.lock`)
- Modify: `package.json` (devDependency and scripts), `AGENTS.md` (Repo section), every file Prettier reformats

- [ ] **Step 1:** `bun add -d prettier`, and write `.prettierrc` with the three settings from Global Constraints.
- [ ] **Step 2:** Add scripts `"format": "prettier --write ."` and `"format:check": "prettier --check ."`.
- [ ] **Step 3:** In `AGENTS.md`, replace "Run `prettier --write` on any Markdown file with a table before committing." with "Run `bun run format` before committing."
- [ ] **Step 4:** Run `bun run format`, then `bun run format:check` (expect: all files pass), `bun test` (expect: 19 pass) and `bun run typecheck` (expect: clean).
- [ ] **Step 5:** Commit the config, scripts and `AGENTS.md` first (`chore: add prettier`), then the reformatted files (`style: format with prettier`).

### Task 2: Renderers

**Files:**

- Create: `src/output.ts`, `src/output.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**

- Produces:
  - `type Format = 'plain' | 'json' | 'table' | 'markdown'`
  - `type Rows = { header: string[]; rows: string[][] }`
  - `renderTable(t: Rows): string`
  - `renderMarkdown(t: Rows): string`
  - `renderJson(data: unknown): string` (2-space indent, no trailing newline)

- [ ] **Step 1:** `bun add cli-table3 markdown-table`.
- [ ] **Step 2: Write failing tests** in `src/output.test.ts`:

```ts
const t = {
  header: ['', 'Name'],
  rows: [
    ['Space', 'abc'],
    ['Tab', '1'],
  ],
};

test('renderTable draws a box with centred headers and a rule between rows', () => {
  expect(renderTable(t)).toBe(
    [
      '┌───────┬──────┐',
      '│       │ Name │',
      '├───────┼──────┤',
      '│ Space │ abc  │',
      '├───────┼──────┤',
      '│ Tab   │ 1    │',
      '└───────┴──────┘',
    ].join('\n'),
  );
});

test('renderMarkdown pads columns', () => {
  expect(renderMarkdown(t)).toBe(
    ['|       | Name |', '| ----- | ---- |', '| Space | abc  |', '| Tab   | 1    |'].join('\n'),
  );
});

test('renderJson indents by two spaces', () => {
  expect(renderJson({ a: 1 })).toBe('{\n  "a": 1\n}');
});
```

Add one more `renderTable` test whose header is wider than its column (e.g. header `'Version'`, cell `'1'`) to pin that headers are centred and body cells left-aligned.

- [ ] **Step 3:** `bun test src/output.test.ts`. Expected: fails because `./output.ts` doesn't exist.
- [ ] **Step 4:** Implement. `renderTable` uses `cli-table3` with `style: { head: [], border: [] }`, header cells `{ content, hAlign: 'center' }`. `renderMarkdown` calls `markdownTable([header, ...rows])`.
- [ ] **Step 5:** `bun test` and `bun run typecheck`. Expected: all pass.
- [ ] **Step 6:** Commit: `feat: add table, markdown and json renderers`.

### Task 3: Format flags in the CLI

**Files:**

- Modify: `src/cli.ts`, `src/commands/where.ts`, `src/commands/version.ts`, `src/commands/up.ts` (signatures only), `src/cli.test.ts`

**Interfaces:**

- Consumes: `Format` from Task 2.
- Produces:
  - `type Command = { run: (format: Format) => Promise<void>; formats: Format[] }` in `src/cli.ts`.
  - `where(format: Format)`, `version(format: Format)`, `up(format: Format)`. Until Tasks 4–6 they ignore anything but `'plain'`.
  - Registry: `where` and `version` support all four formats, `up` supports `plain` and `json`.

- [ ] **Step 1: Write failing CLI tests** in `src/cli.test.ts`:
  - `hch(['where', '--json', '--table'])`: exit 2, stderr starts with `hch: choose one of --json, --table, --markdown`.
  - `hch(['up', '--table'])`: exit 2, stderr starts with `hch: up doesn't support --table`.
  - `hch(['help', '--json'])` and `hch(['--json'])`: exit 2, stdout empty.
  - `hch(['--json', 'where'], { terminal: 't9', hc: { stdout } })`: exit 0 (flag before the command works; content is checked in Task 4).
- [ ] **Step 2:** `bun test src/cli.test.ts`. Expected: the new tests fail (flags are currently unknown options).
- [ ] **Step 3:** Implement. Add `json`, `table` and `markdown` booleans to the `parseArgs` options. More than one set → the conflict error. No command (or `help`) plus any format → `hch: help doesn't support --<flag>`, exit 2. Unsupported format for the command → `hch: <command> doesn't support --<flag>`, exit 2. Print usage after each of these, as for unknown options. Otherwise call `command.run(format)`.
- [ ] **Step 4:** Update `USAGE` to list an `Options` block naming the three flags and that `up` takes only `--json`.
- [ ] **Step 5:** `bun test` and `bun run typecheck`. Expected: all pass.
- [ ] **Step 6:** Commit: `feat: parse --json, --table and --markdown`.

### Task 4: `where` formats

**Files:**

- Modify: `src/commands/where.ts`, `src/commands/where.test.ts`, `src/cli.test.ts`

**Interfaces:**

- Consumes: `Format`, `Rows`, the three renderers.
- Produces: `type WhereData = { space: { name: string | null; id: string | null }; tab: { name: string | null; id: string | null }; pane: string }`, `whereData(t: Terminal): WhereData`, `whereRows(d: WhereData): Rows`.

- [ ] **Step 1: Write failing tests** in `where.test.ts`, using the existing `t` fixture:
  - `whereData(t)` equals `{ space: { name: 'ai-sandbox', id: 'spacb1' }, tab: { name: '1', id: 'tb3e' }, pane: 't14' }`.
  - `whereData({ ...t, labels: {} })` has `null` for every name and id.
  - `whereRows(whereData(t))` equals `{ header: ['', 'Name', 'ID'], rows: [['Space', 'ai-sandbox', 'spacb1'], ['Tab', '1', 'tb3e'], ['Pane', '', 't14']] }`.
  - `whereRows` of the empty-labels data has `''` wherever a value is `null`.
- [ ] **Step 2: Write failing CLI tests**: `where --json` output `JSON.parse`s to the expected `WhereData`; `where --markdown` output starts with `|       | Name`; `where --table` output starts with `┌`.
- [ ] **Step 3:** Run the tests. Expected: fail because `whereData` and `whereRows` don't exist.
- [ ] **Step 4:** Implement both, and make `where(format)` print plain (`formatWhere`, unchanged), `renderJson(whereData)`, `renderTable(whereRows(...))` or `renderMarkdown(whereRows(...))`.
- [ ] **Step 5:** `bun test` and `bun run typecheck`. Expected: all pass.
- [ ] **Step 6:** Commit: `feat: add output formats to hch where`.

### Task 5: `version` formats

**Files:**

- Modify: `src/commands/version.ts`, `src/commands/version.test.ts`

**Interfaces:**

- Produces: `type VersionData = { tab: string; installed: string }`, `versionRows(d: VersionData): Rows`.

- [ ] **Step 1: Write the failing test:** `versionRows({ tab: '0.1.20', installed: '0.1.21' })` equals `{ header: ['', 'Version'], rows: [['Tab', '0.1.20'], ['Installed', '0.1.21']] }`.
- [ ] **Step 2:** Run it. Expected: fails because `versionRows` doesn't exist.
- [ ] **Step 3:** Implement it, and make `version(format)` render `{ tab, installed }` in the chosen format. Plain stays `formatVersion(tab, installed)`. No CLI test: `version` shells out to `ps` and `lsof`, which the fake `hc` can't stand in for; Task 7 checks it live.
- [ ] **Step 4:** `bun test` and `bun run typecheck`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat: add output formats to hch version`.

### Task 6: `up --json`

**Files:**

- Modify: `src/commands/up.ts`, `src/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests.** The fake `hc` prints the same `FAKE_HC_STDOUT` for every call, so give it JSON that satisfies both `hc get` and `hc run`: `{ "address": "t20", "pid": 1, "cwd": "/", "labels": {} }`.
  - `hch(['up', '--json'], { terminal: 't9', hc: { stdout } })`: exit 0, `JSON.parse(stdout)` equals `{ from: 't9', to: 't20' }`.
  - With `hc: { stderr: '{"error":{"message":"boom"}}', exit: 3 }`: exit 3, stdout `''`, stderr `hch: boom\n`.
- [ ] **Step 2:** Run them. Expected: the first fails (plain line printed instead of JSON).
- [ ] **Step 3:** Implement: with `'json'`, print `renderJson({ from: id, to: next })` where the plain line is printed today, before `killTerminal`.
- [ ] **Step 4:** `bun test` and `bun run typecheck`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat: add --json to hch up`.

### Task 7: README and live check

**Files:**

- Modify: `README.md`

- [ ] **Step 1:** Add an **Output formats** section to `README.md`: the three flags, which commands take them, and one example each of `hch where --table`, `--markdown` and `--json` with the placeholder ids already used in the README. Run `bun run format`.
- [ ] **Step 2:** Live check, following `AGENTS.md`: `hch where` and `hch version` in each of the four formats in your own terminal, and `HC_TERMINAL_ID=<throwaway> hch up --json` on a throwaway terminal (then clean up). Expected: output matches the design and the plain output matches what it was before.
- [ ] **Step 3:** `bun run format:check`, `bun test` and `bun run typecheck`. Expected: all pass.
- [ ] **Step 4:** Commit: `docs: document output formats`.
