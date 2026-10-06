import { describe, expect, it } from 'vitest';
import { collect, levelText, playing, span, tick } from '../testing/helpers';
import { DEATH_TIME, INVULN_TIME, START_LIVES } from './constants';
import { growPlayer } from './growth';

const deathTicks = Math.ceil(DEATH_TIME / (1 / 60)) + 2;

function sideHit() {
  const s = playing(levelText(30, [[5, 4, 'g']]));
  tick(s, {}, 3);
  s.player.x = 4.6; // overlapping the walker, standing on the ground
  return s;
}

describe('stomping', () => {
  it('defeats a walker, bounces the player and scores', () => {
    const s = playing(levelText(30, [[5, 4, 'g']]));
    tick(s, {}, 3);
    Object.assign(s.player, { x: 5.2, y: 3, vy: 8, onGround: false, coyote: 0 });
    const events = collect(s, {}, 5);
    expect(s.enemies).toHaveLength(0);
    expect(s.score).toBe(200);
    expect(s.player.vy).toBeLessThan(0);
    expect(events).toContain('stomp');
    expect(s.phase).toBe('playing');
  });
});

describe('taking damage', () => {
  it('kills a small player on a side hit', () => {
    const s = sideHit();
    const events = collect(s, {}, 1);
    expect(s.phase).toBe('dying');
    expect(s.lives).toBe(START_LIVES - 1);
    expect(events).toContain('death');
  });

  it('shrinks a big player and grants brief invulnerability', () => {
    const s = sideHit();
    growPlayer(s.player);
    const events = collect(s, {}, 1);
    expect(s.phase).toBe('playing');
    expect(s.player.size).toBe('small');
    expect(s.player.h).toBe(1);
    expect(s.player.invulnerable).toBeGreaterThan(INVULN_TIME - 0.1);
    expect(events).toContain('shrink');
    tick(s, {}, 10);
    expect(s.phase).toBe('playing');
  });
});

describe('death flow', () => {
  it('respawns at the level start with the enemies reset', () => {
    const s = sideHit();
    tick(s, {}, deathTicks);
    expect(s.phase).toBe('playing');
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.player.size).toBe('small');
    expect(s.player.x).toBeCloseTo(1.125);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].x).toBeCloseTo(5.1, 0); // reset, then a tick or two of walking
  });

  it('ends the game when the last life is lost', () => {
    const s = sideHit();
    s.lives = 1;
    tick(s, {}, deathTicks);
    expect(s.phase).toBe('gameOver');
    expect(s.lives).toBe(0);
  });

  it('returns to the title screen from game over on jump', () => {
    const s = playing(levelText(30));
    Object.assign(s, { phase: 'gameOver', score: 500, lives: 0 });
    tick(s, { jump: true });
    expect(s).toMatchObject({ phase: 'title', score: 0, lives: START_LIVES });
  });

  it('kills the player who falls into a pit', () => {
    const s = playing(levelText(30, span(3, 29, 5, '.')));
    for (let i = 0; i < 300 && s.phase === 'playing'; i++) tick(s, { right: true });
    expect(s.phase).toBe('dying');
    expect(s.lives).toBe(START_LIVES - 1);
  });
});
