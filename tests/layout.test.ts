import assert from "node:assert/strict";
import test from "node:test";
import { grid } from "../src/grid";
import type { UserSpanPattern } from "../src/types";

for (const [pattern, count, expected] of [
  [[1, 1], 3, [0, 1, 2]],
  [[1, "+2", 1], 4, [0, null, 1, 2, null, 3]],
  [["+2", 1], 2, [null, 0, null, 1]],
  [[1, "+2"], 2, [0, null, 1, null]],
  [["+", "+", 1, "+"], 2, [null, null, 0, null, null, null, 1, null]],
  [
    [
      ["+", 1],
      [2, "+"],
    ],
    4,
    [null, 0, 1, null, null, 2, 3, null],
  ],
  [["_", "+3", 2], 3, [0, null, 1, 2, null]],
] as [UserSpanPattern, number, (number | null)[]][]) {
  test(`layout order for ${JSON.stringify(pattern)} with ${count} children`, () => {
    assert.deepEqual(
      grid({ pattern })
        .getLayout(count)
        .map((slot) => slot.itemIndex),
      expected,
    );
  });
}

test("gap spans and explicit row spans generate actual CSS dimensions", () => {
  const gap = grid({ pattern: [1, "+2/5:2/4", 1] }).getLayout(2)[1];
  assert.equal(gap.itemIndex, null);
  assert.equal(gap.style["--c-span"], "2/5");
  assert.equal(gap.style["--r-span"], "2/4");
});

test("mirroring preserves consecutive and trailing gaps across cycle boundaries", () => {
  assert.deepEqual(
    grid({ pattern: [1, "+", "+"], mirror: "even" })
      .getLayout(2)
      .map((slot) => slot.itemIndex),
    [0, null, null, null, null, 1],
  );
  assert.deepEqual(
    grid({ pattern: [1, "+", "+"], mirror: "odd" })
      .getLayout(2)
      .map((slot) => slot.itemIndex),
    [null, null, 0, 1, null, null],
  );
});

test("responsive spacers are merged without duplicating or dropping content", () => {
  const generator = grid({
    pattern: { mobile: [1, 1], tablet: ["+2", 1, "+", 2], desktop: [1] },
  });
  const layout = generator.getLayout(8);
  assert.deepEqual(
    layout
      .filter((slot) => slot.itemIndex !== null)
      .map((slot) => slot.itemIndex),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  for (const { itemIndex, ...styles } of layout.filter(
    (slot) => slot.itemIndex !== null,
  )) {
    assert.deepEqual(styles, generator.getItemStyles({ index: itemIndex }));
  }
  for (const gap of layout.filter((slot) => slot.itemIndex === null)) {
    assert.ok(gap.className.includes("hidden"));
    assert.ok(gap.className.includes("sm:block"));
    assert.ok(gap.className.includes("xl:hidden"));
  }
});

test("responsive gap spans reset both dimensions after a larger span", () => {
  const gap = grid({
    pattern: { mobile: [1, "+2:3", 1], tablet: [1, "+1", 1] },
  }).getLayout(2)[1];
  assert.deepEqual(gap.style, {
    "--r-span": "span 3",
    "--r-span-sm": "span 1",
    "--c-span": "span 2",
    "--c-span-sm": "span 1",
  });
  assert.equal(gap.width.mobile, "50%");
  assert.equal(gap.width.tablet, "33.33333333333333%");
});

test("filters run once per content child and never run for spacers", () => {
  const indices: number[] = [];
  grid({
    pattern: ["+2", 1, "+"],
    filters: {
      spanValues: ({ itemIndex, spans }) => {
        indices.push(itemIndex);
        return spans;
      },
    },
  }).getLayout(4);
  assert.deepEqual(indices, [0, 1, 2, 3]);
});

test("limits count children rather than generated DOM slots", () => {
  const layout = grid({ pattern: ["+2", 1], limit: { mobile: 2 } }).getLayout(
    3,
  );
  assert.ok(!layout[3].className.includes("max-sm:hidden"));
  assert.ok(layout[4].className.includes("max-sm:hidden"));
  assert.ok(layout[5].className.includes("max-sm:hidden"));
});

test("empty lists and incomplete cycles do not create a new cycle of gaps", () => {
  assert.deepEqual(grid({ pattern: ["+2", 1] }).getLayout(0), []);
  assert.deepEqual(
    grid({ pattern: [1, 1, "+2"] })
      .getLayout(1)
      .map((slot) => slot.itemIndex),
    [0],
  );
  assert.deepEqual(
    grid({ pattern: [1, 1, "+2"] })
      .getLayout(2)
      .map((slot) => slot.itemIndex),
    [0, 1, null],
  );
});

test("all-gap patterns and invalid item counts fail immediately", () => {
  for (const pattern of [
    ["+"],
    ["+2", "+2:3"],
    [["+"], ["+2"]],
  ] as UserSpanPattern[]) {
    assert.throws(() => grid({ pattern }), /content span/);
  }
  for (const count of [-1, 0.5, NaN, Infinity]) {
    assert.throws(
      () => grid({ columns: 2 }).getLayout(count),
      /non-negative integer/,
    );
  }
});

test("many cycles preserve each content child exactly once, with and without mirroring", () => {
  for (const mirror of [false, "even", "odd"] as const) {
    for (const pattern of [
      [1, "+2", 2],
      ["+", 1, "+3", "_"],
      [
        [2, "+"],
        [1, "+2", 2],
      ],
    ] as UserSpanPattern[]) {
      for (const count of [1, 2, 3, 7, 31]) {
        const layout = grid({ pattern, mirror }).getLayout(count);
        assert.deepEqual(
          layout
            .filter((slot) => slot.itemIndex !== null)
            .map((slot) => slot.itemIndex),
          Array.from({ length: count }, (_, i) => i),
        );
        assert.ok(
          layout.every(
            (slot) =>
              !Object.values(slot.style).some((value) =>
                String(value).includes("NaN"),
              ),
          ),
        );
      }
    }
  }
});
