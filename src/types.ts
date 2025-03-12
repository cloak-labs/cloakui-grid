export type PatternDirection = "horizontal" | "vertical";

export type ImplicitSpanValue = number;
export type ExplicitSpanValue = `${number}/${number}`;
export type ShorthandExplicitSpanValue =
  | `${number}-${number}`
  | `${number}-${number}-${number}`
  | `${number}-${number}-${number}-${number}`
  | `${number}-${number}-${number}-${number}-${string}`;

export type SpanValue = ImplicitSpanValue | ExplicitSpanValue;
export type SpanPattern = SpanValue[] | ShorthandExplicitSpanValue;

export type BreakpointOptions<T> = {
  mobile?: T;
  tablet?: T;
  tabletWide?: T;
  laptop?: T;
  desktop?: T;
  desktopWide?: T;
};

export type OptionalBreakpointOptions<T> = T | BreakpointOptions<T>;

export type SpanPatternMirror = false | "even" | "odd";
export type SpanValues = {
  col: BreakpointOptions<SpanValue>;
  row: BreakpointOptions<SpanValue>;
};
export type SpanValueFilterProps = {
  itemIndex: number;
  add: (span: SpanValue, spanLength: number) => SpanValue;
  spans: SpanValues;
};

export type BaseGridOptions = {
  totalItems: number;
  /** Defines the direction of the grid pattern. "horizontal" == varied column widths & fixed rows (i.e. clean horizontal lines), "vertical" == varied row height & fixed columns (i.e. clean vertical lines). */
  patternDirection?: PatternDirection;
  /** Defines the pattern of span values for the grid. eg. [1, 3, 2] (implicit spans), ["1/3", "3/6", "6/10"] (explicit spans --> or use special shorthand syntax "1-3-6-10"). */
  spanPattern?: OptionalBreakpointOptions<SpanPattern>;
  /** Callback function to override the span values for each grid item, enabling more advanced/customized grid patterns. */
  filters?: {
    spanValues?: (props: SpanValueFilterProps) => SpanValues;
  };
  /** Defines the gap between grid items. */
  gap?: OptionalBreakpointOptions<string>;
  /** Defines the height of each row in the grid. For horizontal grid patterns containing images, you may want to apply an aspect ratio to the grid items/images instead of defining this. */
  rowHeight?: OptionalBreakpointOptions<string>;
  /** Reverses the spanPattern for alternating repititions (choose to apply to odd or even repititions). */
  mirror?: OptionalBreakpointOptions<SpanPatternMirror>;
};

export type VerticalPatternOptions = BaseGridOptions & {
  patternDirection: "vertical";
  /** For vertical grid patterns, this option defines the number of columns in the grid (whereas for horizontal grid patterns, the number of columns is inferred from the spanPattern). */
  columns?: OptionalBreakpointOptions<number>;
  /** When the last row of a vertical grid pattern is wonky (i.e. certain items poke out further than others), this option will cause the last row to align with the bottom of the grid container. Warning: this is experimenta/limitedl and not perfect. */
  balance?: boolean;
};

export type HorizontalPatternOptions = BaseGridOptions & {
  patternDirection: "horizontal";
};

export type GridOptions = VerticalPatternOptions | HorizontalPatternOptions;

export type GridStyles = {
  className: string;
  style: Record<string, string>;
};

export type GridGenerator = {
  gridStyles: GridStyles;
  getItemStyles: ({ index }: { index: number }) => GridStyles;
};
