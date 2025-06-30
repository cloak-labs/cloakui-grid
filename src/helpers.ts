import {
  breakpoints,
  responsiveClassNameBuilder,
  type BreakpointOptions,
  type OptionalBreakpointOptions,
} from "@cloakui/responsive";

import {
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
  ColRowSpanValue,
} from "./types";

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
          : (item as ExplicitSpanValue | ColRowSpanValue);
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
      .filter(([_, span]) => span !== 1) // span values of 1 are redundant
      .map(([bp, span]) => [bp, getSpanValue(span)])
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
  const result: ParsedSpan = { col: explicitSpan.col, row: explicitSpan.row };

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
 * Checks if a span pattern is in shorthand explicit syntax.
 * @param span - The span pattern to check
 * @returns True if the span pattern is in shorthand explicit syntax, false otherwise
 */
export function isShorthandExplicitSyntax(
  span: SpanPattern
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
  pattern: SpanPattern
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
  pattern: SpanPattern | MultiRowSpanPattern
): ParsedMultiRowPattern {
  // Handle array input
  if (Array.isArray(pattern) && pattern.length > 0) {
    const hasNestedArray = pattern.some((item) => Array.isArray(item));
    if (hasNestedArray) {
      // It's already a multi-dimensional array, parse each item
      return pattern.map((spanOrRowPattern) => {
        if (Array.isArray(spanOrRowPattern)) {
          return maybeResolveShorthandSyntax(spanOrRowPattern).map((span) =>
            parseSpan(span)
          );
        }

        if (isShorthandExplicitSyntax(spanOrRowPattern)) {
          return maybeResolveShorthandSyntax(spanOrRowPattern).map((span) =>
            parseSpan(span)
          );
        }

        return parseSpan(spanOrRowPattern as SpanValue);
      }) as ParsedMultiRowPattern;
    }

    const parsedPattern = pattern.map((spanOrRowPattern) =>
      parseSpan(spanOrRowPattern as SpanValue)
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
  // First, handle the case of explicit column spans
  let maxColumnEnd = 0;
  let minColumnStart = Infinity;
  let hasExplicitSpans = false;

  for (const { col } of rowPattern) {
    if (isExplicitSpan(col)) {
      hasExplicitSpans = true;
      const [start, end] = col.split("/").map(Number);
      maxColumnEnd = Math.max(maxColumnEnd, end);
      minColumnStart = Math.min(minColumnStart, start);
    }
  }

  // If we have explicit spans, return the max column end minus the min column start plus 1
  if (hasExplicitSpans) {
    // If all spans are explicit, use max end - min start + 1
    if (rowPattern.every(({ col }) => isExplicitSpan(col))) {
      return (
        maxColumnEnd - (minColumnStart === Infinity ? 1 : minColumnStart) + 1
      );
    }

    // If we have a mix of explicit and implicit spans, use the max end
    return maxColumnEnd;
  }

  // For implicit spans, sum them up
  return rowPattern.reduce(
    (sum, { col }) => sum + (getSpanLength(col) ?? 1),
    0
  );
}

/**
 * Infer the total number of columns needed for a multi-row pattern
 * @param multiRowPattern - The multi-row pattern to infer columns for
 * @returns The inferred column count
 */
export function inferColumnCount(
  multiRowPattern: ParsedMultiRowPattern
): number {
  return Math.max(
    ...multiRowPattern.map((rowPattern) => calculatePatternColumns(rowPattern))
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
  isSpanValue?: boolean
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
  removeRedundancies: boolean = true
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
};

export const getResponsiveClassNames =
  responsiveClassNameBuilder(tailwindClassMap);

/**
 * Reorders items for masonry columns. Masonry columns use the CSS "column-count" property, which fills columns from
 * top to bottom, left to right; oftentimes you want the items to fill columns from left to right, top to bottom, like a
 * normal CSS grid. This function reorders the items so that they are in the standard grid order.
 *
 * @param items - The items to order
 * @param columnCount - The number of columns to order the items for
 * @returns The ordered items
 */
export function orderItemsForMasonryColumns<T>(
  items: T[],
  columnCount: number = 2
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
  mirror: SpanPatternMirror
): ParsedSpan {
  // If no patterns, return default
  if (!multiRowPattern.length) return { col: 1, row: 1 };

  // Calculate total items in a complete pattern cycle
  const itemsPerPattern = multiRowPattern.reduce(
    (sum, rowPattern) => sum + rowPattern.length,
    0
  );

  // Determine which pattern cycle this item belongs to
  const patternCycle = Math.floor(index / itemsPerPattern);

  // Find position within the pattern cycle
  const positionInCycle = index % itemsPerPattern;

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

  // If we're beyond the first pattern cycle and using explicit row spans, adjust the row span starting point
  if (patternCycle > 0 && isExplicitSpan(spans.row)) {
    // Find the corresponding item in the previous pattern cycle
    const itemIndexInPreviousCycle = index - itemsPerPattern;

    let previousRowEnd = 1;
    if (itemIndexInPreviousCycle >= 0) {
      const previousSpans = getItemSpans(
        itemIndexInPreviousCycle,
        columns,
        multiRowPattern,
        mirror
      );

      if (isExplicitSpan(previousSpans.row)) {
        // Extract the end value from the explicit row span
        previousRowEnd = parseInt(previousSpans.row.split("/")[1], 10);
      } else {
        // For numeric row spans, add the span to the start row (which is 1-based)
        const rowSpan =
          typeof previousSpans.row === "number"
            ? previousSpans.row
            : parseInt(previousSpans.row as string, 10);
        previousRowEnd = 1 + rowSpan;
      }
    } else {
      // If there's no previous cycle (shouldn't happen), increment the row span starting point by 1
      previousRowEnd = patternCycle + 1;
    }

    spans = adjustExplicitSpansForNextRow({
      explicitSpan: spans,
      previousRowEnd,
    });
  }

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
  limitByBreakpoint: BreakpointOptions<number>
): Record<keyof BreakpointOptions<any>, boolean> {
  return breakpoints.reduce((acc, breakpoint) => {
    const limit = limitByBreakpoint[breakpoint];
    // If limit is -1 or undefined, don't hide
    // Otherwise hide if index >= limit
    acc[breakpoint] = limit !== undefined && limit !== -1 && index >= limit;
    return acc;
  }, {} as Record<keyof BreakpointOptions<any>, boolean>);
}

export function getHiddenClassNames(
  limit: BreakpointOptions<number>,
  index: number
) {
  const classes = [];

  // Apply limit-based hiding
  if (limit && Object.values(limit).some((val) => val !== -1)) {
    // Determine which breakpoints should hide this item
    const hideByBreakpoint = shouldHideItem(index, limit);

    // Generate hidden classes for breakpoints where this item should be hidden
    const hiddenBreakpoints = breakpoints.reduce((acc, bp) => {
      if (hideByBreakpoint[bp]) acc[bp] = true;
      return acc;
    }, {} as Record<string, boolean>);

    if (!isEmptyObject(hiddenBreakpoints)) {
      classes.push(getResponsiveClassNames("hidden", hiddenBreakpoints));
    }
  }

  return classes.join(" ");
}
