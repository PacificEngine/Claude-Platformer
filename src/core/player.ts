import {
  ACCEL,
  COYOTE_TIME,
  DT,
  FRICTION,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_CUT_VELOCITY,
  JUMP_VELOCITY,
  MAX_FALL,
  RUN_SPEED,
  WALK_SPEED,
} from './constants';
import { hitBlock } from './blocks';
import { emit } from './events';
import { moveBody } from './physics';
import type { GameState, Input } from './types';

function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

export function updatePlayer(s: GameState, input: Input): void {
  const p = s.player;
  const jumpPressed = input.jump && !s.prevJump;

  p.coyote = p.onGround ? COYOTE_TIME : Math.max(0, p.coyote - DT);
  p.jumpBuffer = jumpPressed ? JUMP_BUFFER_TIME : Math.max(0, p.jumpBuffer - DT);
  p.invulnerable = Math.max(0, p.invulnerable - DT);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    p.facing = dir as 1 | -1;
    const turning = p.vx !== 0 && Math.sign(p.vx) !== dir;
    const max = input.run ? RUN_SPEED : WALK_SPEED;
    p.vx = approach(p.vx, dir * max, (turning ? FRICTION : ACCEL) * DT);
  } else {
    p.vx = approach(p.vx, 0, FRICTION * DT);
  }

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -JUMP_VELOCITY;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.onGround = false;
    p.jumping = true;
    emit(s, 'jump');
  }
  if (p.jumping && !input.jump && p.vy < -JUMP_CUT_VELOCITY) p.vy = -JUMP_CUT_VELOCITY;
  p.vy = Math.min(p.vy + GRAVITY * DT, MAX_FALL);

  const result = moveBody(p, s.tiles, { bumpHidden: true });
  p.onGround = result.landed;
  if (result.landed) p.jumping = false;
  if (result.bonk) hitBlock(s, result.bonk.col, result.bonk.row);

  if (p.x < s.cameraX) {
    p.x = s.cameraX;
    p.vx = Math.max(0, p.vx);
  }
}
