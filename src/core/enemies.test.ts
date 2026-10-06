import { describe, expect, it } from 'vitest';
import { levelText, playing, span, tick } from '../testing/helpers';

describe('walker movement', () => {
  it('turns around at a wall', () => {
    const s = playing(levelText(30, [[10, 4, 'g'], [8, 4, '#']]));
    tick(s, {}, 60);
    expect(s.enemies[0].dir).toBe(1);
    expect(s.enemies[0].x).toBeGreaterThanOrEqual(9);
  });

  it('turns around at a ledge instead of falling', () => {
    const s = playing(levelText(30, [[10, 4, 'g'], ...span(6, 9, 5, '.')]));
    tick(s, {}, 20);
    expect(s.enemies[0].dir).toBe(1);
    expect(s.enemies[0].y).toBeCloseTo(4.2);
    expect(s.enemies[0].x).toBeGreaterThanOrEqual(10);
  });

  it('stays asleep until the camera nears it', () => {
    const s = playing(levelText(60, [[50, 4, 'g']]));
    tick(s, {}, 30);
    expect(s.enemies[0].awake).toBe(false);
    expect(s.enemies[0].x).toBeCloseTo(50.1);
  });

  it('is removed after falling out of the world', () => {
    const s = playing(levelText(30, [[10, 4, 'g'], ...span(8, 14, 5, '.')]));
    s.enemies[0].dir = 1;
    s.enemies[0].x = 12;
    tick(s, {}, 120);
    expect(s.enemies).toHaveLength(0);
  });
});

describe('enemies and bonus rooms', () => {
  it('does not wake enemies outside the dark room the player is in', () => {
    const s = playing(levelText(80, [[30, 4, 'g']], 6, ['dark 60-75']));
    s.player.x = 65;
    s.player.y = 4;
    tick(s, {}, 30);
    expect(s.cameraX).toBeGreaterThanOrEqual(60);
    expect(s.enemies[0].awake).toBe(false);
    expect(s.enemies[0].x).toBeCloseTo(30.1);
  });
});
