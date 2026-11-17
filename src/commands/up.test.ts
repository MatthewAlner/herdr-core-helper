import { expect, test } from "bun:test";
import { labelArgs, parseRunAddress } from "./up.ts";

test("labelArgs copies every label except herdr.seen", () => {
  expect(labelArgs({ "herdr.seen": "1", where: "a / 1", "herdr.tab": "tb" })).toEqual([
    "--label=where=a / 1",
    "--label=herdr.tab=tb",
  ]);
});

test("labelArgs with no labels gives no args", () => {
  expect(labelArgs({})).toEqual([]);
});

test("parseRunAddress returns the new terminal's address", () => {
  expect(parseRunAddress({ address: "t20" })).toBe("t20");
});

test("parseRunAddress throws when there is no address", () => {
  for (const json of [{}, { address: null }, { address: "" }, null]) {
    expect(() => parseRunAddress(json)).toThrow("couldn't start the new terminal");
  }
});
