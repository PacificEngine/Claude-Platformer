import { describe, expect, it } from 'vitest';
import { parseLevel, serializeLevel } from './format';
import { levelText, pipeEdits } from '../testing/level-text';

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

describe('pipes and warps', () => {
  const PIPES = levelText(20, [...pipeEdits(3, '1'), ...pipeEdits(10, '2')], 6, ['warp 1 -> 2']);

  it('reads pipe pieces, mouth ids and warps', () => {
    const level = parseLevel(PIPES);
    expect(level.tiles[3][3]).toBe('pipeTL');
    expect(level.tiles[3][4]).toBe('pipeTR');
    expect(level.tiles[4][3]).toBe('pipeL');
    expect(level.tiles[4][4]).toBe('pipeR');
    expect(level.mouths).toEqual([{ id: 1, col: 3, row: 3 }, { id: 2, col: 10, row: 3 }]);
    expect(level.warps).toEqual([{ from: 1, to: 2 }]);
  });

  it('treats a plain < pipe as a mouth with no id', () => {
    const level = parseLevel(levelText(12, pipeEdits(3, '<')));
    expect(level.tiles[3][3]).toBe('pipeTL');
    expect(level.mouths).toEqual([]);
  });

  it('round-trips pipes, mouths and warps', () => {
    expect(serializeLevel(parseLevel(PIPES))).toBe(PIPES);
  });

  it('rejects a pipe top without its right half', () => {
    expect(() => parseLevel(levelText(12, [[3, 3, '<']]))).toThrow(/Malformed pipe/);
  });

  it('rejects a lone pipe right half', () => {
    expect(() => parseLevel(levelText(12, [[4, 3, '>']]))).toThrow(/Malformed pipe/);
  });

  it('rejects pipe body with no top above it', () => {
    expect(() => parseLevel(levelText(12, [[3, 4, '('], [4, 4, ')']]))).toThrow(/Malformed pipe/);
  });

  it('rejects duplicate mouth ids', () => {
    const edits = [...pipeEdits(3, '1'), ...pipeEdits(8, '1')];
    expect(() => parseLevel(levelText(14, edits))).toThrow(/Duplicate mouth id 1/);
  });

  it('rejects a warp naming an unknown mouth', () => {
    const text = levelText(12, pipeEdits(3, '1'), 6, ['warp 1 -> 9']);
    expect(() => parseLevel(text)).toThrow(/unknown mouth 9/);
  });

  it('rejects an unknown footer line', () => {
    expect(() => parseLevel(levelText(12, [], 6, ['bogus']))).toThrow(/Unknown footer line/);
  });
});

describe('hidden blocks and secrets', () => {
  it('reads hidden block glyphs and round-trips them', () => {
    const text = levelText(12, [[3, 3, 'h'], [4, 3, 'u'], [5, 3, 'm']]);
    const level = parseLevel(text);
    expect(level.tiles[3].slice(3, 6)).toEqual(['hiddenCoin', 'hiddenOneUp', 'hiddenMushroom']);
    expect(serializeLevel(level)).toBe(text);
  });

  it('links a hidden warp block to a mouth through a secret line', () => {
    const text = levelText(30, [[5, 3, 'w'], ...pipeEdits(20, '2')], 6, ['secret 1 -> 2']);
    const level = parseLevel(text);
    expect(level.tiles[3][5]).toBe('hiddenWarp');
    expect(level.secretWarps).toEqual([{ col: 5, row: 3, to: 2 }]);
    expect(serializeLevel(level)).toBe(text);
  });

  it('numbers secret lines in reading order', () => {
    const text = levelText(
      30,
      [[5, 2, 'w'], [9, 3, 'w'], ...pipeEdits(20, '2'), ...pipeEdits(24, '3')],
      6,
      ['secret 1 -> 3', 'secret 2 -> 2'],
    );
    expect(parseLevel(text).secretWarps).toEqual([
      { col: 5, row: 2, to: 3 },
      { col: 9, row: 3, to: 2 },
    ]);
  });

  it('rejects a hidden warp block with no secret line', () => {
    expect(() => parseLevel(levelText(12, [[5, 3, 'w']]))).toThrow(/needs a 'secret 1' line/);
  });

  it('rejects a secret line with no hidden warp block', () => {
    const text = levelText(12, pipeEdits(3, '2'), 6, ['secret 1 -> 2']);
    expect(() => parseLevel(text)).toThrow(/no matching hidden warp/);
  });
});

describe('dark ranges', () => {
  it('reads and round-trips dark column ranges', () => {
    const text = levelText(30, [], 6, ['dark 20-29']);
    const level = parseLevel(text);
    expect(level.dark).toEqual([{ from: 20, to: 29 }]);
    expect(serializeLevel(level)).toBe(text);
  });

  it('rejects a range outside the level', () => {
    expect(() => parseLevel(levelText(12, [], 6, ['dark 5-99']))).toThrow(/outside the level/);
  });
});
