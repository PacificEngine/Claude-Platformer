import { describe, expect, it } from 'vitest';
import { parseLevel } from '../levels/format';
import { levelText } from '../testing/level-text';
import { moveBody, overlaps, solidAt } from './physics';
import type { Body } from './types';

const tilesOf = (text: string) => parseLevel(text).tiles;
const body = (o: Partial<Body>): Body => ({ x: 0, y: 0, w: 0.75, h: 1, vx: 0, vy: 0, ...o });

describe('solidAt', () => {
  const tiles = tilesOf(levelText(10));
  it('treats ground as solid and air as empty', () => {
    expect(solidAt(tiles, 3, 5)).toBe(true);
    expect(solidAt(tiles, 3, 4)).toBe(false);
  });
  it('treats the left and right world edges as walls', () => {
    expect(solidAt(tiles, -1, 0)).toBe(true);
    expect(solidAt(tiles, 10, 0)).toBe(true);
  });
  it('treats above and below the world as open', () => {
    expect(solidAt(tiles, 3, -1)).toBe(false);
    expect(solidAt(tiles, 3, 6)).toBe(false);
  });
});

describe('moveBody', () => {
  it('lands on the ground and snaps flush to it', () => {
    const tiles = tilesOf(levelText(10));
    const b = body({ x: 3, y: 3, vy: 12 });
    let landed = false;
    for (let i = 0; i < 60 && !landed; i++) landed = moveBody(b, tiles).landed;
    expect(landed).toBe(true);
    expect(b.y).toBeCloseTo(4);
    expect(b.vy).toBe(0);
  });

  it('reports landing when resting with a small downward velocity', () => {
    const tiles = tilesOf(levelText(10));
    const b = body({ x: 3, y: 4, vy: 0.9 });
    expect(moveBody(b, tiles).landed).toBe(true);
    expect(b.y).toBeCloseTo(4);
  });

  it('stops against a wall on the right', () => {
    const tiles = tilesOf(levelText(10, [[6, 4, '#']]));
    const b = body({ x: 4, y: 4 });
    let hit = false;
    for (let i = 0; i < 20; i++) {
      b.vx = 8;
      hit ||= moveBody(b, tiles).hitX;
    }
    expect(hit).toBe(true);
    expect(b.x).toBeCloseTo(6 - 0.75);
  });

  it('stops against a wall on the left', () => {
    const tiles = tilesOf(levelText(10, [[2, 4, '#']]));
    const b = body({ x: 4, y: 4 });
    let hit = false;
    for (let i = 0; i < 20; i++) {
      b.vx = -8;
      hit ||= moveBody(b, tiles).hitX;
    }
    expect(hit).toBe(true);
    expect(b.x).toBeCloseTo(3);
  });

  it('bonks its head on a block and reports which one', () => {
    const tiles = tilesOf(levelText(10, [[5, 3, '#']]));
    const b = body({ x: 5.1, y: 4, vy: -10 });
    const result = moveBody(b, tiles);
    expect(result.bonk).toEqual({ col: 5, row: 3 });
    expect(b.y).toBeCloseTo(4);
    expect(b.vy).toBe(0);
  });

  it('picks the block nearest the body center when straddling two', () => {
    const tiles = tilesOf(levelText(10, [[5, 3, '#'], [6, 3, '#']]));
    const b = body({ x: 5.6, y: 4, vy: -10 });
    expect(moveBody(b, tiles).bonk).toEqual({ col: 5, row: 3 });
  });
});

describe('overlaps', () => {
  it('detects intersecting rects and ignores touching edges', () => {
    const a = { x: 0, y: 0, w: 1, h: 1 };
    expect(overlaps(a, { x: 0.5, y: 0.5, w: 1, h: 1 })).toBe(true);
    expect(overlaps(a, { x: 1, y: 0, w: 1, h: 1 })).toBe(false);
  });
});
