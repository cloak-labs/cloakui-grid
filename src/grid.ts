import {
  breakpoints,
  fillMissingBreakpoints,
  getResponsiveCSSVariables,
  type BreakpointOptions,
} from "@cloakui/responsive";
import {
  asBreakpointObject,
  columnsToEqualSpanPattern,
  getResponsiveClassNames,
  removeRedundantBreakpoints,
  parseMultiRowPattern,
  inferColumnCount,
  isEmptyObject,
  getSpanValues,
  getItemSpans,
  getHiddenClassNames,
  getHiddenClassNamesFromSpans,
} from "./helpers";

import type {
  GridOptions,
  GridLayoutGenerator,
  ParsedMultiRowPattern,
  SpanPatternMirror,
  SpanValues,
  SpanValue,
} from "./types";
import {
  getContentPatternIndex,
  getLayoutSlots,
  type PatternData,
} from "./layout";

/**
 * Generate complex, responsive CSS grid styles with a simple, type-safe API.
 * @param options - The options to generate the grid styles
 * @returns The grid container styles (`className` & `style` props) and a `getItemStyles` callback which, given a grid item's index, returns a `className` & `style` prop for that grid item. It's up to you to apply these style props to your components.
 */
export function grid(options: GridOptions): GridLayoutGenerator {
  const { dense = false } = options;
  // Prefer `pattern`; else `columns` (default `{ mobile: 1, tablet: 2 }` when unset).
  const resolvedPattern =
    options.pattern ??
    columnsToEqualSpanPattern(options.columns ?? { mobile: 1, tablet: 2 });
  const patternByBreakpoint = asBreakpointObject(resolvedPattern);
  const gap = asBreakpointObject(options.gap ?? "12px");
  const rowHeight = asBreakpointObject(options.rowHeight);
  const mirror = fillMissingBreakpoints<SpanPatternMirror>(
    asBreakpointObject(options.mirror ?? false),
    false,
  );
  const limit = asBreakpointObject(options.limit ?? -1, false);

  // Process span patterns for each breakpoint
  const patternsByBreakpoint = breakpoints.reduce(
    (acc, breakpoint) => {
      const pattern = patternByBreakpoint[breakpoint] ?? null;
      if (!pattern) return acc;

      const multiRowPattern = parseMultiRowPattern(pattern);
      if (multiRowPattern.flat().every((span) => span.gap)) {
        throw new Error(
          'A grid pattern containing "+" must also contain a content span.',
        );
      }
      const columnCount = inferColumnCount(multiRowPattern);

      acc[breakpoint] = {
        multiRowPattern,
        columnCount,
      };

      return acc;
    },
    {} as Record<
      string,
      { multiRowPattern: ParsedMultiRowPattern; columnCount: number }
    >,
  );

  // Infer columns for each breakpoint
  const columns = breakpoints.reduce((acc, breakpoint) => {
    const pattern = patternsByBreakpoint[breakpoint];
    if (pattern) acc[breakpoint] = pattern.columnCount;
    return acc;
  }, {} as BreakpointOptions<number>);

  const hasGaps = Object.values(patternsByBreakpoint).some((pattern) =>
    pattern.multiRowPattern.flat().some((span) => span.gap),
  );
  const inheritedPatterns = fillMissingBreakpoints<PatternData>(
    patternsByBreakpoint,
    { multiRowPattern: [[{ col: 1, row: 1 }]], columnCount: 1 },
  );
  const hasResponsiveMirror = Object.keys(
    asBreakpointObject(options.mirror ?? false),
  ).some((bp) => bp !== "mobile");
  const effectivePatterns =
    hasGaps || hasResponsiveMirror ? inheritedPatterns : patternsByBreakpoint;

  const getItemStyles = (
    { index }: { index: number },
    patternIndices?: BreakpointOptions<number | null>,
    isSpacer = false,
  ) => {
    // Calculate spans for each breakpoint
    let responsiveSpans = breakpoints.reduce(
      (acc, breakpoint) => {
        const patternData = effectivePatterns[breakpoint];
        if (!patternData) return acc;

        const { multiRowPattern, columnCount } = patternData;
        const mirrorValue = mirror[breakpoint] ?? false;

        const patternIndex = patternIndices
          ? patternIndices[breakpoint]
          : hasGaps
            ? getContentPatternIndex(index, patternData, mirrorValue)
            : index;
        const { col, row } =
          patternIndex === null
            ? { col: "_" as const, row: 1 }
            : getItemSpans(
                patternIndex,
                columnCount,
                multiRowPattern,
                mirrorValue,
                dense,
              );

        acc.col[breakpoint] = col;
        acc.row[breakpoint] = row;

        return acc;
      },
      { col: {}, row: {} } as SpanValues,
    );

    // Remove redundant breakpoints
    let rowSpan = removeRedundantBreakpoints<SpanValue>(
      responsiveSpans.row,
      true,
    );
    let colSpan = removeRedundantBreakpoints<SpanValue>(
      responsiveSpans.col,
      true,
    );

    // Apply user filters if provided
    const userFilters = options.filters;
    if (!isSpacer && userFilters?.spanValues) {
      const filteredSpans = userFilters.spanValues({
        itemIndex: index,
        spans: responsiveSpans,
        add: (span = 1, spanLength = 1) => {
          if (span === "_") return span;
          if (typeof span === "number") return span + spanLength;

          let [start, end] = span?.split("/").map(Number);
          return `${start}/${end + spanLength}`;
        },
      });

      rowSpan = asBreakpointObject<SpanValue>(filteredSpans.row);
      colSpan = asBreakpointObject<SpanValue>(filteredSpans.col);
    }

    // Filter out "_" spans before generating CSS variables
    const filteredColSpan = Object.fromEntries(
      Object.entries(colSpan).filter(([_, span]) => span !== "_"),
    ) as BreakpointOptions<SpanValue>;

    const filteredRowSpan = Object.fromEntries(
      Object.entries(rowSpan).filter(([_, span]) => span !== "_"),
    ) as BreakpointOptions<SpanValue>;

    const colSpanVars = getResponsiveCSSVariables<string>(
      "c-span",
      getSpanValues(filteredColSpan),
    );

    const rowSpanVars = getResponsiveCSSVariables<string>(
      "r-span",
      getSpanValues(filteredRowSpan),
    );

    // Calculate width percentages for each breakpoint (skip "_" spans)
    let lastSpan;
    const widthPercentages = breakpoints.reduce((acc, breakpoint) => {
      const patternData = effectivePatterns[breakpoint];
      if (!patternData) return acc;

      const { columnCount } = patternData;
      let span = colSpan[breakpoint];

      // Skip if span is "_"
      if (span === "_") return acc;

      if (!span && isEmptyObject(acc)) span = 1;

      const getWidthPercentage = (span: number | string) => {
        if (typeof span === "string" && !span.includes("/")) {
          span = Number(span);
        }

        if (typeof span === "number") {
          return `${(span / columnCount) * 100}%`;
        } else if (typeof span === "string") {
          let [start, end] = span.split("/").map(Number);
          if (start < 0) start = columnCount + 2 + start;
          if (end < 0) end = columnCount + 2 + end;
          return `${((end - start) / columnCount) * 100}%`;
        } else if (lastSpan) return getWidthPercentage(lastSpan);
      };

      if (span) lastSpan = span;
      const width = getWidthPercentage(span);
      if (width) acc[breakpoint] = width;

      return acc;
    }, {} as BreakpointOptions<string>);

    // Generate class names
    let classes = [];
    if (!isEmptyObject(rowSpanVars))
      classes.push(getResponsiveClassNames("rowSpan", filteredRowSpan));
    if (!isEmptyObject(colSpanVars))
      classes.push(getResponsiveClassNames("colSpan", filteredColSpan));

    classes.push(getHiddenClassNames(limit, index));

    // Add hidden classes for "_" spans
    const hiddenFromSpans = getHiddenClassNamesFromSpans(colSpan, rowSpan);
    if (hiddenFromSpans) {
      classes.push(hiddenFromSpans);
    }

    return {
      className: classes.join(" "),
      style: {
        ...rowSpanVars,
        ...colSpanVars,
      },
      width: widthPercentages,
    };
  };

  return {
    gridStyles: {
      className: [
        options.inline ? "inline-grid" : "grid",
        getResponsiveClassNames("gap", gap),
        getResponsiveClassNames("rowHeight", rowHeight),
        getResponsiveClassNames("gridCols", columns),
      ].join(" "),
      style: {
        ...getResponsiveCSSVariables("g-gap", gap),
        ...getResponsiveCSSVariables("row-h", rowHeight),
        ...getResponsiveCSSVariables("g-cols", columns),
        ...(dense ? { gridAutoFlow: "dense" } : {}),
      },
    },
    getItemStyles: ({ index }) => getItemStyles({ index }),
    getLayout: (itemCount) => {
      if (!Number.isInteger(itemCount) || itemCount < 0) {
        throw new Error("Grid item count must be a non-negative integer.");
      }
      if (!hasGaps) {
        return Array.from({ length: itemCount }, (_, itemIndex) => ({
          itemIndex,
          ...getItemStyles({ index: itemIndex }),
        }));
      }
      return getLayoutSlots(itemCount, inheritedPatterns, mirror).map(
        ({ itemIndex, limitIndex, patternIndices }) => ({
          itemIndex,
          ...getItemStyles(
            { index: limitIndex },
            patternIndices,
            itemIndex === null,
          ),
        }),
      );
    },
  };
}
