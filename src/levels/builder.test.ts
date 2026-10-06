import { describe, expect, it } from 'vitest';
import { parseLevel } from './format';
import { GROUND_ROW, HEIGHT, LevelBuilder } from './builder';

describe('LevelBuilder', () => {
  const level = parseLevel(
    new LevelBuilder(10)
      .ground(0, 4)
      .ground(7, 9)
      .start(1)
      .wall(3, 2)
      .blocks(2, 8, '?B')
      .enemy(8, 'g')
      .enemy(4, 'k')
      .coins(5, 9, 2)
      .flag(9, 4)
      .toText(),
  );

  it('emits a full-height grid', () => {
    expect(level.width).toBe(10);
    expect(level.height).toBe(HEIGHT);
  });

  it('lays ground only where asked, leaving gaps', () => {
    expect(level.tiles[GROUND_ROW][0]).toBe('solid');
    expect(level.tiles[GROUND_ROW][5]).toBe('empty');
    expect(level.tiles[HEIGHT - 1][8]).toBe('solid');
  });

  it('stacks walls on the ground', () => {
    expect(level.tiles[GROUND_ROW - 1][3]).toBe('solid');
    expect(level.tiles[GROUND_ROW - 2][3]).toBe('solid');
    expect(level.tiles[GROUND_ROW - 3][3]).toBe('empty');
  });

  it('places blocks, entities and the flag', () => {
    expect(level.tiles[8][2]).toBe('coinBlock');
    expect(level.tiles[8][3]).toBe('brick');
    expect(level.spawn).toEqual({ col: 1, row: GROUND_ROW - 1 });
    expect(level.walkers).toEqual([{ col: 8, row: GROUND_ROW - 1 }]);
    expect(level.shells).toEqual([{ col: 4, row: GROUND_ROW - 1 }]);
    expect(level.coins).toEqual([{ col: 5, row: 9 }, { col: 6, row: 9 }]);
    expect(level.flag).toEqual({ col: 9, row: 4 });
  });
});
