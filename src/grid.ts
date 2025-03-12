import {
  breakpoints,
  asBreakpointObject,
  fillMissingBreakpoints,
  getBreakpointValue,
  getSpanValue,
  getPatternObject,
  getResponsiveClassNames,
  getResponsiveCSSVariables,
  adjustExplicitSpanForNextRow,
  isEmptyObject,
  removeRedundantBreakpoints,
} from "./helpers";

import {
  GridOptions,
  GridGenerator,
  SpanValues,
  ExplicitSpanValue,
  SpanPatternMirror,
  VerticalPatternOptions,
  SpanValue,
  BreakpointOptions,
} from "./types";

/**
 * Generate complex, responsive CSS grid styles with a simple, type-safe API.
 * @param options - The options to generate the grid styles
 * @returns The grid container styles (`className` & `style` props) and a `getItemStyles` callback which, given a grid item's index, returns a `className` & `style` prop for that grid item. It's up to you to apply these style props to your components.
 */
export function grid(options: GridOptions): GridGenerator {
  const { patternDirection = "vertical", totalItems } = options;
  const spanPattern = asBreakpointObject(options.spanPattern ?? [1]);
  const gap = asBreakpointObject(options.gap ?? "12px");

  const rowHeight = asBreakpointObject(
    !options.rowHeight || isEmptyObject(options.rowHeight)
      ? patternDirection === "vertical"
        ? "auto"
        : "1fr"
      : options.rowHeight
  );

  const mirror = fillMissingBreakpoints<SpanPatternMirror>(
    asBreakpointObject(options.mirror ?? false),
    false
  );

  const patternObjects = breakpoints
    .map((breakpoint) => {
      const pattern = getBreakpointValue(spanPattern, breakpoint);
      if (!pattern) return null;
      return getPatternObject(
        pattern,
        patternDirection,
        getBreakpointValue(mirror, breakpoint),
        breakpoint
      );
    })
    .filter(Boolean);

  const columns = {
    vertical: asBreakpointObject(
      (options as VerticalPatternOptions).columns ?? {
        mobile: 1,
        tablet: 2,
      }
    ),
    horizontal: patternObjects.reduce(
      (acc, { breakpoint, implicitColumns }) => {
        acc[breakpoint] = implicitColumns;
        return acc;
      },
      asBreakpointObject([1])
    ),
  }[patternDirection];

  return {
    gridStyles: {
      className: [
        "grid",
        getResponsiveClassNames("gap", gap),
        getResponsiveClassNames("rowHeight", rowHeight),
        getResponsiveClassNames("gridCols", columns),
      ].join(" "),
      style: {
        ...getResponsiveCSSVariables("g-gap", gap),
        ...getResponsiveCSSVariables("row-h", rowHeight),
        ...getResponsiveCSSVariables("g-cols", columns),
        ...{
          vertical: {},
          horizontal: { gridAutoFlow: "dense" },
        }[patternDirection],
      },
    },
    getItemStyles: ({ index }) => {
      let responsiveSpans = patternObjects.reduce(
        (
          acc,
          { spans, minSpanLength, getItemSpanValue, breakpoint, isExplicit }
        ) => {
          let span;
          if (patternDirection === "vertical") {
            const isLastItem = index === totalItems - 1;
            const rowIndex = Math.floor(
              index / getBreakpointValue(columns, breakpoint)
            );

            const { balance = false } = options as VerticalPatternOptions;

            span =
              isLastItem && balance ? minSpanLength : getItemSpanValue(index);

            if (isExplicit && rowIndex > 0) {
              const lastRowNumber = spans.reduce(
                (max: number, span: ExplicitSpanValue) => {
                  let [, end] = span.split("/").map(Number);
                  return Math.max(max, end);
                },
                0
              ) as number;

              span = adjustExplicitSpanForNextRow({
                explicitSpan: span,
                previousRowEnd: rowIndex * lastRowNumber,
              });
            }
          } else {
            span = getItemSpanValue(index);
          }

          acc.row[breakpoint] = patternDirection === "vertical" ? span : 1;
          acc.col[breakpoint] = patternDirection === "horizontal" ? span : 1;

          return acc;
        },
        { col: {}, row: {} } as SpanValues
      );

      let rowSpan = removeRedundantBreakpoints(responsiveSpans.row, true);
      let colSpan = removeRedundantBreakpoints(responsiveSpans.col, true);

      const userFilters = options.filters;
      if (userFilters?.spanValues) {
        const filteredSpans = userFilters.spanValues({
          itemIndex: index,
          spans: responsiveSpans,
          add: (span = 1, spanLength = 1) => {
            if (typeof span === "number") return span + spanLength;

            let [start, end] = span?.split("/").map(Number);
            return `${start}/${end + spanLength}`;
          },
        });

        rowSpan = asBreakpointObject(filteredSpans.row);
        colSpan = asBreakpointObject(filteredSpans.col);
      }

      const getSpanValues = (span: BreakpointOptions<SpanValue>) =>
        Object.fromEntries(
          Object.entries(span)
            .filter(([_, span]) => span !== 1) // span values of 1 are redundant
            .map(([bp, span]) => [bp, getSpanValue(span)])
        );

      const colSpanVars = getResponsiveCSSVariables<string>(
        "c-span",
        getSpanValues(colSpan)
      );

      const rowSpanVars = getResponsiveCSSVariables<string>(
        "r-span",
        getSpanValues(rowSpan)
      );

      let classes = [];
      if (!isEmptyObject(rowSpanVars)) {
        classes.push(getResponsiveClassNames("rowSpan", rowSpan));
      }
      if (!isEmptyObject(colSpanVars)) {
        classes.push(getResponsiveClassNames("colSpan", colSpan));
      }

      return {
        className: classes.join(" "),
        style: {
          ...rowSpanVars,
          ...colSpanVars,
        },
      };
    },
  };
}
