import { describe, expect, it } from 'vitest';
import { START_LIVES } from '../core/constants';
import { step } from '../core/game';
import { createGame } from '../core/state';
import type { GameState, Level, Tile } from '../core/types';
import { createBot } from '../testing/bot';
import { tick } from '../testing/helpers';
import { parseLevel, serializeLevel } from './format';
import { builtinLevelTexts, builtinLevels } from './builtin';

const allLevels = (): Level[] => [0, 1, 2].map((i) => builtinLevels.get(i));

describe('built-in levels', () => {
  it('ships three levels', () => {
    expect(builtinLevels.count()).toBe(3);
  });

  it.each(builtinLevelTexts.map((text, i) => [i + 1, text] as const))(
    'level %i is valid text that round-trips',
    (_n, text) => {
      expect(serializeLevel(parseLevel(text))).toBe(text.trim());
    },
  );
});

describe('level design rules', () => {
  const GROUND_ROW = 12;

  it.each([0, 1, 2])('level %i has gaps of at most 4 and walls of at most 3', (index) => {
    const level = builtinLevels.get(index);
    let run = 0;
    for (let col = 0; col <= level.flag.col; col++) {
      run = level.tiles[GROUND_ROW][col] === 'empty' ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(4);

      let tall = 0;
      for (let row = GROUND_ROW - 1; row >= 0 && level.tiles[row][col] !== 'empty'; row--) tall += 1;
      expect(tall).toBeLessThanOrEqual(3);
    }
  });

  it.each([0, 1, 2])('level %i leaves room above every pipe for a big player', (index) => {
    const level = builtinLevels.get(index);
    for (const mouth of level.mouths) {
      for (const col of [mouth.col, mouth.col + 1]) {
        for (let up = 1; up <= 3; up++) expect(level.tiles[mouth.row - up][col]).toBe('empty');
      }
    }
  });

  it.each([0, 1, 2])('level %i has its bonus rooms to the right of the flag', (index) => {
    const level = builtinLevels.get(index);
    expect(level.dark.length).toBeGreaterThan(0);
    for (const range of level.dark) expect(range.from).toBeGreaterThan(level.flag.col);
  });
});

describe('level features', () => {
  const count = (kind: Tile) => allLevels().flatMap((l) => l.tiles.flat()).filter((t) => t === kind).length;

  it.each(['hiddenCoin', 'hiddenOneUp', 'hiddenMushroom', 'hiddenWarp'] as const)(
    'contains a %s somewhere',
    (kind) => {
      expect(count(kind)).toBeGreaterThan(0);
    },
  );

  it.each([0, 1, 2])('level %i has an in-level warp and a bonus-room warp', (index) => {
    const level = builtinLevels.get(index);
    const col = (id: number) => level.mouths.find((m) => m.id === id)!.col;
    expect(level.warps.some((w) => col(w.from) <= level.flag.col && col(w.to) <= level.flag.col)).toBe(true);
    expect(level.warps.some((w) => col(w.to) > level.flag.col)).toBe(true);
  });
});

describe('scripted warps', () => {
  function standOnMouth(index: number, id: number): GameState {
    const level = builtinLevels.get(index);
    const s = createGame([level]);
    s.phase = 'playing';
    const mouth = level.mouths.find((m) => m.id === id)!;
    s.player.x = mouth.col + 1 - s.player.w / 2;
    s.player.y = mouth.row - s.player.h;
    s.cameraX = Math.max(0, mouth.col - 8);
    tick(s, {}, 3);
    return s;
  }

  it('the level 1 shortcut pipe leads to its exit pipe', () => {
    const s = standOnMouth(0, 1);
    const exit = builtinLevels.get(0).mouths.find((m) => m.id === 2)!;
    tick(s, { down: true }, 1);
    tick(s, {}, 60);
    expect(s.phase).toBe('playing');
    expect(s.player.x + s.player.w / 2).toBeCloseTo(exit.col + 1, 1);
  });

  it('a bonus room round trip returns to the entrance pipe', () => {
    const level = builtinLevels.get(0);
    const entrance = level.mouths.find((m) => m.id === 3)!;
    const s = standOnMouth(0, 3);
    tick(s, { down: true }, 1);
    tick(s, {}, 60);
    expect(s.player.x).toBeGreaterThan(level.dark[0].from);
    expect(s.cameraX).toBe(level.dark[0].from);
    tick(s, {}, 1);
    tick(s, { down: true }, 1);
    tick(s, {}, 60);
    expect(s.phase).toBe('playing');
    expect(s.player.x + s.player.w / 2).toBeCloseTo(entrance.col + 1, 1);
  });
});

describe('replay: every level is completable', () => {
  const MAX_TICKS = 60 * 120;

  it.each([0, 1, 2])('a simple bot beats level %i without dying', (index) => {
    const s = createGame([builtinLevels.get(index)]);
    s.phase = 'playing';
    const bot = createBot();
    while (s.phase !== ('won' as GameState['phase']) && s.phase !== ('gameOver' as GameState['phase']) && s.tick < MAX_TICKS) {
      step(s, bot(s));
    }
    expect({ phase: s.phase, lives: s.lives, x: Math.round(s.player.x) }).toMatchObject({
      phase: 'won',
      lives: START_LIVES,
    });
  });
});
