import { clampToDarkRange } from './camera';
import { DT, VIEW_TILES_W, WARP_EMERGE_TIME, WARP_SINK_TIME } from './constants';
import { emit } from './events';
import type { GameState, Input, Level, Mouth } from './types';

const FEET_TOLERANCE = 0.05;

function currentLevel(s: GameState): Level {
  return s.levels[s.levelIndex];
}

function mouthById(s: GameState, id: number): Mouth {
  const mouth = currentLevel(s).mouths.find((m) => m.id === id);
  if (!mouth) throw new Error(`No pipe mouth ${id}`);
  return mouth;
}

/** The mouth id the player would emerge from if they entered right now, or null. */
function destination(s: GameState): number | null {
  const p = s.player;
  if (!p.onGround) return null;
  const level = currentLevel(s);
  const centerX = p.x + p.w / 2;
  const feet = p.y + p.h;

  for (const mouth of level.mouths) {
    const warp = level.warps.find((w) => w.from === mouth.id);
    if (!warp) continue;
    const centred = centerX >= mouth.col && centerX < mouth.col + 2;
    if (centred && Math.abs(feet - mouth.row) < FEET_TOLERANCE) return warp.to;
  }

  const col = Math.floor(centerX);
  const row = Math.round(feet);
  if (Math.abs(feet - row) < FEET_TOLERANCE && s.tiles[row]?.[col] === 'warpBlock') {
    const secret = level.secretWarps.find((w) => w.col === col && w.row === row);
    if (secret) return secret.to;
  }
  return null;
}

/** Starts a warp if Down was freshly pressed on an enterable pipe. Returns whether it did. */
export function tryStartWarp(s: GameState, input: Input): boolean {
  if (!input.down || s.prevDown) return false;
  const to = destination(s);
  if (to === null) return false;
  s.phase = 'warping';
  s.warp = { to, teleported: false };
  s.phaseTimer = WARP_SINK_TIME + WARP_EMERGE_TIME;
  s.player.vx = 0;
  s.player.vy = 0;
  emit(s, 'warp');
  return true;
}

function teleport(s: GameState, mouthId: number): void {
  const mouth = mouthById(s, mouthId);
  const p = s.player;
  p.x = mouth.col + 1 - p.w / 2;
  p.y = mouth.row; // top of the body level with the pipe's mouth: fully inside the pipe
  const max = Math.max(0, s.width - VIEW_TILES_W);
  s.cameraX = Math.min(max, Math.max(0, p.x + p.w / 2 - VIEW_TILES_W / 2));
  clampToDarkRange(s);
}

/** One tick of the warp: sink, teleport at the halfway point, emerge. */
export function stepWarping(s: GameState): void {
  const warp = s.warp;
  if (!warp) {
    s.phase = 'playing';
    return;
  }
  const p = s.player;
  s.phaseTimer -= DT;

  if (!warp.teleported) {
    p.y += (p.h / WARP_SINK_TIME) * DT;
    if (s.phaseTimer <= WARP_EMERGE_TIME) {
      teleport(s, warp.to);
      warp.teleported = true;
    }
    return;
  }

  p.y -= (p.h / WARP_EMERGE_TIME) * DT;
  if (s.phaseTimer <= 0) {
    p.y = mouthById(s, warp.to).row - p.h;
    p.vx = 0;
    p.vy = 0;
    s.warp = null;
    s.phase = 'playing';
  }
}
