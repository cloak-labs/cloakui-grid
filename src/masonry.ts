import {
  asBreakpointObject,
  getResponsiveClassNames,
  getResponsiveCSSVariables,
} from "./helpers";
import type { OptionalBreakpointOptions, GridGenerator } from "./types";

type MasonryGridOptions = {
  columns?: OptionalBreakpointOptions<number>;
  gap?: OptionalBreakpointOptions<string>;
};

export function masonry(
  options: MasonryGridOptions
): Omit<GridGenerator, "getItemStyles"> {
  const columns = asBreakpointObject(
    options.columns ?? { mobile: 1, tablet: 2 }
  );
  const gap = asBreakpointObject(options.gap ?? "12px");

  return {
    gridStyles: {
      className: [
        getResponsiveClassNames("columns", columns),
        getResponsiveClassNames("gap", gap),
        getResponsiveClassNames("spaceY", gap),
      ].join(" "),
      style: {
        ...getResponsiveCSSVariables("cols", columns),
        ...getResponsiveCSSVariables("g-gap", gap),
      },
    },
  };
}
