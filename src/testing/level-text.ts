export type Edit = [col: number, row: number, glyph: string];

/**
 * Builds level text: `rows` rows (default 6), ground on the last row,
 * `P` at (1, rows-2), `F` at (width-1, rows-2). Edits are applied last.
 */
export function levelText(width: number, edits: Edit[] = [], rows = 6): string {
  const grid = Array.from({ length: rows }, () => Array<string>(width).fill('.'));
  grid[rows - 1].fill('#');
  grid[rows - 2][1] = 'P';
  grid[rows - 2][width - 1] = 'F';
  for (const [col, row, glyph] of edits) grid[row][col] = glyph;
  return grid.map((row) => row.join('')).join('\n');
}

/** Edits that set glyph on cols from..to (inclusive) of one row. */
export function span(from: number, to: number, row: number, glyph: string): Edit[] {
  return Array.from({ length: to - from + 1 }, (_, i): Edit => [from + i, row, glyph]);
}
