import { describe, expect, it } from 'vitest';
import { parseLevel } from '../levels/format';
import { levelText } from '../testing/level-text';
import { START_LIVES } from './constants';
import { createGame, loadLevel, resetGame } from './state';

const level = (edits: Parameters<typeof levelText>[1] = []) => parseLevel(levelText(20, edits));

describe('createGame', () => {
  it('starts on the title screen with fresh counters', () => {
    const s = createGame([level()]);
    expect(s.phase).toBe('title');
    expect(s.lives).toBe(START_LIVES);
    expect(s.score).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.levelIndex).toBe(0);
  });

  it('places the player standing on the spawn cell', () => {
    const s = createGame([level()]);
    expect(s.player.size).toBe('small');
    expect(s.player.y + s.player.h).toBeCloseTo(5);
    expect(s.player.x).toBeGreaterThan(1);
    expect(s.player.x + s.player.w).toBeLessThan(2);
  });

  it('spawns enemies and coins from the level', () => {
    const s = createGame([level([[8, 4, 'g'], [10, 4, 'k'], [12, 3, 'c']])]);
    expect(s.enemies.map((e) => e.kind)).toEqual(['walker', 'shell']);
    expect(s.coinPickups).toEqual([{ col: 12, row: 3 }]);
  });

  it('builds the flag pole from the flag cell down to the ground', () => {
    const s = createGame([level()]);
    expect(s.flag.y).toBe(4);
    expect(s.flag.h).toBe(1);
    expect(s.flag.x).toBeCloseTo(19.35);
  });

  it('copies tiles so play never mutates the level definition', () => {
    const lvl = level([[5, 3, '?']]);
    const s = createGame([lvl]);
    s.tiles[3][5] = 'used';
    expect(lvl.tiles[3][5]).toBe('coinBlock');
  });
});

describe('loadLevel', () => {
  it('keeps a big player big and sizes the body to match', () => {
    const s = createGame([level(), level()]);
    loadLevel(s, 1, 'big');
    expect(s.levelIndex).toBe(1);
    expect(s.player.size).toBe('big');
    expect(s.player.h).toBe(2);
    expect(s.player.y + s.player.h).toBeCloseTo(5);
  });
});

describe('resetGame', () => {
  it('returns to a fresh title state', () => {
    const s = createGame([level(), level()]);
    Object.assign(s, { phase: 'gameOver', score: 900, coins: 4, lives: 0, levelIndex: 1 });
    resetGame(s);
    expect(s).toMatchObject({ phase: 'title', score: 0, coins: 0, lives: START_LIVES, levelIndex: 0 });
  });
});
