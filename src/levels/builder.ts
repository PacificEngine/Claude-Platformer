export const HEIGHT = 14;
export const GROUND_ROW = 12;

const ROOM_CEILING_LAST_ROW = 3;

const HIDDEN_GLYPH = { coin: 'h', oneUp: 'u', mushroom: 'm', warp: 'w' } as const;
export type HiddenKind = keyof typeof HIDDEN_GLYPH;

/** Authoring helper: draws a level and emits the text format `parseLevel` reads. */
export class LevelBuilder {
  private readonly cells: string[][];
  private readonly warps: Array<[from: number, to: number]> = [];
  private readonly secrets: Array<[n: number, to: number]> = [];
  private readonly darkRanges: Array<[from: number, to: number]> = [];

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

  /** Stairs of `steps` columns: heights 1..steps rising to the right (dir 1) or falling to the right (dir -1). */
  stairs(col: number, steps: number, dir: 1 | -1 = 1): this {
    for (let i = 0; i < steps; i++) this.wall(col + dir * i, i + 1);
    return this;
  }

  /** A floating run of `length` tiles on `row`. */
  platform(col: number, row: number, length: number, glyph = '#'): this {
    for (let i = 0; i < length; i++) this.put(col + i, row, glyph);
    return this;
  }

  blocks(col: number, row: number, glyphs: string): this {
    [...glyphs].forEach((glyph, i) => this.put(col + i, row, glyph));
    return this;
  }

  hidden(col: number, row: number, kind: HiddenKind): this {
    return this.put(col, row, HIDDEN_GLYPH[kind]);
  }

  /** A 2-wide pipe standing on the ground; its mouth is labelled `id` (or plain `<` without one). */
  pipe(col: number, tall: number, id?: number): this {
    const top = GROUND_ROW - tall;
    this.put(col, top, id === undefined ? '<' : String(id));
    this.put(col + 1, top, '>');
    for (let row = top + 1; row < GROUND_ROW; row++) {
      this.put(col, row, '(');
      this.put(col + 1, row, ')');
    }
    return this;
  }

  warp(from: number, to: number): this {
    this.warps.push([from, to]);
    return this;
  }

  /** Link the n-th hidden warp block (reading order) to mouth `to`. */
  secret(n: number, to: number): this {
    this.secrets.push([n, to]);
    return this;
  }

  dark(from: number, to: number): this {
    this.darkRanges.push([from, to]);
    return this;
  }

  /** A sealed bonus room on cols from..to: ceiling, both walls, floor, and a dark look. */
  room(from: number, to: number): this {
    for (let col = from; col <= to; col++) {
      for (let row = 0; row <= ROOM_CEILING_LAST_ROW; row++) this.put(col, row, '#');
    }
    for (let row = 0; row < HEIGHT; row++) {
      this.put(from, row, '#');
      this.put(to, row, '#');
    }
    this.ground(from, to);
    return this.dark(from, to);
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
    const body = this.cells.map((row) => row.join('')).join('\n');
    const footer = [
      ...[...this.warps].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([from, to]) => `warp ${from} -> ${to}`),
      ...[...this.secrets].sort((a, b) => a[0] - b[0]).map(([n, to]) => `secret ${n} -> ${to}`),
      ...[...this.darkRanges].sort((a, b) => a[0] - b[0]).map(([from, to]) => `dark ${from}-${to}`),
    ];
    return footer.length > 0 ? `${body}\n---\n${footer.join('\n')}` : body;
  }
}
