import {
  DT,
  GRAVITY,
  MAX_FALL,
  SHELL_SLIDE_SPEED,
  VIEW_TILES_W,
  WALKER_SPEED,
} from './constants';
import { activeDarkRange } from './camera';
import { moveBody, solidAt } from './physics';
import type { Enemy, GameState, Tile } from './types';

function groundAhead(tiles: Tile[][], e: Enemy): boolean {
  const frontX = e.dir > 0 ? e.x + e.w + 0.05 : e.x - 0.05;
  return solidAt(tiles, Math.floor(frontX), Math.floor(e.y + e.h + 0.05));
}

function stepEnemy(s: GameState, e: Enemy): void {
  e.cooldown = Math.max(0, e.cooldown - DT);
  if (e.mode === 'stunned') e.vx = 0;
  else e.vx = e.dir * (e.mode === 'sliding' ? SHELL_SLIDE_SPEED : WALKER_SPEED);
  e.vy = Math.min(e.vy + GRAVITY * DT, MAX_FALL);

  const result = moveBody(e, s.tiles);
  e.onGround = result.landed;
  if (result.hitX) e.dir = -e.dir as 1 | -1;
  else if (e.mode === 'walking' && e.onGround && !groundAhead(s.tiles, e)) {
    e.dir = -e.dir as 1 | -1;
  }
}

export function updateEnemies(s: GameState): void {
  const room = activeDarkRange(s);
  for (const e of s.enemies) {
    const inRoom = !room || (Math.floor(e.x) >= room.from && Math.floor(e.x) <= room.to);
    if (!e.awake && inRoom && e.x < s.cameraX + VIEW_TILES_W + 2) e.awake = true;
    if (e.awake) stepEnemy(s, e);
  }
  s.enemies = s.enemies.filter((e) => e.y <= s.height + 2);
}
