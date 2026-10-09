import assert from "node:assert/strict";
import test from "node:test";
import {
  stringToPattern,
  parseSpan,
  parseMultiRowPattern,
  getSpanLength,
  getSpanValue,
  getSpanValues,
  calculatePatternColumns,
  inferColumnCount,
  columnsToEqualSpanPattern,
  getItemSpans,
} from "../src/helpers";
import type { UserSpanValue, UserSpanPattern } from "../src/types";

for (const [input, expected] of [
  [" 1  2\n3 ", [1, 2, 3]],
  ["2:1 1/3 _ +", ["2:1", "1/3", "_", "+"]],
  [
    "1 +2:3, +2/4:1/3 1",
    [
      [1, "+2:3"],
      ["+2/4:1/3", 1],
    ],
  ],
  ["6:1/3 4:1/2, +4, 5/11:2", [["6:1/3", "4:1/2"], ["+4"], ["5/11:2"]]],
] as const) {
  test(`stringToPattern parses ${JSON.stringify(input)}`, () =>
    assert.deepEqual(stringToPattern(input), expected));
}

for (const [input, expected] of [
  [2, { col: 2, row: 1 }],
  ["1/4", { col: "1/4", row: 1 }],
  ["2:3", { col: "2", row: "3" }],
  ["2/5:1/3", { col: "2/5", row: "1/3" }],
  ["_", { col: "_", row: 1 }],
  ["+", { col: 1, row: 1, gap: true }],
  ["+4", { col: 4, row: 1, gap: true }],
  ["+2:3", { col: "2", row: "3", gap: true }],
  ["+2/6:3/5", { col: "2/6", row: "3/5", gap: true }],
] as const) {
  test(`parseSpan preserves ${JSON.stringify(input)}`, () =>
    assert.deepEqual(parseSpan(input as UserSpanValue), expected));
}

test("flat and nested arrays parse identically for a single row", () => {
  assert.deepEqual(
    parseMultiRowPattern([2, "+2", "_", "2:3"]),
    parseMultiRowPattern([[2, "+2", "_", "2:3"]]),
  );
});

test("shorthand patterns expand into explicit spans", () => {
  assert.deepEqual(parseMultiRowPattern("1-3-6-10"), [
    [
      { col: "1/3", row: 1 },
      { col: "3/6", row: 1 },
      { col: "6/10", row: 1 },
    ],
  ]);
  assert.deepEqual(parseMultiRowPattern(["1-3-5", "1-2-5"]), [
    [
      { col: "1/3", row: 1 },
      { col: "3/5", row: 1 },
    ],
    [
      { col: "1/2", row: 1 },
      { col: "2/5", row: 1 },
    ],
  ]);
});

test("empty patterns fall back to one cell", () => {
  assert.deepEqual(parseMultiRowPattern([]), [[{ col: 1, row: 1 }]]);
  assert.deepEqual(getItemSpans(10, 1, [], false), { col: 1, row: 1 });
});

for (const [pattern, expected] of [
  [[1, 2, 1], 4],
  [[1, "+2", "_", 1], 4],
  [["1/3", "3/6"], 5],
  [["5/11"], 10],
  [[2, "5/11"], 10],
  [["1/-1", 2], 2],
] as [UserSpanPattern, number][]) {
  test(`column inference for ${JSON.stringify(pattern)} is ${expected}`, () => {
    assert.equal(inferColumnCount(parseMultiRowPattern(pattern)), expected);
  });
}

test("multi-row inference uses the widest row, not the sum of rows", () => {
  assert.equal(
    inferColumnCount(
      parseMultiRowPattern([
        [1, 2],
        [2, "+3", 1],
      ]),
    ),
    6,
  );
  assert.equal(
    calculatePatternColumns([
      { col: "_", row: 1 },
      { col: 3, row: 1 },
    ]),
    3,
  );
});

test("span conversion handles numeric, explicit, hidden and open-ended values", () => {
  assert.equal(getSpanLength(3), 3);
  assert.equal(getSpanLength("2/6"), 4);
  assert.equal(getSpanLength("_"), 0);
  assert.equal(getSpanLength("1/-1"), null);
  assert.equal(getSpanValue(3), "span 3");
  assert.equal(getSpanValue("2/6"), "2/6");
  assert.deepEqual(getSpanValues({ mobile: 2, tablet: 1, desktop: "_" }), {
    mobile: "span 2",
    tablet: "span 1",
  });
});

test("column shortcuts create one span per column and ignore invalid responsive counts", () => {
  assert.deepEqual(columnsToEqualSpanPattern(3), [1, 1, 1]);
  assert.deepEqual(
    columnsToEqualSpanPattern({ mobile: 1, tablet: 3, desktop: 0 }),
    { mobile: [1], tablet: [1, 1, 1] },
  );
});

test("mixed shorthand rows and single entries remain valid multi-row arrays", () => {
  assert.deepEqual(parseMultiRowPattern(["1-3-5", ["+2", 2]]), [
    [
      { col: "1/3", row: 1 },
      { col: "3/5", row: 1 },
    ],
    [
      { col: 2, row: 1, gap: true },
      { col: 2, row: 1 },
    ],
  ]);
});

test("resolving repeated explicit rows does not mutate the parsed pattern", () => {
  const pattern = parseMultiRowPattern(["2:1/3", "+2", "2:1/2"]);
  const original = JSON.stringify(pattern);
  getItemSpans(20, 6, pattern, "even");
  assert.equal(JSON.stringify(pattern), original);
});

test("negative row endpoints retain their anchored CSS value", () => {
  assert.equal(
    getItemSpans(5, 2, parseMultiRowPattern(["2:1/-1"]), false).row,
    "1/-1",
  );
});
