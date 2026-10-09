import assert from "node:assert/strict";
import test from "node:test";
import { grid } from "../src/grid";
import { masonry } from "../src/masonry";
import { stringToPattern } from "../src/helpers";

test("defaults generate a responsive one/two-column grid", () => {
  const generator = grid({});
  assert.deepEqual(generator.gridStyles.style, {
    "--g-gap": "12px",
    "--g-cols": 1,
    "--g-cols-sm": 2,
  });
  assert.equal(generator.getItemStyles({ index: 3 }).width.mobile, "100%");
  assert.equal(generator.getItemStyles({ index: 3 }).width.tablet, "50%");
});

test("columns is a count and pattern takes precedence", () => {
  assert.equal(grid({ columns: 3 }).gridStyles.style["--g-cols"], 3);
  assert.equal(
    grid({ pattern: [2], columns: 3 }).getItemStyles({ index: 0 }).width.mobile,
    "100%",
  );
});

test("implicit spans repeat with their expected widths and variables", () => {
  const generator = grid({ pattern: [1, 2, 1] });
  assert.deepEqual(
    Array.from(
      { length: 6 },
      (_, index) => generator.getItemStyles({ index }).width.mobile,
    ),
    ["25%", "50%", "25%", "25%", "50%", "25%"],
  );
  assert.deepEqual(generator.getItemStyles({ index: 1 }).style, {
    "--c-span": "span 2",
  });
  assert.equal(
    generator.getItemStyles({ index: 1 }).className.trim(),
    "col-[--c-span]",
  );
});

test("explicit lines and shorthand describe a nine-column grid", () => {
  const generator = grid({ pattern: "1-3-6-10" });
  assert.equal(generator.gridStyles.style["--g-cols"], 9);
  assert.equal(generator.getItemStyles({ index: 1 }).style["--c-span"], "3/6");
  assert.equal(
    generator.getItemStyles({ index: 1 }).width.mobile,
    "33.33333333333333%",
  );
});

test("implicit column and row spans are independent", () => {
  assert.deepEqual(
    grid({ pattern: ["2:3", "1:2"] }).getItemStyles({ index: 0 }).style,
    { "--r-span": "span 3", "--c-span": "span 2" },
  );
});

test("multi-row numeric patterns repeat without changing their row spans", () => {
  const generator = grid({
    pattern: [
      [2, 2],
      [1, 3],
    ],
  });
  assert.deepEqual(
    Array.from(
      { length: 8 },
      (_, index) => generator.getItemStyles({ index }).width.mobile,
    ),
    ["50%", "50%", "25%", "75%", "50%", "50%", "25%", "75%"],
  );
});

for (const [mirror, expected] of [
  [false, [1, 2, 3, 1, 2, 3]],
  ["even", [1, 2, 3, 3, 2, 1]],
  ["odd", [3, 2, 1, 1, 2, 3]],
] as const) {
  test(`mirror=${mirror} reverses the expected cycles`, () => {
    const generator = grid({ pattern: [1, 2, 3], mirror });
    assert.deepEqual(
      Array.from(
        { length: 6 },
        (_, index) => generator.getItemStyles({ index }).width.mobile,
      ),
      expected.map((span) => `${(span / 6) * 100}%`),
    );
  });
}

test("responsive spans reset larger column and row spans to one", () => {
  const generator = grid({ pattern: { mobile: ["2:3", 1], tablet: [1, 1] } });
  assert.deepEqual(generator.getItemStyles({ index: 0 }).style, {
    "--r-span": "span 3",
    "--r-span-sm": "span 1",
    "--c-span": "span 2",
    "--c-span-sm": "span 1",
  });
});

test("widths are recalculated when columns change even when a span is unchanged", () => {
  const styles = grid({
    pattern: { mobile: [2, 2], tablet: [2, 1, 1, 2] },
  }).getItemStyles({ index: 0 });
  assert.equal(styles.width.mobile, "50%");
  assert.equal(styles.width.tablet, `${(2 / 6) * 100}%`);
});

test("hidden spans restore display when the item becomes visible", () => {
  const styles = grid({
    pattern: { mobile: ["_", 1], tablet: [1, 1], desktop: ["_", 1] },
  }).getItemStyles({ index: 0 });
  assert.deepEqual(
    styles.className
      .trim()
      .split(/\s+/)
      .filter((value) => value.includes("hidden") || value.endsWith("block"))
      .sort(),
    ["hidden", "sm:block", "xl:hidden"].sort(),
  );
  assert.equal(styles.width.mobile, undefined);
  assert.equal(styles.width.tablet, "50%");
});

test("limits are applied to the declared breakpoint ranges and -1 disables a limit", () => {
  const generator = grid({
    columns: 2,
    limit: { mobile: 2, tablet: 3, desktop: -1 },
  });
  assert.equal(generator.getItemStyles({ index: 1 }).className.trim(), "");
  assert.equal(
    generator.getItemStyles({ index: 2 }).className.trim(),
    "max-sm:hidden",
  );
  assert.equal(
    generator.getItemStyles({ index: 3 }).className.trim(),
    "max-sm:hidden sm:max-md:hidden",
  );
});

test("inline, dense, gap and row-height options produce their exact container styles", () => {
  const styles = grid({
    columns: 2,
    inline: true,
    dense: true,
    gap: { mobile: "8px", desktop: "20px" },
    rowHeight: "100px",
  }).gridStyles;
  assert.ok(styles.className.startsWith("inline-grid "));
  assert.ok(styles.className.includes("xl:gap-[--g-gap-xl]"));
  assert.deepEqual(styles.style, {
    "--g-gap": "8px",
    "--g-gap-xl": "20px",
    "--row-h": "100px",
    "--g-cols": 2,
    gridAutoFlow: "dense",
  });
});

test("span filters receive content indices and can grow numeric and explicit spans", () => {
  const indices: number[] = [];
  const generator = grid({
    pattern: [1, "2/4"],
    filters: {
      spanValues: ({ itemIndex, spans, add }) => {
        indices.push(itemIndex);
        assert.equal(add("_", 2), "_");
        return { ...spans, col: { mobile: add(spans.col.mobile, 1) } };
      },
    },
  });
  assert.equal(
    generator.getItemStyles({ index: 0 }).style["--c-span"],
    "span 2",
  );
  assert.equal(generator.getItemStyles({ index: 1 }).style["--c-span"], "2/5");
  assert.deepEqual(indices, [0, 1]);
});

test("an entire explicitly positioned cycle repeats below its full footprint", () => {
  const generator = grid({
    pattern: stringToPattern("6:1/3 4:1/2, +4, 5/11:2"),
  });
  const layout = generator.getLayout(9);
  assert.equal(generator.gridStyles.style["--g-cols"], 10);
  assert.deepEqual(
    layout.map((slot) => slot.itemIndex),
    [0, 1, null, 2, 3, 4, null, 5, 6, 7, null, 8],
  );
  assert.deepEqual(
    layout.map((slot) => slot.style["--r-span"]),
    [
      "1/3",
      "1/2",
      "2/3",
      "3/5",
      "5/7",
      "5/6",
      "6/7",
      "7/9",
      "9/11",
      "9/10",
      "10/11",
      "11/13",
    ],
  );
  assert.equal(generator.getItemStyles({ index: 4 }).style["--r-span"], "5/6");
});

test("different explicit row lengths share a cycle offset rather than advancing individually", () => {
  const generator = grid({ pattern: ["2:1/4", "2:1/2"] });
  assert.equal(generator.getItemStyles({ index: 2 }).style["--r-span"], "4/7");
  assert.equal(generator.getItemStyles({ index: 3 }).style["--r-span"], "4/5");
  assert.equal(
    generator.getItemStyles({ index: 1999 }).style["--r-span"],
    "2998/2999",
  );
});

test("masonry columns, widths and limits retain their existing output", () => {
  const generator = masonry({
    columns: { mobile: 1, tablet: 3 },
    gap: "10px",
    limit: { mobile: 2 },
  });
  assert.deepEqual(generator.gridStyles.style, {
    "--cols": 1,
    "--cols-sm": 3,
    "--g-gap": "10px",
  });
  assert.deepEqual(generator.getItemStyles({ index: 2 }), {
    className: "max-sm:hidden",
    style: {},
    width: { mobile: "100%", tablet: "33.33333333333333%" },
  });
});

test("responsive mirroring works when the pattern is inherited", () => {
  const generator = grid({
    pattern: [1, 2],
    mirror: { mobile: false, tablet: "even" },
  });
  const styles = generator.getItemStyles({ index: 2 });
  assert.equal(styles.width.mobile, "33.33333333333333%");
  assert.equal(styles.width.tablet, "66.66666666666666%");
  assert.equal(styles.style["--c-span-sm"], "span 2");
});

test("negative column lines resolve widths relative to the inferred column count", () => {
  const generator = grid({ pattern: ["1/-1", 2] });
  assert.equal(generator.getItemStyles({ index: 0 }).width.mobile, "100%");
  assert.equal(generator.getItemStyles({ index: 0 }).style["--c-span"], "1/-1");
});

test("explicit patterns repeat independently at different breakpoints", () => {
  const generator = grid({
    pattern: {
      mobile: [1],
      tablet: stringToPattern("6:1/3 4:1/2, +4, 5/11:2"),
      desktop: ["2:1/4", "2:1/2"],
    },
  });
  const styles = generator.getItemStyles({ index: 4 });
  assert.equal(styles.style["--r-span-sm"], "5/6");
  assert.equal(styles.style["--r-span-xl"], "7/10");
  assert.equal(styles.width.mobile, "100%");
  assert.equal(styles.width.tablet, "40%");
  assert.equal(styles.width.desktop, "50%");
});

for (const dense of [false, true]) {
  test(`the reported pattern reserves its gap with dense=${dense}`, () => {
    const generator = grid({
      pattern: stringToPattern("6:1/3 4:1/2, +4, 5/11:2"),
      dense,
    });
    const layout = generator.getLayout(6);
    assert.deepEqual(
      layout.map((slot) => slot.style["--c-span"]),
      ["1/7", "7/11", "7/11", "5/11", "1/7", "7/11", "7/11", "5/11"],
    );
    assert.deepEqual(
      layout.map((slot) => slot.style["--r-span"]),
      ["1/3", "1/2", "2/3", "3/5", "5/7", "5/6", "6/7", "7/9"],
    );
  });
}

for (const [mirror, expectedCols, expectedRows] of [
  [
    "even",
    ["1/7", "7/11", "7/11", "5/11", "1/5", "5/11", "1/5", "5/11"],
    ["1/3", "1/2", "2/3", "3/5", "5/6", "5/7", "6/7", "7/9"],
  ],
  [
    "odd",
    ["1/5", "5/11", "1/5", "5/11", "1/7", "7/11", "7/11", "5/11"],
    ["1/2", "1/3", "2/3", "3/5", "5/7", "5/6", "6/7", "7/9"],
  ],
] as const) {
  test(`explicit cycle placement mirrors=${mirror} with its spacer`, () => {
    const layout = grid({
      pattern: stringToPattern("6:1/3 4:1/2, +4, 5/11:2"),
      mirror,
    }).getLayout(6);
    assert.deepEqual(
      layout.map((slot) => slot.style["--c-span"]),
      expectedCols,
    );
    assert.deepEqual(
      layout.map((slot) => slot.style["--r-span"]),
      expectedRows,
    );
  });
}
