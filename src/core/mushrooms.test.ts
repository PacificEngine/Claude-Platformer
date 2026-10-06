import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, span, tick } from '../testing/helpers';
import { growPlayer } from './growth';
import { makeMushroom } from './mushrooms';

describe('mushroom movement', () => {
  it('walks right and turns around at a wall', () => {
    const s = playing(levelText(30, [[10, 4, '#']]));
    s.mushrooms.push(makeMushroom(7, 5)); // resting on the ground at row 4
    tick(s, {}, 60);
    expect(s.mushrooms[0].dir).toBe(-1);
  });

  it('walks off ledges and is removed when it leaves the world', () => {
    const s = playing(levelText(30, span(9, 29, 5, '.')));
    s.mushrooms.push(makeMushroom(7, 5));
    tick(s, {}, 120);
    expect(s.mushrooms).toHaveLength(0);
  });
});

describe('collecting a mushroom', () => {
  const overlapping = () => {
    const s = playing(levelText(30));
    tick(s, {}, 3);
    s.mushrooms.push({ x: 1.1, y: 4.2, w: 0.8, h: 0.8, vx: 0, vy: 0, dir: 1, onGround: true });
    return s;
  };

  it('grows a small player, keeping the feet in place', () => {
    const s = overlapping();
    const events = collect(s, {}, 1);
    expect(s.player.size).toBe('big');
    expect(s.player.h).toBe(2);
    expect(s.player.y + s.player.h).toBeCloseTo(5);
    expect(s.mushrooms).toHaveLength(0);
    expect(s.score).toBe(1000);
    expect(events).toContain('powerup');
  });

  it('only scores for a player who is already big', () => {
    const s = overlapping();
    growPlayer(s.player);
    tick(s, {}, 1);
    expect(s.player.size).toBe('big');
    expect(s.score).toBe(1000);
  });
});
