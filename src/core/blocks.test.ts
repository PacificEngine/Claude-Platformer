import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, tick } from '../testing/helpers';
import { addCoin, hitBlock } from './blocks';
import { START_LIVES } from './constants';
import { growPlayer } from './growth';

/** Player directly under a block at (5, blockRow), settled and ready to jump. */
function underBlock(glyph: string, blockRow = 3, big = false) {
  const s = playing(levelText(30, [[5, blockRow, glyph]]));
  tick(s, {}, 3);
  if (big) growPlayer(s.player);
  s.player.x = 5.1;
  tick(s, {}, 3);
  return s;
}

describe('coin block', () => {
  it('pays a coin when bumped from below, then goes inert', () => {
    const s = underBlock('?');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.coins).toBe(1);
    expect(s.score).toBe(100);
    expect(events).toContain('coin');
  });

  it('pays only once', () => {
    const s = playing(levelText(30, [[5, 3, '?']]));
    hitBlock(s, 5, 3);
    hitBlock(s, 5, 3);
    expect(s.coins).toBe(1);
  });
});

describe('mushroom block', () => {
  it('sprouts a mushroom on top of the block', () => {
    const s = underBlock('M');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('used');
    expect(s.mushrooms).toHaveLength(1);
    expect(s.mushrooms[0].y + s.mushrooms[0].h).toBeLessThanOrEqual(3 + 1e-9);
    expect(events).toContain('sprout');
  });
});

describe('brick', () => {
  it('only bumps when the player is small', () => {
    const s = underBlock('B');
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[3][5]).toBe('brick');
    expect(events).toContain('bump');
  });

  it('breaks when the player is big', () => {
    const s = underBlock('B', 2, true);
    const events = collect(s, { jump: true }, 3);
    expect(s.tiles[2][5]).toBe('empty');
    expect(s.score).toBe(50);
    expect(events).toContain('break');
  });
});

describe('addCoin', () => {
  it('awards an extra life every 100 coins', () => {
    const s = playing(levelText(30));
    s.coins = 99;
    addCoin(s);
    expect(s.coins).toBe(0);
    expect(s.lives).toBe(START_LIVES + 1);
    expect(s.events.map((e) => e.type)).toEqual(['coin', 'oneup']);
  });
});
