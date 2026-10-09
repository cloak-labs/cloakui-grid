import { breakpoints, type BreakpointOptions } from "@cloakui/responsive";
import { getItemSpans } from "./helpers";
import type { ParsedMultiRowPattern, SpanPatternMirror } from "./types";

export type PatternData = {
  multiRowPattern: ParsedMultiRowPattern;
  columnCount: number;
};

/** Translate a content index to its pattern position, skipping spacer entries. */
export function getContentPatternIndex(
  index: number,
  { multiRowPattern, columnCount }: PatternData,
  mirror: SpanPatternMirror,
): number {
  const entries = multiRowPattern.flat();
  const contentCount = entries.filter((span) => !span.gap).length;
  if (contentCount === entries.length) return index;
  if (!contentCount) {
    throw new Error(
      'A grid pattern containing "+" must also contain a content span.',
    );
  }

  const cycleStart = Math.floor(index / contentCount) * entries.length;
  let remaining = index % contentCount;
  for (let offset = 0; offset < entries.length; offset++) {
    const patternIndex = cycleStart + offset;
    if (!getItemSpans(patternIndex, columnCount, multiRowPattern, mirror).gap) {
      if (remaining === 0) return patternIndex;
      remaining--;
    }
  }
  throw new Error("Unable to resolve grid content position.");
}

export type LayoutSlot = {
  itemIndex: number | null;
  /** Content index used for limits, including spacers beside that content. */
  limitIndex: number;
  patternIndices: BreakpointOptions<number | null>;
};

/** Merge breakpoint-specific spacers into one stable DOM order. */
export function getLayoutSlots(
  itemCount: number,
  patterns: BreakpointOptions<PatternData>,
  mirror: BreakpointOptions<SpanPatternMirror>,
): LayoutSlot[] {
  const slots: LayoutSlot[] = [];
  if (itemCount === 0) return slots;

  const cursors = Object.fromEntries(breakpoints.map((bp) => [bp, 0]));
  for (let itemIndex = 0; itemIndex <= itemCount; itemIndex++) {
    const gaps: BreakpointOptions<number[]> = {};
    const contentIndices: BreakpointOptions<number | null> = {};

    for (const bp of breakpoints) {
      const pattern = patterns[bp];
      const nextContent = getContentPatternIndex(
        itemIndex,
        pattern,
        mirror[bp],
      );
      const cycleLength = pattern.multiRowPattern.flat().length;
      // After the last child, finish trailing spacers in its current cycle only.
      const end =
        itemIndex === itemCount
          ? Math.min(
              nextContent,
              Math.ceil(cursors[bp] / cycleLength) * cycleLength,
            )
          : nextContent;
      gaps[bp] = Array.from(
        { length: Math.max(0, end - cursors[bp]) },
        (_, offset) => cursors[bp] + offset,
      );
      contentIndices[bp] = nextContent;
      cursors[bp] = nextContent + 1;
    }

    const gapCount = Math.max(...breakpoints.map((bp) => gaps[bp].length));
    for (let gapIndex = 0; gapIndex < gapCount; gapIndex++) {
      slots.push({
        itemIndex: null,
        limitIndex: Math.min(itemIndex, itemCount - 1),
        patternIndices: Object.fromEntries(
          breakpoints.map((bp) => [bp, gaps[bp][gapIndex] ?? null]),
        ),
      });
    }
    if (itemIndex < itemCount) {
      slots.push({
        itemIndex,
        limitIndex: itemIndex,
        patternIndices: contentIndices,
      });
    }
  }
  return slots;
}
