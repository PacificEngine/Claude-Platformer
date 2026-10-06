import { describe, expect, it } from 'vitest';
import { DT, LEVEL_CLEAR_TIME, START_LIVES } from './constants';
import { growPlayer } from './growth';
import { levelText, playing, tick } from '../testing/helpers';
import type { GameState } from './types';

const clearTicks = Math.ceil(LEVEL_CLEAR_TIME / DT) + 2;

function runToFlag(s: GameState) {
  for (let i = 0; i < 400 && s.phase === 'playing'; i++) tick(s, { right: true, run: true });
}

describe('goal flag', () => {
  it('ends the level and awards a time bonus', () => {
    const s = playing(levelText(12));
    runToFlag(s);
    expect(s.phase).toBe('levelClear');
    expect(s.score).toBeGreaterThan(2500);
    expect(s.events.map((e) => e.type)).toContain('flag');
  });

  it('loads the next level, keeping the player\'s size', () => {
    const s = playing(levelText(12), levelText(14));
    tick(s, {}, 3);
    growPlayer(s.player);
    runToFlag(s);
    tick(s, {}, clearTicks);
    expect(s.phase).toBe('playing');
    expect(s.levelIndex).toBe(1);
    expect(s.width).toBe(14);
    expect(s.player.size).toBe('big');
    expect(s.player.h).toBe(2);
  });

  it('is won after the last level, and jump returns to the title', () => {
    const s = playing(levelText(12));
    runToFlag(s);
    tick(s, {}, clearTicks);
    expect(s.phase).toBe('won');
    tick(s, { jump: true });
    expect(s).toMatchObject({ phase: 'title', score: 0, lives: START_LIVES, levelIndex: 0 });
  });

  it('counts the clock down while playing', () => {
    const s = playing(levelText(30));
    const before = s.timeLeft;
    tick(s, {}, 60);
    expect(s.timeLeft).toBeCloseTo(before - 1);
  });
});
