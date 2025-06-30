import {
  asBreakpointObject,
  getHiddenClassNames,
  getResponsiveClassNames,
} from "./helpers";
import { getResponsiveCSSVariables } from "@cloakui/responsive";
import type { GridGenerator, MasonryGridOptions } from "./types";

export function masonry(options: MasonryGridOptions): GridGenerator {
  const columns = asBreakpointObject(
    options.columns ?? { mobile: 1, tablet: 2 }
  );
  const gap = asBreakpointObject(options.gap ?? "12px");
  const limit = asBreakpointObject(options.limit ?? -1, false);

  return {
    gridStyles: {
      className: [
        getResponsiveClassNames("columns", columns),
        getResponsiveClassNames("gap", gap),
        getResponsiveClassNames("spaceY", gap),
      ].join(" "),
      style: {
        ...getResponsiveCSSVariables<number>("cols", columns),
        ...getResponsiveCSSVariables<string>("g-gap", gap),
      },
    },
    getItemStyles: ({ index }) => {
      // Calculate width percentages for each breakpoint
      const widthPercentages = Object.entries(columns).reduce(
        (acc, [breakpoint, columnCount]) => {
          acc[breakpoint] = `${(1 / columnCount) * 100}%`;
          return acc;
        },
        {} as Record<string, string>
      );

      return {
        className: getHiddenClassNames(limit, index),
        style: {},
        width: widthPercentages,
      };
    },
  };
}
