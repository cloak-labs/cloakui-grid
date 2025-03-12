import {
  BreakpointOptions,
  ExplicitSpanValue,
  ImplicitSpanValue,
  OptionalBreakpointOptions,
  PatternDirection,
  SpanPattern,
  SpanPatternMirror,
  SpanValue,
  ShorthandExplicitSpanValue,
} from "./types";

/**
 * Helper to get the length of an implicit or explicit span value.
 * @param span - The span value to get the length of
 * @returns The length of the span
 */
export function getSpanLength(span: SpanValue): number | null {
  if (typeof span === "number") return span;
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
  return span;
}

/**
 * When using explicit spans for a vertical grid pattern, we need to adjust the start/end span values for rows 2 and beyond.
 * @param explicitSpan - The explicit span value to adjust
 * @param previousRowEnd - The end number of the previous row
 * @returns The adjusted explicit span value
 */
export function adjustExplicitSpanForNextRow({
  explicitSpan,
  previousRowEnd,
}: {
  explicitSpan: SpanValue;
  previousRowEnd: number;
}): SpanValue {
  if (typeof explicitSpan === "number") return explicitSpan;

  const [start, end] = explicitSpan.split("/").map(Number);
  const spanLength = end - start;

  const adjustedStart = Math.max(start + previousRowEnd - 1);
  const adjustedEnd = adjustedStart + spanLength;

  return `${adjustedStart}/${adjustedEnd}`;
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
    span.includes("-") &&
    !span.startsWith("-")
  );
}

/**
 * Converts shorthand explicit span patterns (eg. "1-3-6") to an array of explicit span values (eg. ["1/3", "3/6"])
 * @param spanPattern - Any spanPattern value, shorthand or otherwise
 * @returns The converted span pattern in explicit syntax, if it was in shorthand syntax, otherwise the original spanPattern value
 */
export function expandShorthandSpanPattern(
  spanPattern: SpanPattern
): SpanValue[] {
  if (isShorthandExplicitSyntax(spanPattern)) {
    const positions = spanPattern.split("-").map(Number);
    const expandedSpans: SpanValue[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      expandedSpans.push(`${positions[i]}/${positions[i + 1]}`);
    }
    return expandedSpans;
  }

  return spanPattern;
}

export const breakpoints: (keyof BreakpointOptions<any>)[] = [
  "mobile",
  "tablet",
  "tabletWide",
  "laptop",
  "desktop",
  "desktopWide",
];

/**
 * Fills in missing breakpoint options with the closest valid breakpoint value (looking backwards at smaller breakpoints)
 * @param options - The breakpoint options to fill
 * @param fallback - The fallback value to use if no previous value is found
 * @returns The filled options
 */
export function fillMissingBreakpoints<T>(
  options: BreakpointOptions<T>,
  fallback: any
): BreakpointOptions<T> {
  return breakpoints.reduce((acc, bp) => {
    // If this breakpoint has a value, use it
    if (options[bp] !== undefined && options[bp] !== "") {
      acc[bp] = options[bp];
      return acc;
    }

    // Otherwise look through all previous breakpoints until we find a value
    for (let i = breakpoints.indexOf(bp) - 1; i >= 0; i--) {
      const prevValue = options[breakpoints[i]];
      if (prevValue !== undefined && prevValue !== "") {
        acc[bp] = prevValue;
        return acc;
      }
    }

    // If no previous values found, default to provided fallback
    acc[bp] = fallback;
    return acc;
  }, {} as BreakpointOptions<T>);
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
export function asBreakpointObject(
  option: OptionalBreakpointOptions<any>
): BreakpointOptions<any> {
  return isObject(option)
    ? removeRedundantBreakpoints(option)
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

/**
 * Helper to get the value of a breakpoint option.
 * @param breakpointOptions - The breakpoint options object
 * @param breakpoint - The breakpoint to get the value of
 * @returns The value of the breakpoint, or null if the breakpoint is not defined
 */
export function getBreakpointValue<T>(
  breakpointOptions: BreakpointOptions<T>,
  breakpoint: keyof BreakpointOptions<T>
): T | null {
  return breakpointOptions[breakpoint] ?? null;
}

/**
 * Helper to build a CSS variable name.
 * @param variableName - The name of the variable, excluding the `--` prefix
 * @param breakpoint - The breakpoint to build the variable for
 * @returns The full CSS variable name
 */
export function buildResponsiveCSSVariable(
  variableName: string,
  breakpoint: keyof BreakpointOptions<any>
) {
  return `--${variableName}${
    breakpoint === "mobile"
      ? ""
      : `-${
          {
            tablet: "sm",
            tabletWide: "md",
            laptop: "lg",
            desktop: "xl",
            desktopWide: "2xl",
          }[breakpoint]
        }`
  }`;
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
};

/**
 * Returns all needed class names for a given property to satisfy the user-specified breakpoints.
 * @param property - The property to generate the class names for
 * @param options - The user-specified breakpoint options for the property
 * @returns The generated class names
 */
export function getResponsiveClassNames(
  property: keyof typeof tailwindClassMap,
  breakpointOptions: Partial<BreakpointOptions<any>>
): string {
  return breakpoints
    .map((breakpoint) => {
      const className = tailwindClassMap[property][breakpoint];
      return className && breakpointOptions?.[breakpoint] !== undefined
        ? className
        : "";
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Generates CSS variables for a given property based on the user-specified breakpoint options.
 * @param variableName - The name of the variable, excluding the `--` prefix
 * @param breakpointOptions - The user-specified breakpoint options for the property
 * @returns The generated CSS variables
 */
export function getResponsiveCSSVariables<T>(
  variableName: string,
  breakpointOptions: BreakpointOptions<T>
) {
  if (breakpointOptions === undefined) return null;
  return breakpoints.reduce((acc, breakpoint) => {
    const value = breakpointOptions[breakpoint];
    if (value !== undefined) {
      acc[buildResponsiveCSSVariable(variableName, breakpoint)] = value;
    }
    return acc;
  }, {} as Record<string, T>);
}

/**
 * Processes a span pattern to determine the number of columns and the span values for each item in the pattern.
 * @param spanPattern - The span pattern to process
 * @param patternDirection - The direction of the pattern
 * @param mirror - Whether to mirror the pattern
 * @param breakpoint - The breakpoint to process the pattern for
 * @returns The processed span pattern
 */
export function getPatternObject(
  spanPattern: SpanPattern,
  patternDirection: PatternDirection,
  mirror: SpanPatternMirror,
  breakpoint: keyof BreakpointOptions<any>
) {
  const isShorthand = isShorthandExplicitSyntax(spanPattern);

  // "explicit" spans use start/end syntax (eg. "1/3"), while "implicit" spans use a single number (eg. 3)
  const isExplicit =
    isShorthand ||
    spanPattern.some((span) => typeof span === "string" && span.includes("/"));

  let implicitColumns: number;
  if (patternDirection == "horizontal") {
    implicitColumns = isShorthand
      ? Number(spanPattern.split("-").pop()) - 1
      : isExplicit
      ? Math.max(
          ...spanPattern.map((span) => {
            if (typeof span === "string") {
              const [, end] = span.split("/").map(Number);
              return end - 1;
            }
            return span;
          })
        )
      : spanPattern
          .map(getSpanLength)
          .filter((span): span is number => span !== null)
          .reduce((sum, span) => sum + span, 0);
  }

  /**
   * Resolves the span pattern to an array of valid CSS span values.
   * @param spanPattern - The span pattern to resolve
   * @returns The resolved span pattern
   */
  const resolveSpanPattern = (spanPattern: SpanPattern): SpanValue[] => {
    if (!isExplicit) return spanPattern as ImplicitSpanValue[];

    return expandShorthandSpanPattern(spanPattern)?.map((span) => {
      if (typeof span === "number") {
        // Convert implicit span to explicit start/end, preventing out-of-order weirdness when mixing implicit and explicit spans
        return `1/${span + 1}` as ExplicitSpanValue;
      }

      let [start, end] = span.split("/").map(Number);
      if (patternDirection == "vertical" && end === -1)
        end = implicitColumns + 1;
      return `${start}/${end}` as ExplicitSpanValue;
    });
  };

  const resolvedSpanPattern = resolveSpanPattern(spanPattern);

  const spanLengths = resolvedSpanPattern.map(getSpanLength);
  const minSpanLength = Math.min(...spanLengths);
  // const totalSpan = spanLengths.reduce((sum, span) => sum + span, 0);

  const getReversedSpanPattern = (): SpanValue[] => {
    if (patternDirection == "horizontal" && isExplicit) {
      const reversedLengths = [...spanLengths].reverse();

      let currentStart = 1;
      return reversedLengths.map((length) => {
        const newEnd = currentStart + length;
        const newSpan: ExplicitSpanValue = `${currentStart}/${newEnd}`;
        currentStart = newEnd;
        return newSpan;
      });
    }

    const copy = [...resolvedSpanPattern];
    return copy.reverse();
  };

  /**
   * Gets the span value for a grid item based on the provided span pattern and the item's position in the grid
   * @param index - The item's index in the overall grid
   * @param rowIndex - Optional explicit row index, used for vertical patterns
   * @returns The span value to use for this grid item
   */
  const getItemSpanValue = (itemIndex: number): SpanValue => {
    const patternLength = resolvedSpanPattern.length;
    const repetitionNumber = Math.floor(itemIndex / patternLength);

    const shouldReverse =
      mirror !== false &&
      {
        even: repetitionNumber % 2 === 0,
        odd: repetitionNumber % 2 === 1,
      }[mirror];

    const pattern = shouldReverse
      ? getReversedSpanPattern()
      : resolvedSpanPattern;

    return pattern[itemIndex % patternLength];
  };

  return {
    breakpoint,
    spans: resolvedSpanPattern,
    minSpanLength,
    implicitColumns,
    isExplicit,
    getItemSpanValue,
  };
}
