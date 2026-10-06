import { describe, expect, it } from 'vitest';
import { parseLevel, serializeLevel } from './format';
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

describe('LevelBuilder: pipes, rooms and secrets', () => {
  const text = new LevelBuilder(40)
    .ground(0, 23)
    .start(1)
    .flag(22, 4)
    .pipe(5, 3, 1)
    .pipe(10, 2, 2)
    .warp(1, 2)
    .stairs(14, 3)
    .platform(16, 8, 2)
    .hidden(18, 8, 'coin')
    .room(24, 39)
    .toText();
  const level = parseLevel(text);

  it('builds pipes with labelled mouths standing on the ground', () => {
    expect(level.mouths).toEqual([{ id: 1, col: 5, row: 9 }, { id: 2, col: 10, row: 10 }]);
    expect(level.tiles[9][5]).toBe('pipeTL');
    expect(level.tiles[9][6]).toBe('pipeTR');
    expect(level.tiles[10][5]).toBe('pipeL');
    expect(level.tiles[11][6]).toBe('pipeR');
    expect(level.warps).toEqual([{ from: 1, to: 2 }]);
  });

  it('builds ascending stairs', () => {
    expect(level.tiles[11][14]).toBe('solid');
    expect(level.tiles[10][14]).toBe('empty');
    expect(level.tiles[10][15]).toBe('solid');
    expect(level.tiles[9][15]).toBe('empty');
    expect(level.tiles[9][16]).toBe('solid');
  });

  it('builds descending stairs with dir -1', () => {
    const down = parseLevel(new LevelBuilder(10).ground(0, 9).start(0).flag(9, 4).stairs(6, 3, -1).toText());
    expect(down.tiles[11][6]).toBe('solid');
    expect(down.tiles[10][6]).toBe('empty');
    expect(down.tiles[10][5]).toBe('solid');
    expect(down.tiles[9][4]).toBe('solid');
  });

  it('places platforms and hidden blocks', () => {
    expect(level.tiles[8][16]).toBe('solid');
    expect(level.tiles[8][17]).toBe('solid');
    expect(level.tiles[8][18]).toBe('hiddenCoin');
  });

  it('seals a bonus room and marks it dark', () => {
    expect(level.dark).toEqual([{ from: 24, to: 39 }]);
    expect(level.tiles[0][30]).toBe('solid'); // ceiling
    expect(level.tiles[8][24]).toBe('solid'); // left wall
    expect(level.tiles[8][39]).toBe('solid'); // right wall
    expect(level.tiles[12][30]).toBe('solid'); // floor
    expect(level.tiles[8][30]).toBe('empty'); // interior
  });

  it('round-trips through the canonical footer', () => {
    expect(serializeLevel(level)).toBe(text);
  });

  it('numbers secret links in the footer', () => {
    const secretText = new LevelBuilder(30)
      .ground(0, 29)
      .start(1)
      .flag(28, 4)
      .hidden(5, 8, 'warp')
      .pipe(10, 2, 3)
      .secret(1, 3)
      .toText();
    expect(parseLevel(secretText).secretWarps).toEqual([{ col: 5, row: 8, to: 3 }]);
  });
});
