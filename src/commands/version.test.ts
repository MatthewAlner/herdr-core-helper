import { expect, test } from "bun:test";
import { formatVersion, parseVersion } from "./version.ts";

test("parseVersion takes the second field of the first line", () => {
  expect(parseVersion("hc 0.1.21\n")).toBe("0.1.21");
});

test("parseVersion throws on output with no version", () => {
  expect(() => parseVersion("")).toThrow();
});

test("formatVersion shows tab and installed builds", () => {
  expect(formatVersion("0.1.20", "0.1.21")).toBe("tab: 0.1.20  installed: 0.1.21");
});
