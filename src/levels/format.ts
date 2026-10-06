import type { Cell, Level, Tile } from '../core/types';

const GLYPH_TO_TILE: Record<string, Tile> = {
  '.': 'empty',
  '#': 'solid',
  B: 'brick',
  '?': 'coinBlock',
  M: 'mushroomBlock',
  '<': 'pipeTL',
  '>': 'pipeTR',
  '(': 'pipeL',
  ')': 'pipeR',
  h: 'hiddenCoin',
  u: 'hiddenOneUp',
  m: 'hiddenMushroom',
  w: 'hiddenWarp',
};

const TILE_TO_GLYPH: Partial<Record<Tile, string>> = {
  empty: '.',
  solid: '#',
  brick: 'B',
  coinBlock: '?',
  mushroomBlock: 'M',
  pipeTL: '<',
  pipeTR: '>',
  pipeL: '(',
  pipeR: ')',
  hiddenCoin: 'h',
  hiddenOneUp: 'u',
  hiddenMushroom: 'm',
  hiddenWarp: 'w',
};

const MOUTH_GLYPH = /^[1-9]$/;

function validatePipes(tiles: Tile[][]): void {
  const at = (col: number, row: number): Tile | undefined => tiles[row]?.[col];
  tiles.forEach((tileRow, row) => {
    tileRow.forEach((tile, col) => {
      const above = at(col, row - 1);
      const ok =
        tile === 'pipeTL' ? at(col + 1, row) === 'pipeTR'
        : tile === 'pipeTR' ? at(col - 1, row) === 'pipeTL'
        : tile === 'pipeL' ? (above === 'pipeTL' || above === 'pipeL') && at(col + 1, row) === 'pipeR'
        : tile === 'pipeR' ? (above === 'pipeTR' || above === 'pipeR') && at(col - 1, row) === 'pipeL'
        : true;
      if (!ok) throw new Error(`Malformed pipe at row ${row}, col ${col}`);
    });
  });
}

function parseFooter(level: Level, footer: string[], hiddenWarps: Cell[]): void {
  const mouthIds = new Set(level.mouths.map((mouth) => mouth.id));
  const secrets = new Map<number, number>();

  for (const line of footer) {
    let match: RegExpMatchArray | null;
    if ((match = line.match(/^warp (\d+) -> (\d+)$/))) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      for (const id of [from, to]) {
        if (!mouthIds.has(id)) throw new Error(`warp references unknown mouth ${id}`);
      }
      level.warps.push({ from, to });
    } else if ((match = line.match(/^secret (\d+) -> (\d+)$/))) {
      const n = Number(match[1]);
      const to = Number(match[2]);
      if (n < 1 || n > hiddenWarps.length) throw new Error(`secret ${n} has no matching hidden warp block`);
      if (secrets.has(n)) throw new Error(`secret ${n} is declared twice`);
      if (!mouthIds.has(to)) throw new Error(`secret ${n} references unknown mouth ${to}`);
      secrets.set(n, to);
    } else if ((match = line.match(/^dark (\d+)-(\d+)$/))) {
      const from = Number(match[1]);
      const to = Number(match[2]);
      if (from > to || to >= level.width) throw new Error(`dark range ${from}-${to} is outside the level`);
      level.dark.push({ from, to });
    } else {
      throw new Error(`Unknown footer line: ${line}`);
    }
  }

  hiddenWarps.forEach((cell, i) => {
    const to = secrets.get(i + 1);
    if (to === undefined) {
      throw new Error(`Hidden warp block at row ${cell.row}, col ${cell.col} needs a 'secret ${i + 1}' line`);
    }
    level.secretWarps.push({ col: cell.col, row: cell.row, to });
  });
}

export function parseLevel(text: string): Level {
  const lines = text.split('\n').map((line) => line.trimEnd());
  const separator = lines.indexOf('---');
  const rows = (separator === -1 ? lines : lines.slice(0, separator)).filter((row) => row.length > 0);
  const footer = (separator === -1 ? [] : lines.slice(separator + 1)).filter((line) => line.length > 0);
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
    mouths: [],
    warps: [],
    secretWarps: [],
    dark: [],
  };
  const hiddenWarps: Cell[] = [];
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
      if (MOUTH_GLYPH.test(glyph)) {
        const id = Number(glyph);
        if (level.mouths.some((mouth) => mouth.id === id)) throw new Error(`Duplicate mouth id ${id}`);
        level.mouths.push({ id, col, row });
        tileRow.push('pipeTL');
        return;
      }
      const tile = GLYPH_TO_TILE[glyph];
      if (tile === undefined) {
        throw new Error(`Unknown glyph '${glyph}' at row ${row}, col ${col}`);
      }
      if (tile === 'hiddenWarp') hiddenWarps.push(cell);
      tileRow.push(tile);
    });
    level.tiles.push(tileRow);
  });

  if (starts !== 1) throw new Error(`Level needs exactly one P (found ${starts})`);
  if (flags !== 1) throw new Error(`Level needs exactly one F (found ${flags})`);
  validatePipes(level.tiles);
  parseFooter(level, footer, hiddenWarps);
  return level;
}

export function serializeLevel(level: Level): string {
  const mouthIds = new Map(level.mouths.map((mouth) => [`${mouth.col},${mouth.row}`, mouth.id]));
  const grid = level.tiles.map((row, r) =>
    row.map((tile, c) => {
      const mouthId = tile === 'pipeTL' ? mouthIds.get(`${c},${r}`) : undefined;
      if (mouthId !== undefined) return String(mouthId);
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

  const footer = [
    ...[...level.warps]
      .sort((a, b) => a.from - b.from || a.to - b.to)
      .map((warp) => `warp ${warp.from} -> ${warp.to}`),
    ...level.secretWarps.map((secret, i) => `secret ${i + 1} -> ${secret.to}`),
    ...[...level.dark].sort((a, b) => a.from - b.from).map((range) => `dark ${range.from}-${range.to}`),
  ];
  const body = grid.map((row) => row.join('')).join('\n');
  return footer.length > 0 ? `${body}\n---\n${footer.join('\n')}` : body;
}
