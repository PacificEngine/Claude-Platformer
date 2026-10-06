import { DT } from './constants';
import type { Body, Cell, Rect, Tile } from './types';

const EPS = 1e-6;

const HIDDEN: ReadonlySet<Tile> = new Set<Tile>(['hiddenCoin', 'hiddenOneUp', 'hiddenMushroom', 'hiddenWarp']);

export interface MoveResult {
  hitX: boolean;
  landed: boolean;
  bonk: Cell | null;
}

export interface MoveOptions {
  /** Let an upward-moving head bump hidden tiles from below (the player only). */
  bumpHidden?: boolean;
}

export function solidAt(tiles: Tile[][], col: number, row: number): boolean {
  if (col < 0 || col >= tiles[0].length) return true;
  if (row < 0 || row >= tiles.length) return false;
  const tile = tiles[row][col];
  return tile !== 'empty' && !HIDDEN.has(tile);
}

function overlapsSolid(b: Body, tiles: Tile[][]): boolean {
  for (let row = Math.floor(b.y); row <= Math.floor(b.y + b.h - EPS); row++) {
    for (let col = Math.floor(b.x); col <= Math.floor(b.x + b.w - EPS); col++) {
      if (solidAt(tiles, col, row)) return true;
    }
  }
  return false;
}

function bonkedCell(b: Body, tiles: Tile[][]): Cell | null {
  const row = Math.floor(b.y);
  const center = b.x + b.w / 2;
  let best: Cell | null = null;
  let bestDistance = Infinity;
  for (let col = Math.floor(b.x); col <= Math.floor(b.x + b.w - EPS); col++) {
    if (!solidAt(tiles, col, row)) continue;
    const distance = Math.abs(col + 0.5 - center);
    if (distance < bestDistance) {
      best = { col, row };
      bestDistance = distance;
    }
  }
  return best;
}

/** The hidden tile the head just rose into from below, if any. */
function hiddenBumpCell(b: Body, previousY: number, tiles: Tile[][]): Cell | null {
  const row = Math.floor(b.y);
  if (row < 0 || row >= tiles.length) return null;
  if (previousY < row + 1 - EPS) return null; // the head started inside the tile
  const center = b.x + b.w / 2;
  let best: Cell | null = null;
  let bestDistance = Infinity;
  for (let col = Math.floor(b.x); col <= Math.floor(b.x + b.w - EPS); col++) {
    const tile = tiles[row]?.[col];
    if (tile === undefined || !HIDDEN.has(tile)) continue;
    const distance = Math.abs(col + 0.5 - center);
    if (distance < bestDistance) {
      best = { col, row };
      bestDistance = distance;
    }
  }
  return best;
}

/** Moves one tick: X axis first, then Y. Mutates the body. */
export function moveBody(b: Body, tiles: Tile[][], options: MoveOptions = {}): MoveResult {
  const result: MoveResult = { hitX: false, landed: false, bonk: null };

  b.x += b.vx * DT;
  if (b.vx !== 0 && overlapsSolid(b, tiles)) {
    b.x = b.vx > 0 ? Math.floor(b.x + b.w - EPS) - b.w : Math.floor(b.x) + 1;
    b.vx = 0;
    result.hitX = true;
  }

  const previousY = b.y;
  b.y += b.vy * DT;
  if (b.vy !== 0 && overlapsSolid(b, tiles)) {
    if (b.vy > 0) {
      b.y = Math.floor(b.y + b.h - EPS) - b.h;
      result.landed = true;
    } else {
      result.bonk = bonkedCell(b, tiles);
      b.y = Math.floor(b.y) + 1;
    }
    b.vy = 0;
  } else if (options.bumpHidden && b.vy < 0) {
    const cell = hiddenBumpCell(b, previousY, tiles);
    if (cell) {
      result.bonk = cell;
      b.y = cell.row + 1;
      b.vy = 0;
    }
  }
  return result;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
