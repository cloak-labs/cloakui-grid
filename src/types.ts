import type {
  BreakpointOptions,
  OptionalBreakpointOptions,
} from "@cloakui/responsive";

export type PatternDirection = "horizontal" | "vertical";

export type ImplicitSpanValue = number;
export type ExplicitSpanValue = `${number}/${number}`;
export type ShorthandExplicitSpanValue =
  | `${number}-${number}`
  | `${number}-${number}-${number}`
  | `${number}-${number}-${number}-${number}`
  | `${number}-${number}-${number}-${number}-${string}`;

export type SpanValue = ImplicitSpanValue | ExplicitSpanValue;
export type ColRowSpanValue = `${SpanValue}:${SpanValue}`;
export type UserSpanValue = SpanValue | ColRowSpanValue;

export type SpanPattern = UserSpanValue[] | ShorthandExplicitSpanValue;

export type MultiRowSpanPattern = SpanPattern[];

export type UserSpanPattern = SpanPattern | MultiRowSpanPattern;

export type ParsedSpan = {
  col: SpanValue;
  row: SpanValue;
};

export type ParsedPattern = ParsedSpan[];
export type ParsedMultiRowPattern = ParsedPattern[];

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

/* Defines shared options for both masonry and grid patterns */
export type SharedGridOptions = {
  /** Defines the gap between grid items. */
  gap?: OptionalBreakpointOptions<string>;
  /** Limits the number of grid items to display, optionally differing per breakpoint. */
  limit?: OptionalBreakpointOptions<number>;
};

export type GridOptions = SharedGridOptions & {
  /** Defines the pattern of span values for the grid. eg. [1, 3, 2] (implicit spans), ["1/3", "3/6", "6/10"] (explicit spans --> or use special shorthand syntax "1-3-6-10"). */
  pattern?: OptionalBreakpointOptions<SpanPattern | MultiRowSpanPattern>;
  /** Callback function to override the span values for each grid item, enabling more advanced/customized grid patterns. */
  filters?: {
    spanValues?: (props: SpanValueFilterProps) => SpanValues;
  };
  /** When true, the grid will be inline (i.e. `display: inline-grid;` rather than `display: grid;`). */
  inline?: boolean;
  /** Defines the height of each row in the grid. For horizontal grid patterns containing images, you may want to apply an aspect ratio to the grid items/images instead of defining this. */
  rowHeight?: OptionalBreakpointOptions<string>;
  /** Reverses the pattern for alternating repititions (choose to apply to odd or even repititions). */
  mirror?: OptionalBreakpointOptions<SpanPatternMirror>;
  /** When true, the grid will be dense, meaning that the grid items will be packed together. */
  dense?: boolean;
};

export type MasonryGridOptions = SharedGridOptions & {
  /** Defines the number of columns in the masonry grid. */
  columns?: OptionalBreakpointOptions<number>;
};

export type GridStyles = {
  className: string;
  style: Record<string, string | number>;
};

export type GridGenerator = {
  gridStyles: GridStyles;
  getItemStyles: ({
    index,
  }: {
    index: number;
  }) => GridStyles & { width: BreakpointOptions<string> };
};
