import { solidAt } from '../core/physics';
import type { GameState, Input } from '../core/types';

function shouldJump(s: GameState): boolean {
  const p = s.player;
  const front = (dx: number) => Math.floor(p.x + p.w + dx);
  const footRow = Math.floor(p.y + p.h - 0.5);

  const wallAhead = [0.5, 1.0, 1.5].some((dx) => solidAt(s.tiles, front(dx), footRow));
  const gapAhead = !solidAt(s.tiles, front(0.3), Math.floor(p.y + p.h + 0.5));
  const enemyAhead = s.enemies.some((e) => {
    const distance = e.x - (p.x + p.w);
    return distance > 0.5 && distance < 5 && Math.abs(e.y - p.y) < 2;
  });
  return wallAhead || gapAhead || enemyAhead;
}

/** Runs right, jumping (and holding jump while airborne) over walls, gaps and enemies. */
export function createBot(): (s: GameState) => Input {
  let held = false;
  return (s) => {
    const want = s.player.onGround && shouldJump(s);
    const jump = s.player.onGround ? want && !held : held;
    held = jump;
    return { left: false, right: true, run: true, jump };
  };
}
