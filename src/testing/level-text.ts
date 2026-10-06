export type Edit = [col: number, row: number, glyph: string];

/**
 * Builds level text: `rows` rows (default 6), ground on the last row,
 * `P` at (1, rows-2), `F` at (width-1, rows-2). Edits are applied last.
 * `footer` lines (warp/secret/dark) are appended after a `---` line.
 */
export function levelText(width: number, edits: Edit[] = [], rows = 6, footer: string[] = []): string {
  const grid = Array.from({ length: rows }, () => Array<string>(width).fill('.'));
  grid[rows - 1].fill('#');
  grid[rows - 2][1] = 'P';
  grid[rows - 2][width - 1] = 'F';
  for (const [col, row, glyph] of edits) grid[row][col] = glyph;
  const body = grid.map((row) => row.join('')).join('\n');
  return footer.length > 0 ? `${body}\n---\n${footer.join('\n')}` : body;
}

/** Edits that set glyph on cols from..to (inclusive) of one row. */
export function span(from: number, to: number, row: number, glyph: string): Edit[] {
  return Array.from({ length: to - from + 1 }, (_, i): Edit => [from + i, row, glyph]);
}

/**
 * Edits for a 2-wide, 2-tall pipe: mouth (`<` or a digit id) on row `top`
 * (default 3) and body on the row below. On the default ground a player
 * standing on it has y = 2.
 */
export function pipeEdits(col: number, mouth: string, top = 3): Edit[] {
  return [
    [col, top, mouth],
    [col + 1, top, '>'],
    [col, top + 1, '('],
    [col + 1, top + 1, ')'],
  ];
}
