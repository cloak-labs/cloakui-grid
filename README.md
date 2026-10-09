## @cloakui/grid

A framework‑agnostic, type-safe utility for generating **responsive CSS Grid and masonry layouts** from a simple "pattern" syntax. Particularly useful for websites pulling content from a headless CMS or if your app provides a no-code editor/layout builder.

You provide a **pattern** and responsive options; it returns **container styles** and a **per‑item style generator** you can plug into any UI framework.

### Installation

```bash
npm install @cloakui/grid
```

**Note**: This library currently depends on the usage of TailwindCSS, and you must point your Tailwind config to the `@cloakui/grid` package's `dist` directory to include it as a source for your build.

```js
// For Tailwind 3.x and below, add the following to your Tailwind config's `content` array:
module.exports = {
  content: [
    "./node_modules/@cloakui/grid/dist/**/*.js",
  ],
};

// For Tailwind 4.x and above, add the following to your stylesheet:
@source "../node_modules/@cloakui/grid/dist/**/*.js";
```

Also note that using this library will likely result in a small amount of unused CSS being added to your bundle. You can tell Tailwind to exclude specific classes that you know you won't use if you feel it's worth it.

### Core concepts

- **grid(options)**: Generates styles for a CSS grid container plus a `getItemStyles({ index })` helper for each grid item.
- **masonry(options)**: Generates styles for a CSS multi‑column (“masonry”) layout plus a `getItemStyles({ index })` helper for each masonry item.
- **Patterns**: A simple array syntax that describes how many columns/rows each item spans, enabling complex & creative grid layouts with ease.
- **Responsive**: Most options accept either a **single value** or a **per‑breakpoint object** (powered by `@cloakui/responsive`).

### Basic grid usage

For equal-column grids, prefer the `columns` shortcut (a column _count_, not a span):

```ts
import grid from "@cloakui/grid";

// 2 equal columns — equivalent to pattern: [1, 1]
const equal = grid({
  columns: { mobile: 1, tablet: 2 },
  gap: "16px",
});
```

> **Gotcha:** `pattern: [2]` means one item spanning 2 columns — not “2 columns”. Use `columns: 2` or `pattern: [1, 1]` for a 2-column layout.

For varied item sizes, use `pattern` (per-item column _spans_):

```ts
import grid from "@cloakui/grid";

const { gridStyles, getItemStyles } = grid({
  // Implicit span pattern: [1, 2, 1] = item1 spans 1 col, item2 spans 2 cols, item3 spans 1 col, then repeat for additional rows
  pattern: [1, 2, 1], // the number of grid columns is inferred (4 in this case)
  gap: "16px",
  rowHeight: "260px", // leave empty for "auto"
});

// You apply these class names and inline styles to your grid container :
const { className: gridClassName, style: gridStyle } = gridStyles;

// Grid items are styled using the `getItemStyles` helper:
items.map((item, index) => {
  const { className, style } = getItemStyles({ index });
  return (
    <div key={item.id} className={className} style={style}>
      {item.content}
    </div>
  );
});
```

The library does **not** render any DOM; it just gives you responsive TailwindCSS class names and CSS variables. The exact classes/variables assume the Tailwind‑style configuration provided by `@cloakui/responsive`.

### Responsive patterns & gaps

Most options can be:

- a **single value** (applies to all breakpoints), or
- a **breakpoint map**, e.g. `{ mobile: 1, tablet: 2, desktop: 4 }`.

```ts
import grid from "@cloakui/grid";

const gridGen = grid({
  pattern: {
    mobile: [1], // single column on mobile
    tablet: [1, 1], // 2 equal columns on tablet
    desktop: [2, 1, 1], // feature card + 2 standard cards on desktop
  },
  gap: {
    mobile: "8px",
    tablet: "12px",
    desktop: "16px",
  },
  rowHeight: {
    mobile: "240px",
    tablet: "260px",
    desktop: "280px",
  },
});
```

### Explicit spans, shorthand & multi‑row patterns

Your grid "pattern" can define spans in various ways:

- **Implicit**: numbers (`1`, `2`, `3`) → `span 1`, `span 2`, etc.
- **Explicit**: `"1/3"` → `grid-column: 1 / 3`
- **col:row syntax**: `"2:1"` → `span 2 cols` & `span 1 row`
- **Hidden**: `"_"` → hide the item at certain breakpoints
- **Shorthand explicit**: a shorter way of writing explicit patterns: `"1-3-6"` → `["1/3", "3/6"]`
- **Multi‑row**: nested arrays (pattern per row): `[[2, 2], [1, 3]]` → first row has two equal items, each spanning 2 cols; second row has one item spanning 1 col, and another item spanning 3 cols; repeats for additional rows.

```ts
const gridGen = grid({
  // Multi‑row pattern:
  // row 1: item1 spans 2 cols, item2 spans 2 cols
  // row 2: item3 spans 1 col, item4 spans 3 cols
  pattern: [
    [2, 2],
    [1, 3],
  ],
});

const explicitPattern = grid({
  // Shorthand explicit syntax:
  // "1-3-6-10" => ["1/3", "3/6", "6/10"]
  pattern: "1-3-6-10",
});

const mixedPattern = grid({
  pattern: [
    "2:1", // col:row (span 2 columns, 1 row)
    "_", // the item that matches this value will be hidden (useful when you want a grid to "shrink" on smaller screens)
    "1/3", // explicit
  ],
});
```

### Repeating patterns with explicit rows

Patterns containing explicit row lines (such as `"6:1/3"`) are placed as a
complete cycle. The generator resolves column and row positions for every
visible entry, including implicit items and spacers, then moves the next cycle
below the full height of the previous one. Short items therefore cannot start
the next cycle inside the space below an earlier short item. Mirrored cycles
are resolved separately, preserving the full height of each orientation.
Patterns without explicit rows retain normal CSS auto-placement.

For example:

```ts
grid({ pattern: stringToPattern("6:1/3 4:1/2, +4, 5/11:2") });
```

This creates ten columns and a four-row cycle: a six-column item at rows 1–2,
a four-column item at row 1, a four-column spacer underneath it at row 2, and
a six-column item aligned right at rows 3–4. The next cycle starts at row 5.
Explicit column lines are measured from line 1: `"5/11"` requires ten columns,
even though its occupied span is only six columns wide.

Negative/open-ended row lines are passed through to CSS without a cycle
offset because they do not describe a finite row height.

### Empty grid cells

Prefix a span with `"+"` to insert an empty cell without consuming a content
item. Unlike `"_"` (which hides the child at that position), a `"+"` entry adds
a spacer using the supplied span, with the same CSS generation as content:

- `"+2"`: two columns, one row.
- `"+1/3"`: explicit column lines 1 through 3.
- `"+2:3"`: two columns, three rows.
- `"+1/3:2/4"`: explicit column and row lines.
- Bare `"+"`: shorthand for `"+1"`.

These entries work in responsive and multi-row patterns, including patterns
parsed by `stringToPattern`. For example, `[1, "+2", 1]` reserves a two-column
gap between content items.

The utility generates a layout; your renderer creates the empty elements.
`getLayout(itemCount)` returns content and spacers in DOM order, with
`itemIndex: null` for spacers. Each entry includes `className`, `style`, and
`width`. Render all entries, including spacers hidden at some breakpoints, so
the same DOM works at every screen size.

```tsx
const { gridStyles, getLayout } = grid({
  pattern: { mobile: [1], tablet: [1, "+2", 2] },
});

return (
  <div {...gridStyles}>
    {getLayout(items.length).map(
      ({ itemIndex, className, style }, slotIndex) =>
        itemIndex === null ? (
          <div
            key={`gap-${slotIndex}`}
            aria-hidden="true"
            className={className}
            style={style}
          />
        ) : (
          <div key={items[itemIndex].id} className={className} style={style}>
            {items[itemIndex].content}
          </div>
        ),
    )}
  </div>
);
```

The shared kit `Grid` renders these empty divs automatically:

```tsx
<Grid type="grid" pattern={{ mobile: [1], tablet: [1, "+2", 2] }}>
  <Card />
  <Card />
</Grid>
```

Patterns repeat and mirror with their spacers. Trailing spacers finish the
current cycle after the last child; leading spacers from a new cycle are not
appended. Empty lists render no spacers. A pattern consisting entirely of
spacer entries throws an error because it cannot place any content.

`getItemStyles({ index })`, span filters, and limits use content indices, excluding
spacers. Use `getLayout` to render gaps; `getItemStyles` alone only supplies
styles for the content. Span filters do not run for spacers.

### Mirroring & dense grids

```ts
const gridGen = grid({
  pattern: [2, 1, 3],
  mirror: "even", // mirrors/flips the pattern on even rows (i.e. the above pattern would become [3, 1, 2] on the 2nd row, flipping back and forth)
  dense: true, // enable CSS grid-auto-flow: dense
});
```

### Limiting visible items

`limit` controls how many items are visible per breakpoint. Hidden items get responsive “hidden” classes.

```ts
const gridGen = grid({
  pattern: [1, 1, 1],
  limit: {
    mobile: 3, // only show 3 items on mobile
    tablet: 6,
    desktop: -1, // -1 = no limit
  },
});

// Items beyond the limit receive appropriate "hidden" classes per breakpoint.
```

### Custom span filters

You can adjust per‑item spans at runtime using `filters.spanValues`.  
This is useful for injecting hero items, promos, or editorial layouts based on index.

```ts
import type { SpanValues } from "@cloakui/grid";
import grid, { type SpanValueFilterProps } from "@cloakui/grid";

const gridGen = grid({
  pattern: [1, 1, 1, 1],
  filters: {
    spanValues: ({
      itemIndex,
      spans,
      add,
    }: SpanValueFilterProps): SpanValues => {
      // Make the first item span 2 columns on desktop
      if (itemIndex === 0) {
        return {
          col: {
            ...spans.col,
            desktop: add(spans.col.desktop ?? 1, 1),
          },
          row: spans.row,
        };
      }

      return spans;
    },
  },
});
```

### The `width` property

`getItemStyles({ index })` returns a `width` object that maps breakpoints to **percentage widths of the grid container**.

This is especially useful for generating **responsive `<img>` `sizes` attributes** for images in your grid.

```ts
import grid from "@cloakui/grid";
import { fillMissingBreakpoints } from "@cloakui/responsive";
import { getImageSizesFromBreakpointWidths } from "@cloakui/responsive/getImageSizesFromBreakpointWidths";

function CardGrid({
  items,
  containerWidth = "full",
  pattern = {
    mobile: [1],
    tablet: [1, 1],
    desktop: [1, 1, 1],
  },
  gap = "16px",
}) {
  const { gridStyles, getItemStyles } = grid({ pattern, gap });
  const maxWidth = {
    full: "100%",
    lg: "1216px",
    sm: "896px",
  }[containerWidth];

  return (
    <div
      className={gridStyles.className}
      style={{
        ...gridStyles.style,
        maxWidth,
      }}
    >
      {items.map((item, index) => {
        const { className, style, width } = getItemStyles({ index });

        // `width` is a breakpoint map, e.g. { mobile: "100%", tablet: "50%", desktop: "33.3333%" }
        // Convert that to a `sizes` string based on the block's container width:
        const sizes = getImageSizesFromBreakpointWidths(
          fillMissingBreakpoints(width, 100),
          {
            filter: (itemWidth, { breakpoint }) => {
              // Example: convert percentage-of-container → viewport-based `sizes` values.
              if (maxWidth === "100%") return `${itemWidth}vw`;
              return `calc(min(${maxWidth}, 100vw) * (${itemWidth} / 100))`;
            },
          }
        );

        return (
          <article key={item.id} className={className} style={style}>
            <img
              src={item.image.src}
              srcSet={item.image.srcSet}
              sizes={sizes}
              alt={item.image.alt}
            />
          </article>
        );
      })}
    </div>
  );
}
```

This pattern lets you keep **layout logic** inside `@cloakui/grid` while deriving **correct image sizing** purely from each item's percentage width.

### Masonry layouts

`masonry` uses CSS `column-count` to create Pinterest‑style masonry grids, with responsive column counts and gap.

```ts
import { masonry } from "@cloakui/grid";

const { gridStyles, getItemStyles } = masonry({
  columns: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
  gap: "16px",
  limit: {
    // optionally hide items beyond the limit
    mobile: 4,
    tablet: 8,
    desktop: -1,
  },
});

const { className: containerClassName, style: containerStyle } = gridStyles;

items.map((item, index) => {
  const { className, style } = getItemStyles({ index });
  return (
    <div key={item.id} className={className} style={style}>
      {item.content}
    </div>
  );
});
```

Note that CSS columns render items vertically, whereas grids render items horizontally. If you'd prefer that the masonry visual order matches the logical “grid” order, you can reorder items using `orderItemsForMasonryColumns` from `@cloakui/grid`.

```ts
import { orderItemsForMasonryColumns } from "@cloakui/grid";

const orderedItems = orderItemsForMasonryColumns(items, /* columnCount */ 3);
```

### Helpers

```ts
import {
  asBreakpointObject,
  stringToPattern,
  orderItemsForMasonryColumns,
  type UserSpanPattern, // and many other internal types are exported for your convenience
} from "@cloakui/grid";

// The string syntax for patterns can be especially helpful when using a headless CMS or no-code editor/layout builder (simply expose a text input to your users to define their grid patterns)
const pattern: UserSpanPattern = stringToPattern("1 2 1, 2 1 1");
const breakpointsObj = asBreakpointObject(pattern);
```

### Tests

Run the package's unit suite with `pnpm --filter @cloakui/grid test:unit` from
the workspace root (or `pnpm test:unit` inside this package). The tests bundle
the current TypeScript source and use Node's built-in test runner; they need no
React app, browser, or WordPress backend.

The suite covers parsing, shorthand and multi-row patterns, column inference,
generated CSS variables and classes, widths, responsive resets, hidden spans,
limits, filters, mirroring, spacers, and complete-cycle explicit row placement.
Use `pnpm --filter @cloakui/grid typecheck:tests` to check test types.

React rendering and actual browser geometry are covered separately by
`pnpm --filter kit test:grid` in the shared kit.
