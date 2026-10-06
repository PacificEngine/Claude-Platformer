import {
  DEATH_HOP,
  DEATH_TIME,
  INVULN_TIME,
  KICK_GRACE,
  POINTS,
  STOMP_BOUNCE,
  STOMP_DEPTH,
} from './constants';
import { emit } from './events';
import { shrinkPlayer } from './growth';
import { overlaps } from './physics';
import type { Enemy, GameState } from './types';

function stomp(s: GameState, e: Enemy): void {
  s.player.vy = -STOMP_BOUNCE;
  s.score += POINTS.stomp;
  emit(s, 'stomp');
  if (e.kind === 'shell') {
    e.mode = 'stunned';
    e.vx = 0;
    e.cooldown = KICK_GRACE; // so the bouncing player doesn't instantly kick it
  } else {
    s.enemies = s.enemies.filter((other) => other !== e);
  }
}

function kick(s: GameState, e: Enemy): void {
  const p = s.player;
  e.mode = 'sliding';
  e.dir = p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1;
  e.cooldown = KICK_GRACE;
  emit(s, 'kick');
}

export function killPlayer(s: GameState): void {
  const p = s.player;
  s.phase = 'dying';
  s.phaseTimer = DEATH_TIME;
  s.lives -= 1;
  p.vx = 0;
  p.vy = p.y > s.height ? 0 : -DEATH_HOP;
  emit(s, 'death');
}

export function hurtPlayer(s: GameState): void {
  const p = s.player;
  if (p.size === 'big') {
    shrinkPlayer(p);
    p.invulnerable = INVULN_TIME;
    emit(s, 'shrink');
  } else {
    killPlayer(s);
  }
}

export function resolvePlayerEnemies(s: GameState): void {
  const p = s.player;
  for (const e of [...s.enemies]) {
    if (s.phase !== 'playing') return;
    if (!overlaps(p, e)) continue;
    const stomping = p.vy > 0 && p.y + p.h - e.y < STOMP_DEPTH;
    if (e.mode === 'stunned') {
      if (e.cooldown === 0) kick(s, e);
    } else if (stomping) stomp(s, e);
    else if (e.cooldown === 0 && p.invulnerable === 0) hurtPlayer(s);
  }
}

/** Sliding shells defeat every other enemy they touch. */
export function resolveShellHits(s: GameState): void {
  const defeated = new Set<Enemy>();
  for (const shell of s.enemies) {
    if (shell.mode !== 'sliding') continue;
    for (const other of s.enemies) {
      if (other !== shell && !defeated.has(other) && overlaps(shell, other)) defeated.add(other);
    }
  }
  if (defeated.size === 0) return;
  s.score += POINTS.shellKill * defeated.size;
  s.enemies = s.enemies.filter((e) => !defeated.has(e));
  emit(s, 'stomp');
}
