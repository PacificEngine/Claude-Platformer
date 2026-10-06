import { describe, expect, it } from 'vitest';
import { parseLevel } from '../levels/format';
import { collect, levelText, NONE, playing, tick } from '../testing/helpers';
import { step } from './game';
import { createGame } from './state';

describe('step: title screen', () => {
  it('starts play when jump is pressed', () => {
    const s = createGame([parseLevel(levelText(30))]);
    expect(s.phase).toBe('title');
    step(s, NONE);
    expect(s.phase).toBe('title');
    step(s, { ...NONE, jump: true });
    expect(s.phase).toBe('playing');
  });

  it('does not turn the same held press into a jump', () => {
    const s = createGame([parseLevel(levelText(30))]);
    step(s, { ...NONE, jump: true });
    expect(collect(s, { jump: true }, 5)).not.toContain('jump'); // still the same held press
  });
});

describe('step: events', () => {
  it('clears last tick\'s events at the start of each tick', () => {
    const s = playing(levelText(30));
    tick(s, {}, 5);
    tick(s, { jump: true });
    expect(s.events).toHaveLength(1);
    tick(s, { jump: true });
    expect(s.events).toHaveLength(0);
  });
});

describe('camera', () => {
  const WIDE = levelText(60);

  it('follows the player to the right', () => {
    const s = playing(WIDE);
    tick(s, { right: true, run: true }, 120);
    expect(s.cameraX).toBeGreaterThan(0);
    expect(s.cameraX).toBeLessThanOrEqual(60 - 16);
  });

  it('never scrolls backward and walls the player in on the left', () => {
    const s = playing(WIDE);
    tick(s, { right: true, run: true }, 120);
    tick(s, {}, 60); // shed run momentum so the camera has settled
    const before = s.cameraX;
    tick(s, { left: true, run: true }, 120);
    expect(s.cameraX).toBe(before);
    expect(s.player.x).toBeGreaterThanOrEqual(before - 1e-9);
  });

  it('stays at zero on a level narrower than the view', () => {
    const s = playing(levelText(10));
    tick(s, { right: true }, 20);
    expect(s.cameraX).toBe(0);
  });

  it('ignores pickups on the tick the player dies', () => {
    const s = playing(levelText(30, [[5, 4, 'g'], [4, 4, 'c']]));
    tick(s, {}, 3);
    s.player.x = 4.6;
    s.lives = 1;
    s.coins = 99;
    tick(s);
    expect(s.phase).toBe('dying');
    expect(s.coins).toBe(99);
    expect(s.score).toBe(0);
    expect(s.lives).toBe(0); // the death cost the life; no refund from the coin
  });
});
