import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, tick } from '../testing/helpers';

const KOOPA = levelText(30, [[5, 4, 'k']]);

describe('shell enemy', () => {
  it('is stunned, not destroyed, when stomped', () => {
    const s = playing(KOOPA);
    tick(s, {}, 3);
    Object.assign(s.player, { x: 5.2, y: 3, vy: 8, onGround: false, coyote: 0 });
    collect(s, {}, 5);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].mode).toBe('stunned');
    expect(s.enemies[0].vx).toBe(0);
    expect(s.score).toBe(200);
    expect(s.phase).toBe('playing');
  });

  it('is kicked away from the player when a stunned shell is touched', () => {
    const s = playing(KOOPA);
    tick(s, {}, 3);
    s.enemies[0].mode = 'stunned';
    s.player.x = 4.6;
    const events = collect(s, {}, 1);
    expect(s.enemies[0].mode).toBe('sliding');
    expect(s.enemies[0].dir).toBe(1);
    expect(s.phase).toBe('playing');
    expect(events).toContain('kick');
  });

  it('hurts the player once it is sliding and its grace has passed', () => {
    const s = playing(KOOPA);
    tick(s, {}, 3);
    Object.assign(s.enemies[0], { mode: 'sliding', dir: 1, cooldown: 0 });
    s.player.x = 4.6;
    tick(s, {}, 1);
    expect(s.phase).toBe('dying');
  });

  it('defeats other enemies it slides into', () => {
    const s = playing(levelText(30, [[5, 4, 'k'], [7, 4, 'g']]));
    const shell = s.enemies.find((e) => e.kind === 'shell')!; // walkers are listed first
    Object.assign(shell, { mode: 'sliding', dir: 1, cooldown: 0 });
    tick(s, {}, 12);
    expect(s.enemies.map((e) => e.kind)).toEqual(['shell']);
    expect(s.score).toBe(100);
  });
});
