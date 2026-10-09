import {
  breakpoints,
  responsiveClassNameBuilder,
  type BreakpointOptions,
  type OptionalBreakpointOptions,
} from "@cloakui/responsive";

import type {
  SpanPattern,
  SpanValue,
  ParsedSpan,
  ParsedPattern,
  ParsedMultiRowPattern,
  ShorthandExplicitSpanValue,
  SpanPatternMirror,
  MultiRowSpanPattern,
  UserSpanValue,
  UserSpanPattern,
  ImplicitSpanValue,
  ExplicitSpanValue,
  NonHiddenSpanValue,
  ColRowSpanValue,
} from "./types";
import { getCyclePlacement } from "./placement";

/**
 * Convert a column count into an equal-span pattern.
 * e.g. `2` → `[1, 1]`, `{ mobile: 1, tablet: 2 }` → `{ mobile: [1], tablet: [1, 1] }`.
 *
 * Patterns describe per-item *spans*, so a column count of 2 must become two
 * span-1 entries — never `[2]` (which means one item spanning 2 columns).
 */
export function columnsToEqualSpanPattern(
  columns: OptionalBreakpointOptions<number>,
): OptionalBreakpointOptions<ImplicitSpanValue[]> {
  const toPattern = (cols: number): ImplicitSpanValue[] =>
    Array.from({ length: Math.max(1, cols) }, () => 1);

  if (typeof columns === "number") {
    return toPattern(columns);
  }

  if (!isObject(columns)) {
    return toPattern(1);
  }

  return Object.entries(columns).reduce(
    (acc, [breakpoint, cols]) => {
      if (typeof cols !== "number" || !Number.isFinite(cols) || cols < 1) {
        return acc;
      }
      acc[breakpoint] = toPattern(cols);
      return acc;
    },
    {} as BreakpointOptions<ImplicitSpanValue[]>,
  );
}

/**
 * Converts a string pattern to the standard array format
 * @param pattern - The pattern string to convert
 * @returns The pattern in array format
 */
export function stringToPattern(pattern: string): UserSpanPattern {
  const convertSinglePattern = (pattern: string): UserSpanValue[] =>
    pattern
      .trim()
      .split(/\s+/)
      .map((item) => {
        // Convert numeric strings to numbers
        return /^\d+$/.test(item)
          ? (parseInt(item, 10) as ImplicitSpanValue)
          : (item as UserSpanValue);
      });

  // Check if it's a multi-row pattern (contains commas)
  if (pattern.includes(",")) {
    return pattern
      .split(",")
      .map((rowPattern) => convertSinglePattern(rowPattern));
  }

  // Single row pattern
  return convertSinglePattern(pattern);
}

/**
 * Helper to get the length of an implicit or explicit span value.
 * @param span - The span value to get the length of
 * @returns The length of the span
 */
export function getSpanLength(span: SpanValue): number | null {
  if (typeof span === "number") return span;
  if (span == "_") return 0;
  if (!span.includes("/")) return parseInt(span, 10);

  let [start, end] = span.split("/").map(Number);
  if (end === -1) return null; // sorry, can't handle this
  return end - start;
}

/**
 * Helper to get the grid-row or grid-column CSS value for both implicit and/or explicit spans (abstracting the need to handle the different syntaxes).
 * @param span - The span value to get the CSS value for
 * @returns The CSS value for the span
 */
export function getSpanValue(span: SpanValue): string {
  if (typeof span === "number") return `span ${span}`;
  if (!span.includes("/")) return `span ${span}`;
  return span;
}

/**
 * A wrapper around getSpanValue, but receives a breakpoint object of span values that will be converted to valid CSS values.
 */
export function getSpanValues(spanByBreakpoint: BreakpointOptions<SpanValue>) {
  return Object.fromEntries(
    Object.entries(spanByBreakpoint)
      // A later span of 1 must reset a larger span inherited from below.
      .filter(([bp, span]) => span !== "_" && (span !== 1 || bp !== "mobile"))
      .map(([bp, span]) => [bp, getSpanValue(span)]),
  );
}

/**
 * When using explicit spans for a multi-row pattern, we need to adjust the start/end span values for rows 2 and beyond.
 * @param explicitSpan - The explicit span value to adjust
 * @param previousRowEnd - The end number of the previous row
 * @returns The adjusted explicit span value
 */
export function adjustExplicitSpansForNextRow({
  explicitSpan,
  previousRowEnd,
}: {
  explicitSpan: ParsedSpan;
  previousRowEnd: number;
}): ParsedSpan {
  const result: ParsedSpan = { ...explicitSpan };

  // Adjust row span if it's explicit
  if (isExplicitSpan(explicitSpan.row)) {
    const [start, end] = explicitSpan.row.split("/").map(Number);
    const spanLength = end - start;

    const adjustedStart = start + previousRowEnd - 1;
    const adjustedEnd = adjustedStart + spanLength;

    result.row = `${adjustedStart}/${adjustedEnd}`;
  }

  return result;
}

/**
 * When repeating a pattern cycle that uses explicit row spans (eg. "1/5" or "3/7"),
 * we want the next cycle's item to start where its corresponding previous-cycle item ended.
 *
 * Example:
 * - Item 1: "1/5" → Item 3 should start at 5
 * - Item 2: "3/7" → Item 4 should start at 7
 *
 * This intentionally offsets each item independently; if the pattern becomes "invalid"
 * (eg. later items end up overlapping strangely), that's considered user-controlled.
 */
export function adjustExplicitRowSpanForRepeat({
  explicitRowSpan,
  previousRowEnd,
}: {
  explicitRowSpan: ExplicitSpanValue;
  previousRowEnd: number;
}): ExplicitSpanValue {
  const [start, end] = explicitRowSpan.split("/").map(Number);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end === -1) {
    return explicitRowSpan;
  }

  const offset = previousRowEnd - start;
  const adjustedStart = start + offset;
  const adjustedEnd = end + offset;

  return `${adjustedStart}/${adjustedEnd}` as ExplicitSpanValue;
}

/**
 * Checks if a span pattern is in shorthand explicit syntax.
 * @param span - The span pattern to check
 * @returns True if the span pattern is in shorthand explicit syntax, false otherwise
 */
export function isShorthandExplicitSyntax(
  span: SpanPattern,
): span is ShorthandExplicitSpanValue {
  return (
    typeof span === "string" &&
    !span.includes("/") &&
    !span.includes(":") &&
    span.includes("-") &&
    !span.startsWith("-")
  );
}

/**
 * Checks if a span value is in explicit syntax.
 * @param span - The span value to check
 * @returns True if the span value is in explicit syntax, false otherwise
 */
export function isExplicitSpan(span: SpanValue): span is ExplicitSpanValue {
  return typeof span === "string" && span.includes("/");
}

/**
 * Converts shorthand explicit span patterns (eg. "1-3-6") to an array of explicit span values (eg. ["1/3", "3/6"])
 * @param pattern - Any pattern value, shorthand or otherwise
 * @returns The converted span pattern in explicit syntax, if it was in shorthand syntax, otherwise the original pattern value
 */
export function maybeResolveShorthandSyntax(
  pattern: SpanPattern,
): UserSpanValue[] {
  if (isShorthandExplicitSyntax(pattern)) {
    const positions = pattern.split("-").map(Number);
    const expandedSpans: UserSpanValue[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      expandedSpans.push(`${positions[i]}/${positions[i + 1]}`);
    }
    return expandedSpans;
  }

  return pattern;
}

/**
 * Parse a single span value into column and row components
 * @param span - The span value to parse
 * @returns The parsed span with col and row components
 */
export function parseSpan(span: UserSpanValue): ParsedSpan {
  if (typeof span === "string" && span.startsWith("+")) {
    const value = span.slice(1) || "1";
    const parsed = parseSpan(
      /^-?\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : (value as NonHiddenSpanValue | ColRowSpanValue),
    );
    return { ...parsed, gap: true };
  }

  // Handle "_" as a special case - it means the item is hidden
  // "_" can only be used standalone, not in col:row syntax
  if (span === "_") {
    return { col: "_", row: 1 };
  }

  // Handle number input
  if (typeof span === "number") {
    return { col: span, row: 1 };
  }

  // Handle col:row syntax
  if (span.includes(":")) {
    const [col, row] = span.split(":") as [SpanValue, SpanValue];
    return { col, row };
  }

  // Default case: just a column span
  return { col: span as SpanValue, row: 1 };
}

/**
 * Parse a pattern string or array into a multi-row pattern
 * @param pattern - The pattern to parse
 * @returns The parsed multi-row pattern
 */
export function parseMultiRowPattern(
  pattern: SpanPattern | MultiRowSpanPattern,
): ParsedMultiRowPattern {
  if (isShorthandExplicitSyntax(pattern as SpanPattern)) {
    return [maybeResolveShorthandSyntax(pattern as SpanPattern).map(parseSpan)];
  }
  // Handle array input
  if (Array.isArray(pattern) && pattern.length > 0) {
    const hasNestedArray = pattern.some(
      (item) =>
        Array.isArray(item) || isShorthandExplicitSyntax(item as SpanPattern),
    );
    if (hasNestedArray) {
      // It's already a multi-dimensional array, parse each item
      return pattern.map((spanOrRowPattern) => {
        if (Array.isArray(spanOrRowPattern)) {
          return maybeResolveShorthandSyntax(spanOrRowPattern).map((span) =>
            parseSpan(span),
          );
        }

        if (isShorthandExplicitSyntax(spanOrRowPattern)) {
          return maybeResolveShorthandSyntax(spanOrRowPattern).map((span) =>
            parseSpan(span),
          );
        }

        return [parseSpan(spanOrRowPattern as UserSpanValue)];
      }) as ParsedMultiRowPattern;
    }

    const parsedPattern = pattern.map((spanOrRowPattern) =>
      parseSpan(spanOrRowPattern as SpanValue),
    ) as ParsedPattern;

    return [parsedPattern]; // Return a non-multi-row pattern as a multi-row pattern with a single row, enabling everything else to simply rely on the multi-row pattern type
  }

  // Default fallback for unexpected input
  return [[{ col: 1, row: 1 }]];
}

/**
 * Calculate the total column span for a row pattern
 * @param rowPattern - The row pattern to calculate for
 * @returns The total column span
 */
export function calculatePatternColumns(rowPattern: ParsedPattern): number {
  let explicitColumns = 1;
  let implicitColumns = 0;
  for (const { col } of rowPattern) {
    if (isExplicitSpan(col)) {
      const [start, end] = col.split("/").map(Number);
      // Lines are anchored at 1, so end line 11 requires 10 columns,
      // even when the first occupied line is 5. Negative lines cannot infer size.
      explicitColumns = Math.max(
        explicitColumns,
        start > 0 ? start - 1 : 1,
        end > 0 ? end - 1 : 1,
      );
    } else {
      implicitColumns += getSpanLength(col) ?? 1;
    }
  }
  return Math.max(explicitColumns, implicitColumns);
}

/**
 * Infer the total number of columns needed for a multi-row pattern
 * @param multiRowPattern - The multi-row pattern to infer columns for
 * @returns The inferred column count
 */
export function inferColumnCount(
  multiRowPattern: ParsedMultiRowPattern,
): number {
  return Math.max(
    ...multiRowPattern.map((rowPattern) => calculatePatternColumns(rowPattern)),
  );
}

/**
 * Removes breakpoints that have the same value as the previous breakpoint, that have the special value "inherit", or that are undefined.
 * Additionally, when isSpanValue is true, removes the smallest breakpoint if its value is 1.
 * @param breakpoints - The breakpoints to remove redundant breakpoints from
 * @returns The breakpoints with redundant breakpoints removed
 */
export function removeRedundantBreakpoints<T>(
  options: BreakpointOptions<T>,
  isSpanValue?: boolean,
): BreakpointOptions<T> {
  const providedBreakpoints = Object.keys(options).length;
  if (providedBreakpoints === 1) return options; // If there's only one breakpoint already, there's nothing to remove

  return breakpoints.reduce((acc, bp, i) => {
    // Get value for current breakpoint
    const currentValue = options[bp];

    if (
      currentValue === undefined ||
      currentValue === "inherit" ||
      currentValue === ""
    )
      return acc;

    // Remove the smallest breakpoint if its value is 1 and isSpanValue is true
    if (isSpanValue && i === 0 && currentValue === 1) {
      return acc;
    }

    // Get previous breakpoint's value
    const prevBreakpoint = breakpoints[i - 1];
    const prevValue = prevBreakpoint ? options[prevBreakpoint] : undefined;

    // Only include if value differs from previous breakpoint
    if (prevValue !== currentValue) {
      acc[bp] = currentValue;
    }

    return acc;
  }, {} as BreakpointOptions<T>);
}

/**
 * Receives an OptionalBreakpointOption value, and if it isn't a breakpoint object, converts it to a breakpoint object with a single `mobile` key containing the value.
 * @param option - The option to resolve
 * @returns The resolved breakpoint options object
 */
export function asBreakpointObject<T>(
  option: OptionalBreakpointOptions<T>,
  removeRedundancies: boolean = true,
): BreakpointOptions<T> {
  return isObject(option)
    ? removeRedundancies
      ? removeRedundantBreakpoints(option)
      : option
    : { mobile: option };
}

export function isObject(item: unknown): item is Record<string, unknown> {
  return (
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    !(item instanceof Function)
  );
}

export function isEmptyObject(obj: any): boolean {
  return isObject(obj) && Object.keys(obj).length === 0;
}

const tailwindClassMap = {
  rowHeight: {
    mobile: "auto-rows-[--row-h]",
    tablet: "sm:auto-rows-[--row-h-sm]",
    tabletWide: "md:auto-rows-[--row-h-md]",
    laptop: "lg:auto-rows-[--row-h-lg]",
    desktop: "xl:auto-rows-[--row-h-xl]",
    desktopWide: "2xl:auto-rows-[--row-h-2xl]",
  },
  rowSpan: {
    mobile: "row-[--r-span]",
    tablet: "sm:row-[--r-span-sm]",
    tabletWide: "md:row-[--r-span-md]",
    laptop: "lg:row-[--r-span-lg]",
    desktop: "xl:row-[--r-span-xl]",
    desktopWide: "2xl:row-[--r-span-2xl]",
  },
  colSpan: {
    mobile: "col-[--c-span]",
    tablet: "sm:col-[--c-span-sm]",
    tabletWide: "md:col-[--c-span-md]",
    laptop: "lg:col-[--c-span-lg]",
    desktop: "xl:col-[--c-span-xl]",
    desktopWide: "2xl:col-[--c-span-2xl]",
  },
  gridCols: {
    mobile: "grid-cols-[repeat(var(--g-cols),minmax(0,1fr))]",
    tablet: "sm:grid-cols-[repeat(var(--g-cols-sm),minmax(0,1fr))]",
    tabletWide: "md:grid-cols-[repeat(var(--g-cols-md),minmax(0,1fr))]",
    laptop: "lg:grid-cols-[repeat(var(--g-cols-lg),minmax(0,1fr))]",
    desktop: "xl:grid-cols-[repeat(var(--g-cols-xl),minmax(0,1fr))]",
    desktopWide: "2xl:grid-cols-[repeat(var(--g-cols-2xl),minmax(0,1fr))]",
  },
  gap: {
    mobile: "gap-[--g-gap]",
    tablet: "sm:gap-[--g-gap-sm]",
    tabletWide: "md:gap-[--g-gap-md]",
    laptop: "lg:gap-[--g-gap-lg]",
    desktop: "xl:gap-[--g-gap-xl]",
    desktopWide: "2xl:gap-[--g-gap-2xl]",
  },
  spaceY: {
    mobile: "space-y-[--g-gap]",
    tablet: "sm:space-y-[--g-gap-sm]",
    tabletWide: "md:space-y-[--g-gap-md]",
    laptop: "lg:space-y-[--g-gap-lg]",
    desktop: "xl:space-y-[--g-gap-xl]",
    desktopWide: "2xl:space-y-[--g-gap-2xl]",
  },
  columns: {
    mobile: "columns-[--cols]",
    tablet: "sm:columns-[--cols-sm]",
    tabletWide: "md:columns-[--cols-md]",
    laptop: "lg:columns-[--cols-lg]",
    desktop: "xl:columns-[--cols-xl]",
    desktopWide: "2xl:columns-[--cols-2xl]",
  },
  hidden: {
    mobile: "max-sm:hidden",
    tablet: "sm:max-md:hidden",
    tabletWide: "md:max-lg:hidden",
    laptop: "lg:max-xl:hidden",
    desktop: "xl:max-2xl:hidden",
    desktopWide: "2xl:hidden",
  },
  // Classes to show items (override hidden) - hide at breakpoint and above
  hiddenFrom: {
    mobile: "hidden",
    tablet: "sm:hidden",
    tabletWide: "md:hidden",
    laptop: "lg:hidden",
    desktop: "xl:hidden",
    desktopWide: "2xl:hidden",
  },
  // Classes to show items (override hidden)
  block: {
    mobile: "block",
    tablet: "sm:block",
    tabletWide: "md:block",
    laptop: "lg:block",
    desktop: "xl:block",
    desktopWide: "2xl:block",
  },
};

export const getResponsiveClassNames =
  responsiveClassNameBuilder(tailwindClassMap);

/**
 * Reorders items for masonry columns. Masonry columns use the CSS "column-count" property, which fills columns from
 * top to bottom, left to right; oftentimes you want the items to fill columns from left to right, top to bottom, like a
 * normal CSS grid. This function reorders the items so that they are in the standard grid order.
 *
 * The destination index uses `rowCount = ceil(n / columnCount)`, so the permutation changes whenever `n` changes.
 * Do not use this for lists that grow in place (infinite scroll) — existing items will jump columns. Prefer
 * column stacks (`i % columnCount`) for append-stable masonry.
 *
 * @param items - The items to order
 * @param columnCount - The number of columns to order the items for
 * @returns The ordered items
 */
export function orderItemsForMasonryColumns<T>(
  items: T[],
  columnCount: number = 2,
): T[] {
  const rowCount = Math.ceil(items.length / columnCount);
  const reordered: T[] = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const col = i % columnCount;
    const row = Math.floor(i / columnCount);
    reordered[row + col * rowCount] = items[i];
  }

  return reordered;
}

/**
 * Get the appropriate pattern for a specific item based on its position in the grid
 * @param index - The item index (0-based)
 * @param columns - The number of columns in the grid
 * @param multiRowPattern - The multi-row pattern to use
 * @param mirror - Whether to mirror the pattern and how (false, "even", or "odd")
 * @returns The parsed span for the item
 */
export function getItemSpans(
  index: number,
  columns: number,
  multiRowPattern: ParsedMultiRowPattern,
  mirror: SpanPatternMirror,
  dense = false,
): ParsedSpan {
  // If no patterns, return default
  if (!multiRowPattern.length) return { col: 1, row: 1 };

  // Calculate total items in a complete pattern cycle
  const itemsPerPattern = multiRowPattern.reduce(
    (sum, rowPattern) => sum + rowPattern.length,
    0,
  );

  // Determine which pattern cycle this item belongs to
  const patternCycle = Math.floor(index / itemsPerPattern);

  // Find position within the pattern cycle
  const positionInCycle = index % itemsPerPattern;

  const isMirrored =
    mirror === "even"
      ? patternCycle % 2 === 1
      : mirror === "odd" && patternCycle % 2 === 0;
  const placement = getCyclePlacement(
    multiRowPattern,
    columns,
    isMirrored,
    dense,
  );
  if (placement) {
    const spans = placement.spans[positionInCycle];
    if (typeof spans.row === "string" && spans.row.includes("/")) {
      const [start, end] = spans.row.split("/").map(Number);
      let offset = patternCycle * placement.height;
      if (mirror !== false) {
        const first = getCyclePlacement(
          multiRowPattern,
          columns,
          mirror === "odd",
          dense,
        );
        const second = getCyclePlacement(
          multiRowPattern,
          columns,
          mirror === "even",
          dense,
        );
        offset =
          Math.floor(patternCycle / 2) * (first.height + second.height) +
          (patternCycle % 2 ? first.height : 0);
      }
      return { ...spans, row: `${start + offset}/${end + offset}` };
    }
    return spans;
  }

  // Determine which row pattern this item belongs to
  let currentPosition = 0;
  let rowPatternIndex = 0;

  for (let i = 0; i < multiRowPattern.length; i++) {
    currentPosition += multiRowPattern[i].length;
    if (positionInCycle < currentPosition) {
      rowPatternIndex = i;
      break;
    }
  }

  // Get the row pattern
  let rowPattern = multiRowPattern[rowPatternIndex];

  // Apply mirroring if needed
  if (mirror !== false) {
    const shouldMirror =
      mirror === "even" ? patternCycle % 2 === 1 : patternCycle % 2 === 0;

    if (shouldMirror)
      rowPattern = [...rowPattern].reverse() as typeof rowPattern;
  }

  // Calculate position within the row pattern
  const previousRowsItems =
    rowPatternIndex > 0
      ? multiRowPattern
          .slice(0, rowPatternIndex)
          .reduce((sum, row) => sum + row.length, 0)
      : 0;

  const positionInRowPattern = positionInCycle - previousRowsItems;

  // Return the pattern item
  let spans = rowPattern[positionInRowPattern] || { col: 1, row: 1 };

  return spans;
}

/**
 * Determines if an item should be hidden based on its index and the limit for a breakpoint
 * @param index - The item index (0-based)
 * @param limit - The maximum number of items to show (-1 means no limit)
 * @returns An object with a boolean indicating if the item should be hidden and at which breakpoint
 */
function shouldHideItem(
  index: number,
  limitByBreakpoint: BreakpointOptions<number>,
): Record<keyof BreakpointOptions<any>, boolean> {
  return breakpoints.reduce(
    (acc, breakpoint) => {
      const limit = limitByBreakpoint[breakpoint];
      // If limit is -1 or undefined, don't hide
      // Otherwise hide if index >= limit
      acc[breakpoint] = limit !== undefined && limit !== -1 && index >= limit;
      return acc;
    },
    {} as Record<keyof BreakpointOptions<any>, boolean>,
  );
}

export function getHiddenClassNames(
  limit: BreakpointOptions<number>,
  index: number,
) {
  const classes = [];

  // Apply limit-based hiding
  if (limit && Object.values(limit).some((val) => val !== -1)) {
    // Determine which breakpoints should hide this item
    const hideByBreakpoint = shouldHideItem(index, limit);

    // Generate hidden classes for breakpoints where this item should be hidden
    const hiddenBreakpoints = breakpoints.reduce(
      (acc, bp) => {
        if (hideByBreakpoint[bp]) acc[bp] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    if (!isEmptyObject(hiddenBreakpoints)) {
      classes.push(getResponsiveClassNames("hidden", hiddenBreakpoints));
    }
  }

  return classes.join(" ");
}

/**
 * Generates hidden class names for breakpoints where span values are "_"
 * Uses "hide at breakpoint and above" classes, and adds "block" classes
 * at breakpoints where the item becomes visible again.
 * @param colSpan - The column span values by breakpoint
 * @param rowSpan - The row span values by breakpoint
 * @returns A string of hidden and block class names
 */
/**
 * Helper to get the actual span value for a breakpoint, looking backwards if undefined
 */
function getActualSpanValue(
  spanByBreakpoint: BreakpointOptions<SpanValue>,
  breakpoint: string,
): SpanValue | undefined {
  const bpIndex = breakpoints.indexOf(breakpoint as any);
  if (bpIndex === -1) return undefined;

  // Check current breakpoint
  if (spanByBreakpoint[breakpoint] !== undefined) {
    return spanByBreakpoint[breakpoint];
  }

  // Look backwards for the most recent value
  for (let i = bpIndex - 1; i >= 0; i--) {
    const prevBp = breakpoints[i];
    if (spanByBreakpoint[prevBp] !== undefined) {
      return spanByBreakpoint[prevBp];
    }
  }

  return undefined;
}

export function getHiddenClassNamesFromSpans(
  colSpan: BreakpointOptions<SpanValue>,
  rowSpan: BreakpointOptions<SpanValue>,
): string {
  const classes: string[] = [];

  // Find breakpoints where we need to hide (using "hide at breakpoint and above" style)
  const hideFromBreakpoints: Record<string, boolean> = {};

  // Find breakpoints where we need to show again (override hidden)
  const showAtBreakpoints: Record<string, boolean> = {};

  // Track the last hidden state to detect transitions
  let wasHidden = false;

  // Check each breakpoint in order
  for (const breakpoint of breakpoints) {
    // Get actual values (looking backwards if undefined due to removeRedundantBreakpoints)
    const col = getActualSpanValue(colSpan, breakpoint);
    const row = getActualSpanValue(rowSpan, breakpoint);

    // Determine if this breakpoint is hidden
    const isHidden = col === "_" || row === "_";

    if (isHidden && !wasHidden) {
      // Transitioning from visible to hidden - hide at this breakpoint and above
      hideFromBreakpoints[breakpoint] = true;
      wasHidden = true;
    } else if (!isHidden && wasHidden) {
      // Transitioning from hidden to visible - show at this breakpoint and above
      showAtBreakpoints[breakpoint] = true;
      wasHidden = false;
    } else {
      wasHidden = isHidden;
    }
  }

  // Add hide classes (hide at breakpoint and above)
  if (!isEmptyObject(hideFromBreakpoints)) {
    classes.push(getResponsiveClassNames("hiddenFrom", hideFromBreakpoints));
  }

  // Add block classes to override hidden (show at breakpoint and above)
  if (!isEmptyObject(showAtBreakpoints)) {
    classes.push(getResponsiveClassNames("block", showAtBreakpoints));
  }

  return classes.join(" ");
}
