import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A fake `hc` that prints $FAKE_HC_STDOUT and $FAKE_HC_STDERR and exits $FAKE_HC_EXIT.
const fakeBin = mkdtempSync(join(tmpdir(), "hch-test-"));
writeFileSync(
  join(fakeBin, "hc"),
  `#!/bin/sh\nprintf '%s' "$FAKE_HC_STDOUT"\nprintf '%s' "$FAKE_HC_STDERR" >&2\nexit "\${FAKE_HC_EXIT:-0}"\n`,
);
chmodSync(join(fakeBin, "hc"), 0o755);
afterAll(() => rmSync(fakeBin, { recursive: true, force: true }));

type Hc = { stdout?: string; stderr?: string; exit?: number };

function hch(args: string[], { terminal, hc = {} }: { terminal?: string; hc?: Hc } = {}) {
  const env: Record<string, string> = {
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_HC_STDOUT: hc.stdout ?? "",
    FAKE_HC_STDERR: hc.stderr ?? "",
    FAKE_HC_EXIT: String(hc.exit ?? 0),
  };
  if (terminal) env.HC_TERMINAL_ID = terminal;
  const p = Bun.spawnSync([process.execPath, join(import.meta.dir, "cli.ts"), ...args], { env });
  return { exit: p.exitCode, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
}

test("no command prints usage and exits 0", () => {
  const r = hch([]);
  expect(r.exit).toBe(0);
  expect(r.stdout).toContain("Usage: hch <command>");
});

test("an unknown command exits 2 with usage on stderr", () => {
  const r = hch(["nope"]);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: unknown command 'nope'");
  expect(r.stderr).toContain("Usage: hch <command>");
});

test("an unknown option exits 2 instead of being ignored", () => {
  const r = hch(["--version"]);
  expect(r.exit).toBe(2);
  expect(r.stderr).toStartWith("hch: unknown option '--version'");
  expect(r.stdout).toBe("");
});

test("outside an hc terminal exits 1", () => {
  const r = hch(["where"]);
  expect(r.exit).toBe(1);
  expect(r.stderr).toBe("hch: not in an hc terminal\n");
});

test("an hc failure reports hc's error message and passes its exit code through", () => {
  const stderr = JSON.stringify({ error: { kind: "not_found", message: 'no terminal "t9"' } });
  const r = hch(["where"], { terminal: "t9", hc: { stderr, exit: 3 } });
  expect(r.exit).toBe(3);
  expect(r.stderr).toBe('hch: no terminal "t9"\n');
});

test("an hc failure that isn't JSON is reported as is", () => {
  const r = hch(["where"], { terminal: "t9", hc: { stderr: "boom", exit: 4 } });
  expect(r.exit).toBe(4);
  expect(r.stderr).toBe("hch: boom\n");
});

test("hc output that isn't JSON is a clean error, not a stack trace", () => {
  const r = hch(["where"], { terminal: "t9", hc: { stdout: "not json" } });
  expect(r.exit).toBe(1);
  expect(r.stderr).toBe("hch: hc get t9 --json didn't return JSON: not json\n");
});

test("where formats the terminal hc returns", () => {
  const stdout = JSON.stringify({ address: "t9", pid: 1, cwd: "/", labels: { where: "s / 2" } });
  const r = hch(["where"], { terminal: "t9", hc: { stdout } });
  expect(r.exit).toBe(0);
  expect(r.stdout).toBe("space: s  \ntab:   2  \npane:  t9\n");
});
