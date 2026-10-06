export const HEIGHT = 14;
export const GROUND_ROW = 12;

/** Authoring helper: draws a level and emits the text format `parseLevel` reads. */
export class LevelBuilder {
  private readonly cells: string[][];

  constructor(readonly width: number) {
    this.cells = Array.from({ length: HEIGHT }, () => Array<string>(width).fill('.'));
  }

  put(col: number, row: number, glyph: string): this {
    this.cells[row][col] = glyph;
    return this;
  }

  /** Solid ground on cols from..to (inclusive), from GROUND_ROW to the bottom. */
  ground(from: number, to: number): this {
    for (let col = from; col <= to; col++) {
      for (let row = GROUND_ROW; row < HEIGHT; row++) this.put(col, row, '#');
    }
    return this;
  }

  /** A column of solid tiles standing on the ground. */
  wall(col: number, tall: number): this {
    for (let i = 0; i < tall; i++) this.put(col, GROUND_ROW - 1 - i, '#');
    return this;
  }

  blocks(col: number, row: number, glyphs: string): this {
    [...glyphs].forEach((glyph, i) => this.put(col + i, row, glyph));
    return this;
  }

  enemy(col: number, glyph: 'g' | 'k'): this {
    return this.put(col, GROUND_ROW - 1, glyph);
  }

  coins(col: number, row: number, count: number): this {
    for (let i = 0; i < count; i++) this.put(col + i, row, 'c');
    return this;
  }

  start(col: number): this {
    return this.put(col, GROUND_ROW - 1, 'P');
  }

  flag(col: number, row: number): this {
    return this.put(col, row, 'F');
  }

  toText(): string {
    return this.cells.map((row) => row.join('')).join('\n');
  }
}
