import { expect, test } from "bun:test";
import { requireTerminalId } from "../hc.ts";
import { formatWhere } from "./where.ts";

const t = {
  address: "t14",
  pid: 1,
  cwd: "/",
  labels: { where: "ai-sandbox / 1", "herdr.space": "spacb1", "herdr.tab": "tb3e" },
};

test("formats space, tab and pane", () => {
  expect(formatWhere(t)).toBe("space: ai-sandbox  spacb1\ntab:   1  tb3e\npane:  t14");
});

test("missing labels fall back to ? and empty ids", () => {
  expect(formatWhere({ ...t, labels: {} })).toBe("space: ?  \ntab:   ?  \npane:  t14");
});

test("requireTerminalId throws HchError when unset", () => {
  expect(() => requireTerminalId({})).toThrow("not in an hc terminal");
  expect(requireTerminalId({ HC_TERMINAL_ID: "t14" })).toBe("t14");
});
