import { DT, GRAVITY, MAX_FALL, MUSHROOM_SPEED, POINTS } from './constants';
import { emit } from './events';
import { growPlayer } from './growth';
import { moveBody, overlaps } from './physics';
import type { GameState, Mushroom } from './types';

/** A mushroom resting on top of block cell (col, row), heading right. */
export function makeMushroom(col: number, row: number): Mushroom {
  return { x: col + 0.1, y: row - 0.8, w: 0.8, h: 0.8, vx: MUSHROOM_SPEED, vy: 0, dir: 1, onGround: false };
}

export function updateMushrooms(s: GameState): void {
  for (const m of s.mushrooms) {
    m.vx = m.dir * MUSHROOM_SPEED;
    m.vy = Math.min(m.vy + GRAVITY * DT, MAX_FALL);
    const result = moveBody(m, s.tiles);
    m.onGround = result.landed;
    if (result.hitX) m.dir = -m.dir as 1 | -1;
  }
  s.mushrooms = s.mushrooms.filter((m) => m.y <= s.height + 2);
}

export function collectMushrooms(s: GameState): void {
  const p = s.player;
  s.mushrooms = s.mushrooms.filter((m) => {
    if (!overlaps(p, m)) return true;
    s.score += POINTS.mushroom;
    growPlayer(p);
    emit(s, 'powerup');
    return false;
  });
}
