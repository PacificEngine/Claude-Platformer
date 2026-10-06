import { describe, expect, it } from 'vitest';
import { parseLevel, serializeLevel } from './format';

const SAMPLE = `
...c..
..?BM.
.P.gkF
######
`;

describe('parseLevel', () => {
  it('reads size and tiles', () => {
    const level = parseLevel(SAMPLE);
    expect(level.width).toBe(6);
    expect(level.height).toBe(4);
    expect(level.tiles[1][2]).toBe('coinBlock');
    expect(level.tiles[1][3]).toBe('brick');
    expect(level.tiles[1][4]).toBe('mushroomBlock');
    expect(level.tiles[3][0]).toBe('solid');
  });

  it('extracts entities and leaves their cell empty', () => {
    const level = parseLevel(SAMPLE);
    expect(level.spawn).toEqual({ col: 1, row: 2 });
    expect(level.flag).toEqual({ col: 5, row: 2 });
    expect(level.walkers).toEqual([{ col: 3, row: 2 }]);
    expect(level.shells).toEqual([{ col: 4, row: 2 }]);
    expect(level.coins).toEqual([{ col: 3, row: 0 }]);
    expect(level.tiles[2][3]).toBe('empty');
  });

  it('rejects an empty level', () => {
    expect(() => parseLevel('\n\n')).toThrow(/empty/);
  });

  it('rejects ragged rows', () => {
    expect(() => parseLevel('.P.F\n...\n####')).toThrow(/Row 1/);
  });

  it('rejects unknown glyphs', () => {
    expect(() => parseLevel('.Px.F\n#####')).toThrow(/Unknown glyph 'x'/);
  });

  it('requires exactly one start', () => {
    expect(() => parseLevel('....F\n#####')).toThrow(/exactly one P/);
    expect(() => parseLevel('.P.PF\n#####')).toThrow(/exactly one P/);
  });

  it('requires exactly one flag', () => {
    expect(() => parseLevel('.P...\n#####')).toThrow(/exactly one F/);
  });
});

describe('serializeLevel', () => {
  it('round-trips parse -> serialize', () => {
    expect(serializeLevel(parseLevel(SAMPLE))).toBe(SAMPLE.trim());
  });

  it('refuses tiles that have no glyph', () => {
    const level = parseLevel(SAMPLE);
    level.tiles[0][0] = 'used';
    expect(() => serializeLevel(level)).toThrow(/used/);
  });
});
