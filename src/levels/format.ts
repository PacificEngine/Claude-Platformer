import type { Cell, Level, Tile } from '../core/types';

const GLYPH_TO_TILE: Record<string, Tile> = {
  '.': 'empty',
  '#': 'solid',
  B: 'brick',
  '?': 'coinBlock',
  M: 'mushroomBlock',
};

const TILE_TO_GLYPH: Partial<Record<Tile, string>> = {
  empty: '.',
  solid: '#',
  brick: 'B',
  coinBlock: '?',
  mushroomBlock: 'M',
};

export function parseLevel(text: string): Level {
  const rows = text
    .split('\n')
    .map((row) => row.trimEnd())
    .filter((row) => row.length > 0);
  if (rows.length === 0) throw new Error('Level is empty');

  const width = rows[0].length;
  const level: Level = {
    width,
    height: rows.length,
    tiles: [],
    spawn: { col: -1, row: -1 },
    flag: { col: -1, row: -1 },
    walkers: [],
    shells: [],
    coins: [],
  };
  let starts = 0;
  let flags = 0;

  rows.forEach((line, row) => {
    if (line.length !== width) {
      throw new Error(`Row ${row} has width ${line.length}, expected ${width}`);
    }
    const tileRow: Tile[] = [];
    [...line].forEach((glyph, col) => {
      const cell: Cell = { col, row };
      switch (glyph) {
        case 'P': level.spawn = cell; starts += 1; tileRow.push('empty'); return;
        case 'F': level.flag = cell; flags += 1; tileRow.push('empty'); return;
        case 'g': level.walkers.push(cell); tileRow.push('empty'); return;
        case 'k': level.shells.push(cell); tileRow.push('empty'); return;
        case 'c': level.coins.push(cell); tileRow.push('empty'); return;
      }
      const tile = GLYPH_TO_TILE[glyph];
      if (tile === undefined) {
        throw new Error(`Unknown glyph '${glyph}' at row ${row}, col ${col}`);
      }
      tileRow.push(tile);
    });
    level.tiles.push(tileRow);
  });

  if (starts !== 1) throw new Error(`Level needs exactly one P (found ${starts})`);
  if (flags !== 1) throw new Error(`Level needs exactly one F (found ${flags})`);
  return level;
}

export function serializeLevel(level: Level): string {
  const grid = level.tiles.map((row) =>
    row.map((tile) => {
      const glyph = TILE_TO_GLYPH[tile];
      if (glyph === undefined) throw new Error(`Tile '${tile}' has no level glyph`);
      return glyph;
    }),
  );
  const put = (cell: Cell, glyph: string) => {
    grid[cell.row][cell.col] = glyph;
  };
  put(level.spawn, 'P');
  put(level.flag, 'F');
  level.walkers.forEach((cell) => put(cell, 'g'));
  level.shells.forEach((cell) => put(cell, 'k'));
  level.coins.forEach((cell) => put(cell, 'c'));
  return grid.map((row) => row.join('')).join('\n');
}
