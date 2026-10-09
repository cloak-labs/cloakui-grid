import type { ParsedMultiRowPattern, ParsedSpan, SpanValue } from "./types";

type Dimension = { start?: number; length: number };
type Rect = { row: number; col: number; height: number; width: number };
export type CyclePlacement = { spans: ParsedSpan[]; height: number };

const cache = new WeakMap<
  ParsedMultiRowPattern,
  Map<string, CyclePlacement | null>
>();

function dimension(value: SpanValue, columns?: number): Dimension | null {
  if (typeof value === "string" && value.includes("/")) {
    let [start, end] = value.split("/").map(Number);
    // Negative column lines refer to the end of the explicit column grid.
    if (columns !== undefined) {
      if (start < 0) start = columns + 2 + start;
      if (end < 0) end = columns + 2 + end;
    }
    if (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start > 0 &&
      end > start
    ) {
      return { start, length: end - start };
    }
    return null;
  }
  const length = Number(value);
  return Number.isInteger(length) && length > 0 ? { length } : null;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.row < b.row + b.height &&
    b.row < a.row + a.height &&
    a.col < b.col + b.width &&
    b.col < a.col + a.width
  );
}

/**
 * Resolve one cycle using CSS Grid's row auto-placement phases. Only patterns
 * with explicit rows need a fixed footprint; ordinary grids retain CSS flow.
 * https://www.w3.org/TR/css-grid-1/#auto-placement-algo
 */
export function getCyclePlacement(
  pattern: ParsedMultiRowPattern,
  columns: number,
  mirrored: boolean,
  dense: boolean,
): CyclePlacement | null {
  const key = `${columns}:${mirrored}:${dense}`;
  let plans = cache.get(pattern);
  if (!plans) cache.set(pattern, (plans = new Map()));
  if (plans.has(key)) return plans.get(key);

  const spans = pattern.flatMap((row) => (mirrored ? [...row].reverse() : row));
  if (
    !spans.some(
      (span) => typeof span.row === "string" && span.row.includes("/"),
    )
  ) {
    plans.set(key, null);
    return null;
  }
  const items = spans.map((span, index) => ({
    index,
    hidden: span.col === "_" || span.row === "_",
    col: dimension(span.col, columns),
    row: dimension(span.row),
  }));
  // Open-ended/negative row lines have no finite cycle height; leave those
  // anchored to their supplied CSS lines rather than guessing an offset.
  if (items.some((item) => !item.hidden && (!item.col || !item.row))) {
    plans.set(key, null);
    return null;
  }

  const occupied: Rect[] = [];
  const positions = new Map<number, Rect>();
  const fits = (rect: Rect) => !occupied.some((other) => overlaps(rect, other));
  const put = (index: number, rect: Rect) => {
    occupied.push(rect);
    positions.set(index, rect);
  };

  // Fully definite items occupy their cells before any auto-placement.
  for (const item of items) {
    if (
      !item.hidden &&
      item.row.start !== undefined &&
      item.col.start !== undefined
    ) {
      put(item.index, {
        row: item.row.start,
        col: item.col.start,
        height: item.row.length,
        width: item.col.length,
      });
    }
  }

  const rowLocked: Rect[] = [];
  for (const item of items) {
    if (
      item.hidden ||
      positions.has(item.index) ||
      item.row.start === undefined
    )
      continue;
    const rect: Rect = {
      row: item.row.start,
      col: 1,
      height: item.row.length,
      width: item.col.length,
    };
    if (!dense) {
      for (const previous of rowLocked) {
        if (
          rect.row < previous.row + previous.height &&
          previous.row < rect.row + rect.height
        ) {
          rect.col = Math.max(rect.col, previous.col + previous.width);
        }
      }
    }
    while (!fits(rect)) rect.col++;
    put(item.index, rect);
    rowLocked.push(rect);
  }

  const columnCount = Math.max(
    columns,
    ...occupied.map((rect) => rect.col + rect.width - 1),
    ...items
      .filter((item) => !item.hidden)
      .map((item) =>
        item.col.start === undefined
          ? item.col.length
          : item.col.start + item.col.length - 1,
      ),
  );
  let row = 1;
  let col = 1;
  for (const item of items) {
    if (item.hidden || positions.has(item.index)) continue;
    if (dense) {
      row = 1;
      col = 1;
    }
    const rect: Rect = {
      row,
      col,
      height: item.row.length,
      width: item.col.length,
    };
    if (item.col.start !== undefined) {
      if (!dense && item.col.start < col) row++;
      col = item.col.start;
      rect.col = col;
      rect.row = row;
      while (!fits(rect)) rect.row++;
    } else {
      while (true) {
        if (rect.col + rect.width - 1 > columnCount) {
          rect.row++;
          rect.col = 1;
        } else if (fits(rect)) break;
        else rect.col++;
      }
    }
    put(item.index, rect);
    row = rect.row;
    col = rect.col;
  }

  const plan: CyclePlacement = {
    spans: spans.map((span, index) => {
      const rect = positions.get(index);
      return rect
        ? {
            ...span,
            col: `${rect.col}/${rect.col + rect.width}`,
            row: `${rect.row}/${rect.row + rect.height}`,
          }
        : span;
    }),
    height: Math.max(1, ...occupied.map((rect) => rect.row + rect.height - 1)),
  };
  plans.set(key, plan);
  return plan;
}
