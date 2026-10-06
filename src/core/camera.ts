import { VIEW_TILES_W } from './constants';
import type { ColumnRange, GameState } from './types';

/** The dark (bonus room) column range containing the player's centre column, if any. */
export function activeDarkRange(s: GameState): ColumnRange | undefined {
  const col = Math.floor(s.player.x + s.player.w / 2);
  return s.levels[s.levelIndex].dark.find((range) => col >= range.from && col <= range.to);
}

/** Keeps the camera inside the dark room the player is in, so nothing outside it is in view. */
export function clampToDarkRange(s: GameState): void {
  const range = activeDarkRange(s);
  if (!range) return;
  const low = range.from;
  const high = Math.max(low, range.to + 1 - VIEW_TILES_W);
  s.cameraX = Math.min(high, Math.max(low, s.cameraX));
}

export function updateCamera(s: GameState): void {
  const target = s.player.x + s.player.w / 2 - VIEW_TILES_W / 2;
  const max = Math.max(0, s.width - VIEW_TILES_W);
  s.cameraX = Math.min(max, Math.max(s.cameraX, target));
  clampToDarkRange(s);
}
